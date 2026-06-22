import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
// @ts-ignore
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { Employee } from '@ctms/db';
import { config } from '../config';

// ─── CASL Permissions Typing ─────────────────────────────────────────
export type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
export type Subjects = 'Task' | 'Employee' | 'Comment' | 'Attachment' | 'all';
export type AppAbility = MongoAbility<[Actions, Subjects]>;

/**
 * Define CASL rules for an employee based on their access role.
 */
export function defineAbilityFor(employee: Employee): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (employee.accessRole === 'super_admin') {
    can('manage', 'all');
  } else if (employee.accessRole === 'admin') {
    can('manage', 'Task');
    can('manage', 'Employee');
    // Admins cannot edit or delete super_admins
    cannot('update', 'Employee', { accessRole: 'super_admin' } as any);
    cannot('delete', 'Employee', { accessRole: 'super_admin' } as any);
  } else {
    // Member role
    // Basic permissions (refined at route controller level for database check)
    can('read', 'Task');
    can('update', 'Task');
    can('create', 'Task');
    can('manage', 'Comment');
    can('manage', 'Attachment');
  }

  return build();
}

// ─── Fastify Types Declaration ───────────────────────────────────────
import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: Employee;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    ability?: AppAbility;
  }
}

// ─── Plugin Implementation ───────────────────────────────────────────
export default fp(async (fastify) => {
  // Register JWT plugin
  await fastify.register(jwt, {
    secret: config.JWT_SECRET,
  });

  // Global Auth Hook
  fastify.addHook('preHandler', async (request, reply) => {
    const isPublic =
      request.url === '/' ||
      request.url.startsWith('/health') ||
      request.url.startsWith('/auth');

    if (isPublic) {
      return;
    }

    try {
      // 1. Verify JWT
      await request.jwtVerify();
      
      const payload = request.user as any as { id: string; role: string; orgLevel: number };
      if (!payload || !payload.id) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token payload' });
      }

      // 2. Load employee from database
      const employee = await fastify.prisma.employee.findUnique({
        where: { id: payload.id },
      });

      if (!employee) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Employee not found' });
      }

      if (employee.status === 'inactive') {
        return reply.status(403).send({ error: 'Forbidden', message: 'Your account has been deactivated' });
      }

      // 3. Attach employee and ability to request context
      request.user = employee;
      request.ability = defineAbilityFor(employee);
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
  });
});
