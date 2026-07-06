import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TaskStatus, TaskPriority, AssignmentRole, ApprovalStatus } from '@ctms/db';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import { config } from '../../config';

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

const supabaseUrl = config.SUPABASE_URL;
const supabaseKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Enforced state transition matrix
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.todo]: [TaskStatus.in_progress],
  [TaskStatus.in_progress]: [TaskStatus.needs_action, TaskStatus.needs_verification, TaskStatus.closed],
  [TaskStatus.needs_action]: [TaskStatus.in_progress],
  [TaskStatus.needs_verification]: [TaskStatus.closed, TaskStatus.needs_action, TaskStatus.in_progress],
  [TaskStatus.closed]: [TaskStatus.in_progress, TaskStatus.todo],
};

const taskRoutes: FastifyPluginAsync = async (server) => {

  // ─── POST /tasks/attachments/upload ──────────────────────────────
  server.post('/attachments/upload', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No file uploaded' });
    }

    const uniqueId = randomUUID();
    const extension = path.extname(data.filename);
    const basename = path.basename(data.filename, extension);
    const filename = `${uniqueId}-${basename}${extension}`;

    try {
      const fileBuffer = await data.toBuffer();
      const { error } = await supabase.storage
        .from('attachments')
        .upload(filename, fileBuffer, {
          contentType: data.mimetype,
          upsert: true,
        });

      if (error) {
        request.log.error(error, 'Supabase upload failed');
        return reply.status(500).send({
          error: 'Supabase Error',
          message: error.message,
        });
      }

      const { data: publicUrlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filename);

      if (!publicUrlData || !publicUrlData.publicUrl) {
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Could not resolve public URL from Supabase Storage',
        });
      }

      return reply.status(201).send({
        fileUrl: publicUrlData.publicUrl,
        fileName: data.filename,
        fileType: data.mimetype,
        sizeBytes: fileBuffer.length,
      });
    } catch (err: any) {
      request.log.error(err, 'Supabase upload operation failed');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: err.message || 'File upload failed',
      });
    }
  });

  // ─── POST /tasks (Create Task with Multi-Assignees and Attachments) ───────────────
  server.post('/', async (request, reply) => {
    const bodySchema = z.object({
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional().nullable(),
      priority: z.enum(['low', 'medium', 'high', 'critical', 'urgent']).default('medium'),
      dueDate: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
      categoryId: z.string().optional().nullable(),
      projectId: z.string().optional().nullable(),
      assigneeIds: z.array(z.string()).optional().default([]),
      attachments: z.array(z.object({
        fileUrl: z.string(),
        fileName: z.string(),
        fileType: z.string(),
        sizeBytes: z.number().int().min(0),
      })).optional().default([]),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const { title, description, priority, dueDate, categoryId, projectId, assigneeIds, attachments } = parsed.data;
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

      // 4. Create Attachments
      if (attachments && attachments.length > 0) {
        await tx.attachment.createMany({
          data: attachments.map(att => ({
            taskId: newTask.id,
            uploaderId: actorId,
            fileUrl: att.fileUrl,
            fileName: att.fileName,
            fileType: att.fileType,
            sizeBytes: att.sizeBytes,
          })),
        });
      }

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
        attachments: true,
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

  // ─── GET /tasks/my-approvals (My approval requests - pending & decided) ───
  server.get('/my-approvals', async (request, reply) => {
    const actor = request.user!;

    const tasks = await server.prisma.task.findMany({
      where: {
        approvals: {
          some: {
            approverId: actor.id,
          },
        },
      },
      include: {
        assignments: { include: { employee: true } },
        category: true,
        createdBy: true,
        approvals: {
          where: { approverId: actor.id },
          include: { requestedBy: true, approver: true },
        },
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

  // ─── DELETE /tasks/:id (Delete Task) ───────────────────────────────
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const employee = request.user!;

    const task = await server.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return reply.status(404).send({ error: 'Not Found', message: 'Task not found' });
    }

    // Permission check: only super_admin, admin, or the task creator can delete
    const isSuperAdmin = employee.accessRole === 'super_admin';
    const isAdmin = employee.accessRole === 'admin';
    const isCreator = task.createdById === employee.id;

    if (!isSuperAdmin && !isAdmin && !isCreator) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only admins, super admins, or the task creator can delete this task',
      });
    }

    await server.prisma.$transaction(async (tx) => {
      // 1. Delete notifications
      await tx.notification.deleteMany({ where: { taskId: id } });

      // 2. Delete audit logs
      await tx.auditLog.deleteMany({ where: { taskId: id } });

      // 3. Delete approvals
      await tx.approvalRequest.deleteMany({ where: { taskId: id } });

      // 4. Delete attachments associated with comments or tasks
      await tx.attachment.deleteMany({
        where: {
          OR: [
            { taskId: id },
            { comment: { taskId: id } },
          ],
        },
      });

      // 5. Delete comments
      await tx.comment.deleteMany({ where: { taskId: id } });

      // 6. Delete assignments
      await tx.taskAssignment.deleteMany({ where: { taskId: id } });

      // 7. Delete the task
      await tx.task.delete({ where: { id } });
    });

    return { success: true, message: 'Task deleted successfully' };
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

  // ─── POST /tasks/:id/comments (Add Comment) ──────────────────────────
  server.post('/:id/comments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const employee = request.user!;

    const commentSchema = z.object({
      body: z.string().min(1, 'Comment body is required'),
      type: z.enum(['text', 'voice']).default('text'),
      attachments: z.array(z.object({
        fileUrl: z.string().url(),
        fileType: z.string(),
        fileName: z.string(),
        sizeBytes: z.number().int().nonnegative(),
      })).optional(),
    });

    const parsed = commentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid comment schema',
        details: parsed.error.format(),
      });
    }

    const { body, type, attachments } = parsed.data;

    // Verify task existence & visibility
    const task = await server.prisma.task.findUnique({
      where: { id },
      include: {
        assignments: true,
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
          message: 'You do not have access to this task',
        });
      }
    }

    const newComment = await server.prisma.$transaction(async (tx) => {
      // 1. Create comment
      const comment = await tx.comment.create({
        data: {
          taskId: id,
          authorId: employee.id,
          body,
          type,
        },
        include: {
          author: true,
          attachments: true,
        },
      });

      // 2. Add attachments if any
      if (attachments && attachments.length > 0) {
        await tx.attachment.createMany({
          data: attachments.map((a) => ({
            taskId: id,
            commentId: comment.id,
            uploaderId: employee.id,
            fileUrl: a.fileUrl,
            fileType: a.fileType,
            fileName: a.fileName,
            sizeBytes: a.sizeBytes,
          })),
        });

        // Write audit log with attachment count
        await tx.auditLog.create({
          data: {
            taskId: id,
            actorId: employee.id,
            action: 'add_comment_with_attachments',
            toValue: `${attachments.length} file(s) uploaded`,
          },
        });
      } else {
        // Write normal comment audit log
        await tx.auditLog.create({
          data: {
            taskId: id,
            actorId: employee.id,
            action: 'add_comment',
            toValue: body.length > 30 ? body.substring(0, 30) + '...' : body,
          },
        });
      }

      // 3. Update lastActivityAt on parent task
      await tx.task.update({
        where: { id },
        data: { lastActivityAt: new Date() },
      });

      // 4. Return comment with attachments fully loaded
      return await tx.comment.findUniqueOrThrow({
        where: { id: comment.id },
        include: {
          author: true,
          attachments: true,
        },
      });
    });

    return newComment;
  });
};

export default taskRoutes;

