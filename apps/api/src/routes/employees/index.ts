import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
// @ts-ignore
import { subject } from '@casl/ability';
import { AccessRole, EmployeeStatus } from '@ctms/db';

const employeeRoutes: FastifyPluginAsync = async (server) => {
  
  // ─── GET /employees (List & Search) ──────────────────────────────
  server.get('/', async (request, reply) => {
    if (!request.ability || !request.ability.can('read', 'Employee')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have permission to view employees',
      });
    }

    const querySchema = z.object({
      page: z.string().optional().transform(v => v ? parseInt(v, 10) : 1),
      limit: z.string().optional().transform(v => v ? parseInt(v, 10) : 10),
      search: z.string().optional(),
      status: z.enum(['active', 'inactive']).optional(),
      role: z.enum(['super_admin', 'admin', 'member']).optional(),
    });

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const { page, limit, search, status, role } = parsed.data;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (role) {
      where.accessRole = role;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      server.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      server.prisma.employee.count({ where }),
    ]);

    const hasNextPage = skip + employees.length < total;

    return {
      data: employees,
      pagination: {
        total,
        page,
        limit,
        hasNextPage,
      },
    };
  });

  // ─── GET /employees/:id ───────────────────────────────────────────
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const targetEmployee = await server.prisma.employee.findUnique({
      where: { id },
    });

    if (!targetEmployee) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Employee not found',
      });
    }

    // A user can read their own profile, or admins/super admins can read any profile
    const isSelf = request.user?.id === id;
    const canRead = isSelf || (request.ability && request.ability.can('read', 'Employee'));

    if (!canRead) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have permission to view this employee profile',
      });
    }

    return targetEmployee;
  });

  // ─── POST /employees (Create) ─────────────────────────────────────
  server.post('/', async (request, reply) => {
    if (!request.ability || !request.ability.can('create', 'Employee')) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have permission to create employees',
      });
    }

    const bodySchema = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      phone: z.string().min(10, 'Phone number must be valid'),
      email: z.string().email('Invalid email address').optional().nullable(),
      employeeId: z.string().optional().nullable(),
      accessRole: z.enum(['admin', 'member']).default('member'),
      orgLevel: z.number().int().min(1).default(1),
      address: z.string().optional().nullable(),
      bloodGroup: z.string().optional().nullable(),
      dateOfBirth: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const data = parsed.data;

    // Normalize phone number format
    let phone = data.phone.trim();
    if (!phone.startsWith('+')) {
      if (phone.length === 10) {
        phone = `+91${phone}`;
      } else {
        phone = `+${phone}`;
      }
    }

    // Check unique phone number
    const existingPhone = await server.prisma.employee.findUnique({
      where: { phone },
    });
    if (existingPhone) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'An employee with this phone number already exists',
      });
    }

    // Check unique email if supplied
    if (data.email) {
      const existingEmail = await server.prisma.employee.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'An employee with this email address already exists',
        });
      }
    }

    const employee = await server.prisma.employee.create({
      data: {
        name: data.name,
        phone,
        email: data.email,
        employeeId: data.employeeId,
        accessRole: data.accessRole as AccessRole,
        orgLevel: data.orgLevel,
        address: data.address,
        bloodGroup: data.bloodGroup,
        dateOfBirth: data.dateOfBirth,
        status: EmployeeStatus.active,
      },
    });

    return reply.status(201).send(employee);
  });

  // ─── PUT /employees/:id (Update) ──────────────────────────────────
  server.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const targetEmployee = await server.prisma.employee.findUnique({
      where: { id },
    });

    if (!targetEmployee) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Employee not found',
      });
    }

    const isSelf = request.user?.id === id;
    
    // Check permission using CASL ability
    const canUpdate = isSelf || (request.ability && request.ability.can('update', subject('Employee', targetEmployee)));
    if (!canUpdate) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have permission to update this employee profile',
      });
    }

    const bodySchema = z.object({
      name: z.string().min(2).optional(),
      phone: z.string().min(10).optional(),
      email: z.string().email().optional().nullable(),
      employeeId: z.string().optional().nullable(),
      accessRole: z.enum(['super_admin', 'admin', 'member']).optional(),
      orgLevel: z.number().int().min(1).optional(),
      address: z.string().optional().nullable(),
      bloodGroup: z.string().optional().nullable(),
      dateOfBirth: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
      status: z.enum(['active', 'inactive']).optional(),
      preferredLanguage: z.enum(['en', 'hi', 'te']).optional().nullable(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const data = parsed.data;

    // Security check: normal employees/admins cannot elevate roles or deactivate profiles
    if (isSelf && !request.ability.can('manage', 'all')) {
      // Prevent changing their own administrative fields
      delete data.accessRole;
      delete data.orgLevel;
      delete data.status;
    }

    // If changing role to super_admin, require caller to be super_admin
    if (data.accessRole === 'super_admin' && request.user?.accessRole !== 'super_admin') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only super admins can assign the super_admin role',
      });
    }

    const updateData: any = { ...data };

    if (data.phone) {
      let phone = data.phone.trim();
      if (!phone.startsWith('+')) {
        if (phone.length === 10) {
          phone = `+91${phone}`;
        } else {
          phone = `+${phone}`;
        }
      }
      
      const duplicatePhone = await server.prisma.employee.findFirst({
        where: { phone, NOT: { id } },
      });
      if (duplicatePhone) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Phone number already in use by another profile',
        });
      }
      updateData.phone = phone;
    }

    const updated = await server.prisma.employee.update({
      where: { id },
      data: updateData,
    });

    return updated;
  });

  // ─── DELETE /employees/:id (Soft Deactivate) ──────────────────────
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const targetEmployee = await server.prisma.employee.findUnique({
      where: { id },
    });

    if (!targetEmployee) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Employee not found',
      });
    }

    if (!request.ability || !request.ability.can('delete', subject('Employee', targetEmployee))) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have permission to delete/deactivate this employee',
      });
    }

    // Soft delete: set status to inactive
    await server.prisma.employee.update({
      where: { id },
      data: { status: EmployeeStatus.inactive },
    });

    return {
      success: true,
      message: 'Employee profile soft-deactivated successfully',
    };
  });
};

export default employeeRoutes;
