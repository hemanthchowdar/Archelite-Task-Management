import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export * from '@prisma/client';
export { AccessRole, OrgStatus, Priority, TaskStatus, AssignmentRole, CommentType, ApprovalStatus } from '@prisma/client';
export type { Employee, Task, TaskAssignment, Comment, Attachment, ApprovalRequest, Category, Project, AuditLog, Notification } from '@prisma/client';
