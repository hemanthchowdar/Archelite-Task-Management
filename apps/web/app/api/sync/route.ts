import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@workspace/database';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const lastPulledAt = Number(url.searchParams.get('last_pulled_at') || '0');
    const employeeId = url.searchParams.get('employee_id');

    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'employee_id is required' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    const lastPulledDate = new Date(lastPulledAt);
    const isFirstSync = lastPulledAt === 0;
    const isAdmin = employee.accessRole === 'super_admin' || employee.accessRole === 'admin';

    // 1. Filtered Tasks query
    // If not admin, restrict to tasks they are involved in (creator, assignee, or approver)
    const taskFilters: any = {};
    if (!isAdmin) {
      taskFilters.OR = [
        { createdBy: employeeId },
        { assignments: { some: { employeeId } } },
        { approvalRequests: { some: { OR: [{ requestedById: employeeId }, { approverId: employeeId }] } } }
      ];
    }

    if (!isFirstSync) {
      taskFilters.OR = [
        ...(taskFilters.OR || []),
        { lastActivityAt: { gt: lastPulledDate } },
        { createdAt: { gt: lastPulledDate } }
      ];
    }

    const tasks = await prisma.task.findMany({
      where: taskFilters,
      include: {
        assignments: true,
        comments: !isFirstSync ? { where: { createdAt: { gt: lastPulledDate } } } : false,
        approvalRequests: !isFirstSync ? { where: { createdAt: { gt: lastPulledDate } } } : false,
      }
    });

    // Extract all task IDs for fetching child entries
    const taskIds = tasks.map(t => t.id);

    // 2. Fetch comments for those tasks
    const comments = await prisma.comment.findMany({
      where: {
        taskId: { in: taskIds },
        ...(isFirstSync ? {} : { createdAt: { gt: lastPulledDate } })
      }
    });

    // 3. Fetch assignments for those tasks
    const assignments = await prisma.taskAssignment.findMany({
      where: {
        taskId: { in: taskIds },
        ...(isFirstSync ? {} : { assignedAt: { gt: lastPulledDate } })
      }
    });

    // 4. Fetch approval requests for those tasks
    const approvalRequests = await prisma.approvalRequest.findMany({
      where: {
        taskId: { in: taskIds },
        ...(isFirstSync ? {} : { OR: [{ createdAt: { gt: lastPulledDate } }, { decidedAt: { gt: lastPulledDate } }] })
      }
    });

    // 5. Fetch global tables (Categories, Projects, Employees) - sent mostly on initial sync
    const categories = isFirstSync || lastPulledAt === 0 
      ? await prisma.category.findMany() 
      : [];
    const projects = isFirstSync || lastPulledAt === 0 
      ? await prisma.project.findMany() 
      : [];
    const employees = isFirstSync || lastPulledAt === 0
      ? await prisma.employee.findMany({ select: { id: true, name: true, phone: true, email: true, accessRole: true, orgLevel: true, status: true, preferredLanguage: true } })
      : await prisma.employee.findMany({
          where: { updatedAt: { gt: lastPulledDate } },
          select: { id: true, name: true, phone: true, email: true, accessRole: true, orgLevel: true, status: true, preferredLanguage: true }
        });

    return NextResponse.json({
      changes: {
        employees: { created: isFirstSync ? employees : [], updated: !isFirstSync ? employees : [], deleted: [] },
        categories: { created: categories, updated: [], deleted: [] },
        projects: { created: projects, updated: [], deleted: [] },
        tasks: { created: tasks, updated: [], deleted: [] },
        comments: { created: comments, updated: [], deleted: [] },
        task_assignments: { created: assignments, updated: [], deleted: [] },
        approval_requests: { created: approvalRequests, updated: [], deleted: [] }
      },
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('Pull Sync Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to pull changes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { changes, employeeId } = await req.json();

    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'employeeId is required' }, { status: 400 });
    }

    if (!changes) {
      return NextResponse.json({ success: false, error: 'No changes provided' }, { status: 400 });
    }

    console.log(`Processing push synchronization for user ${employeeId}...`);

    // Run all sync writes inside a database transaction to ensure transactional integrity
    await prisma.$transaction(async (tx) => {
      // 1. Process Tasks
      if (changes.tasks) {
        const { created = [], updated = [] } = changes.tasks;

        for (const task of created) {
          await tx.task.create({
            data: {
              id: task.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: task.status,
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
              categoryId: task.categoryId,
              projectId: task.projectId || null,
              createdBy: employeeId,
              createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
              lastActivityAt: new Date(),
            }
          });
          // Write initial audit log
          await tx.auditLog.create({
            data: {
              taskId: task.id,
              actorId: employeeId,
              action: 'CREATE_TASK',
              toValue: task.status
            }
          });
        }

        for (const task of updated) {
          const original = await tx.task.findUnique({ where: { id: task.id } });
          await tx.task.update({
            where: { id: task.id },
            data: {
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: task.status,
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
              categoryId: task.categoryId,
              projectId: task.projectId || null,
              lastActivityAt: new Date(),
            }
          });

          // Write audit log if status changed
          if (original && original.status !== task.status) {
            await tx.auditLog.create({
              data: {
                taskId: task.id,
                actorId: employeeId,
                action: 'UPDATE_STATUS',
                fromValue: original.status,
                toValue: task.status
              }
            });
          }
        }
      }

      // 2. Process Comments
      if (changes.comments) {
        const { created = [] } = changes.comments;
        for (const comm of created) {
          await tx.comment.create({
            data: {
              id: comm.id,
              taskId: comm.taskId,
              authorId: employeeId,
              body: comm.body,
              type: comm.type || 'text',
              createdAt: comm.createdAt ? new Date(comm.createdAt) : new Date(),
            }
          });
          // Update last activity on task
          await tx.task.update({
            where: { id: comm.taskId },
            data: { lastActivityAt: new Date() }
          });
        }
      }

      // 3. Process Assignments
      if (changes.task_assignments) {
        const { created = [] } = changes.task_assignments;
        for (const assign of created) {
          await tx.taskAssignment.upsert({
            where: {
              taskId_employeeId: {
                taskId: assign.taskId,
                employeeId: assign.employeeId
              }
            },
            create: {
              taskId: assign.taskId,
              employeeId: assign.employeeId,
              role: assign.role || 'collaborator',
              assignedBy: employeeId,
            },
            update: {
              role: assign.role || 'collaborator',
            }
          });
        }
      }

      // 4. Process Approval Requests
      if (changes.approval_requests) {
        const { created = [], updated = [] } = changes.approval_requests;

        for (const app of created) {
          await tx.approvalRequest.create({
            data: {
              id: app.id,
              taskId: app.taskId,
              requestedById: employeeId,
              approverId: app.approverId,
              status: 'pending',
              createdAt: app.createdAt ? new Date(app.createdAt) : new Date(),
            }
          });
        }

        for (const app of updated) {
          await tx.approvalRequest.update({
            where: { id: app.id },
            data: {
              status: app.status,
              decisionComment: app.decisionComment,
              decidedAt: new Date(),
            }
          });

          // Write audit log for decisions
          await tx.auditLog.create({
            data: {
              taskId: app.taskId,
              actorId: employeeId,
              action: `APPROVAL_${app.status.toUpperCase()}`,
              toValue: app.decisionComment
            }
          });
        }
      }
    });

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error: any) {
    console.error('Push Sync Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to push changes' }, { status: 500 });
  }
}
