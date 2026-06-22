import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TaskStatus, TaskPriority, AssignmentRole, ApprovalStatus } from '@ctms/db';

// Enforced state transition matrix
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.todo]: [TaskStatus.in_progress],
  [TaskStatus.in_progress]: [TaskStatus.needs_action, TaskStatus.needs_verification, TaskStatus.closed],
  [TaskStatus.needs_action]: [TaskStatus.in_progress],
  [TaskStatus.needs_verification]: [TaskStatus.closed, TaskStatus.needs_action, TaskStatus.in_progress],
  [TaskStatus.closed]: [TaskStatus.in_progress, TaskStatus.todo],
};

const taskRoutes: FastifyPluginAsync = async (server) => {

  // ─── POST /tasks (Create Task with Multi-Assignees) ───────────────
  server.post('/', async (request, reply) => {
    const bodySchema = z.object({
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional().nullable(),
      priority: z.enum(['low', 'medium', 'high', 'critical', 'urgent']).default('medium'),
      dueDate: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
      categoryId: z.string().optional().nullable(),
      projectId: z.string().optional().nullable(),
      assigneeIds: z.array(z.string()).optional().default([]),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const { title, description, priority, dueDate, categoryId, projectId, assigneeIds } = parsed.data;
    const actorId = request.user!.id;

    // Run creation inside a Prisma Transaction to ensure audit logs & assignments write atomic
    const task = await server.prisma.$transaction(async (tx) => {
      // 1. Create the task
      const newTask = await tx.task.create({
        data: {
          title,
          description,
          priority: priority as TaskPriority,
          status: TaskStatus.todo,
          dueDate,
          categoryId,
          projectId,
          createdById: actorId,
        },
      });

      // 2. Set up assignments (First in array is OWNER, others are COLLABORATOR)
      if (assigneeIds.length > 0) {
        await tx.taskAssignment.createMany({
          data: assigneeIds.map((id, index) => ({
            taskId: newTask.id,
            employeeId: id,
            role: index === 0 ? AssignmentRole.owner : AssignmentRole.collaborator,
            assignedById: actorId,
          })),
        });

        // Create notification alerts for all assignees
        await tx.notification.createMany({
          data: assigneeIds.map(id => ({
            employeeId: id,
            type: 'task_assigned',
            taskId: newTask.id,
            message: `You have been assigned to task: "${title}"`,
          })),
        });
      }

      // 3. Write Audit Log
      await tx.auditLog.create({
        data: {
          taskId: newTask.id,
          actorId,
          action: 'create',
          toValue: `Task created with status TODO. Priority: ${priority}. Assignees: ${assigneeIds.length}`,
        },
      });

      return newTask;
    });

    // Load full relations to return
    const loadedTask = await server.prisma.task.findUnique({
      where: { id: task.id },
      include: {
        assignments: { include: { employee: true } },
        category: true,
        project: true,
        createdBy: true,
      },
    });

    return reply.status(201).send(loadedTask);
  });

  // ─── GET /tasks (List Tasks with Role-based Visibility) ───────────
  server.get('/', async (request, reply) => {
    const querySchema = z.object({
      status: z.nativeEnum(TaskStatus).optional(),
      priority: z.nativeEnum(TaskPriority).optional(),
      categoryId: z.string().optional(),
      projectId: z.string().optional(),
    });

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const { status, priority, categoryId, projectId } = parsed.data;
    const employee = request.user!;
    const where: any = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (categoryId) where.categoryId = categoryId;
    if (projectId) where.projectId = projectId;

    // Visibility: Members only see tasks they are assigned to or created
    if (employee.accessRole === 'member') {
      where.OR = [
        { createdById: employee.id },
        { assignments: { some: { employeeId: employee.id } } },
      ];
    }

    const tasks = await server.prisma.task.findMany({
      where,
      include: {
        assignments: { include: { employee: true } },
        category: true,
        project: true,
        createdBy: true,
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    return tasks;
  });

  // ─── GET /tasks/:id (Single Task View) ────────────────────────────
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const employee = request.user!;

    const task = await server.prisma.task.findUnique({
      where: { id },
      include: {
        assignments: { include: { employee: true } },
        category: true,
        project: true,
        createdBy: true,
        comments: {
          include: { author: true, attachments: true },
          orderBy: { createdAt: 'asc' },
        },
        auditLogs: { include: { actor: true }, orderBy: { createdAt: 'desc' } },
        attachments: true,
        approvals: { include: { requestedBy: true, approver: true } },
      },
    });

    if (!task) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Task not found',
      });
    }

    // Visibility gate
    if (employee.accessRole === 'member') {
      const isCreator = task.createdById === employee.id;
      const isAssignee = task.assignments.some(a => a.employeeId === employee.id);
      if (!isCreator && !isAssignee) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to view this task',
        });
      }
    }

    return task;
  });

  // ─── PUT /tasks/:id (Edit Metadata) ───────────────────────────────
  server.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const employee = request.user!;

    const task = await server.prisma.task.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!task) {
      return reply.status(404).send({ error: 'Not Found', message: 'Task not found' });
    }

    // Visibility check
    if (employee.accessRole === 'member') {
      const isCreator = task.createdById === employee.id;
      const isAssignee = task.assignments.some(a => a.employeeId === employee.id);
      if (!isCreator && !isAssignee) {
        return reply.status(403).send({ error: 'Forbidden', message: 'No write permissions' });
      }
    }

    const bodySchema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      priority: z.nativeEnum(TaskPriority).optional(),
      dueDate: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
      categoryId: z.string().optional().nullable(),
      projectId: z.string().optional().nullable(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const updated = await server.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id },
        data: {
          ...parsed.data,
          lastActivityAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          taskId: id,
          actorId: employee.id,
          action: 'edit',
          toValue: `Metadata updated: ${Object.keys(parsed.data).join(', ')}`,
        },
      });

      return updatedTask;
    });

    return updated;
  });

  // ─── PATCH /tasks/:id/status (Transition Task Status) ──────────────
  server.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const employee = request.user!;

    const task = await server.prisma.task.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!task) {
      return reply.status(404).send({ error: 'Not Found', message: 'Task not found' });
    }

    // Access gate
    if (employee.accessRole === 'member') {
      const isCreator = task.createdById === employee.id;
      const isAssignee = task.assignments.some(a => a.employeeId === employee.id);
      if (!isCreator && !isAssignee) {
        return reply.status(403).send({ error: 'Forbidden', message: 'No write permissions' });
      }
    }

    const bodySchema = z.object({
      status: z.nativeEnum(TaskStatus),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const newStatus = parsed.data.status;
    const oldStatus = task.status;

    if (oldStatus === newStatus) {
      return task;
    }

    // 1. Validate against status transition matrix
    const allowed = VALID_TRANSITIONS[oldStatus]?.includes(newStatus);
    if (!allowed) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid transition: tasks cannot transition directly from ${oldStatus} to ${newStatus}`,
      });
    }

    // 2. Closed status permission rule (Only admins / super admins can close/reopen closed tasks)
    const isClosingOrReopening = oldStatus === TaskStatus.closed || newStatus === TaskStatus.closed;
    if (isClosingOrReopening && employee.accessRole === 'member') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only admins or super admins are allowed to close or reopen tasks',
      });
    }

    const updatedTask = await server.prisma.$transaction(async (tx) => {
      // Update status
      const updated = await tx.task.update({
        where: { id },
        data: {
          status: newStatus,
          lastActivityAt: new Date(),
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          taskId: id,
          actorId: employee.id,
          action: 'status_change',
          fromValue: oldStatus,
          toValue: newStatus,
        },
      });

      // Notify assignees about status update
      const notifyTargets = task.assignments.map(a => a.employeeId);
      if (notifyTargets.length > 0) {
        await tx.notification.createMany({
          data: notifyTargets.map(employeeId => ({
            employeeId,
            type: 'status_changed',
            taskId: id,
            message: `Task "${task.title}" status changed from ${oldStatus} to ${newStatus}`,
          })),
        });
      }

      return updated;
    });

    return updatedTask;
  });

  // ─── POST /tasks/:id/assignees (Add Assignee) ──────────────────────
  server.post('/:id/assignees', async (request, reply) => {
    const { id } = request.params as { id: string };
    const employee = request.user!;

    const task = await server.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return reply.status(404).send({ error: 'Not Found', message: 'Task not found' });
    }

    // Enforce permission (Admins only can modify assignees, or Super Admin)
    if (employee.accessRole === 'member') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins can modify assignees' });
    }

    const bodySchema = z.object({
      employeeId: z.string(),
      role: z.nativeEnum(AssignmentRole).default(AssignmentRole.collaborator),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const { employeeId, role } = parsed.data;

    // Check if employee exists
    const targetEmployee = await server.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!targetEmployee) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Employee not found' });
    }

    const assignment = await server.prisma.$transaction(async (tx) => {
      // Upsert assignment
      const ass = await tx.taskAssignment.upsert({
        where: {
          taskId_employeeId: { taskId: id, employeeId },
        },
        update: { role },
        create: {
          taskId: id,
          employeeId,
          role,
          assignedById: employee.id,
        },
      });

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          taskId: id,
          actorId: employee.id,
          action: 'assign',
          toValue: `Assigned employee ${targetEmployee.name} as ${role}`,
        },
      });

      // Trigger notification
      await tx.notification.create({
        data: {
          employeeId,
          type: 'task_assigned',
          taskId: id,
          message: `You have been assigned to task: "${task.title}" as ${role}`,
        },
      });

      return ass;
    });

    return assignment;
  });

  // ─── DELETE /tasks/:id/assignees/:employeeId (Remove Assignee) ─────
  server.delete('/:id/assignees/:employeeId', async (request, reply) => {
    const { id, employeeId } = request.params as { id: string; employeeId: string };
    const employee = request.user!;

    const task = await server.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return reply.status(404).send({ error: 'Not Found', message: 'Task not found' });
    }

    if (employee.accessRole === 'member') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins can modify assignees' });
    }

    const targetEmployee = await server.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    await server.prisma.$transaction(async (tx) => {
      await tx.taskAssignment.delete({
        where: {
          taskId_employeeId: { taskId: id, employeeId },
        },
      });

      await tx.auditLog.create({
        data: {
          taskId: id,
          actorId: employee.id,
          action: 'unassign',
          toValue: `Removed employee ${targetEmployee ? targetEmployee.name : employeeId} from task`,
        },
      });
    });

    return { success: true, message: 'Assignee removed successfully' };
  });

  // ─── GET /tasks/categories (List all task categories) ─────────────
  server.get('/categories', async (_request, reply) => {
    const categories = await server.prisma.category.findMany({
      orderBy: { key: 'asc' },
    });
    return categories;
  });

  // ─── POST /tasks/:id/approvals (Request Approval) ─────────────────
  server.post('/:id/approvals', async (request, reply) => {
    const { id } = request.params as { id: string };
    const actorId = request.user!.id;

    const task = await server.prisma.task.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!task) {
      return reply.status(404).send({ error: 'Not Found', message: 'Task not found' });
    }

    const bodySchema = z.object({
      approverId: z.string().min(1, 'Approver ID is required'),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const { approverId } = parsed.data;

    // Verify approver exists
    const approver = await server.prisma.employee.findUnique({ where: { id: approverId } });
    if (!approver) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Approver employee not found' });
    }

    const approval = await server.prisma.$transaction(async (tx) => {
      // Create the approval request
      const newApproval = await tx.approvalRequest.create({
        data: {
          taskId: id,
          requestedById: actorId,
          approverId,
          status: ApprovalStatus.pending,
        },
        include: { requestedBy: true, approver: true },
      });

      // Update task status to needs_verification
      await tx.task.update({
        where: { id },
        data: { status: TaskStatus.needs_verification, lastActivityAt: new Date() },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          taskId: id,
          actorId,
          action: 'approval_requested',
          toValue: `Approval requested from ${approver.name}`,
        },
      });

      // Notify the designated approver
      await tx.notification.create({
        data: {
          employeeId: approverId,
          type: 'approval_requested',
          taskId: id,
          message: `Approval requested for task: "${task.title}"`,
        },
      });

      return newApproval;
    });

    return reply.status(201).send(approval);
  });

  // ─── PATCH /tasks/:id/approvals/:approvalId (Decide: Approve / Reject) ─
  server.patch('/:id/approvals/:approvalId', async (request, reply) => {
    const { id, approvalId } = request.params as { id: string; approvalId: string };
    const actor = request.user!;

    const existingApproval = await server.prisma.approvalRequest.findUnique({
      where: { id: approvalId },
      include: { task: { include: { assignments: true } } },
    });

    if (!existingApproval || existingApproval.taskId !== id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Approval request not found' });
    }

    // Only the designated approver or admins may decide
    if (actor.accessRole === 'member' && existingApproval.approverId !== actor.id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only the designated approver can act on this request',
      });
    }

    if (existingApproval.status !== ApprovalStatus.pending) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'This approval request has already been decided',
      });
    }

    const bodySchema = z.object({
      status: z.enum(['approved', 'rejected']),
      decisionComment: z.string().min(1, 'A decision comment is required'),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const { status, decisionComment } = parsed.data;

    // Determine task status transition based on decision
    const nextTaskStatus =
      status === 'approved' ? TaskStatus.closed : TaskStatus.in_progress;

    const decidedApproval = await server.prisma.$transaction(async (tx) => {
      // 1. Update the approval record
      const updated = await tx.approvalRequest.update({
        where: { id: approvalId },
        data: {
          status: status as ApprovalStatus,
          decisionComment,
          decidedAt: new Date(),
        },
        include: { requestedBy: true, approver: true },
      });

      // 2. Transition the task status
      await tx.task.update({
        where: { id },
        data: { status: nextTaskStatus, lastActivityAt: new Date() },
      });

      // 3. Write audit log
      await tx.auditLog.create({
        data: {
          taskId: id,
          actorId: actor.id,
          action: `approval_${status}`,
          fromValue: ApprovalStatus.pending,
          toValue: `${status}: ${decisionComment}`,
        },
      });

      // 4. Notify all task assignees
      const assigneeIds = existingApproval.task.assignments.map((a) => a.employeeId);
      if (assigneeIds.length > 0) {
        await tx.notification.createMany({
          data: assigneeIds.map((employeeId) => ({
            employeeId,
            type: `approval_${status}`,
            taskId: id,
            message: `Task "${existingApproval.task.title}" was ${status}: "${decisionComment}"`,
          })),
        });
      }

      return updated;
    });

    return decidedApproval;
  });
};

export default taskRoutes;

