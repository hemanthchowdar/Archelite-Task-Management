import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cacheService } from '../../services/cache';
import { sendOtpSms } from '../../services/sms';

const authRoutes: FastifyPluginAsync = async (server) => {
  
  // ─── POST /auth/request-otp ────────────────────────────────────────
  server.post('/request-otp', async (request, reply) => {
    const bodySchema = z.object({
      phone: z.string().min(10, 'Phone must be at least 10 digits'),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    // Normalize phone number to full +91XXXXXXXXXX
    let phone = parsed.data.phone.trim();
    if (!phone.startsWith('+')) {
      if (phone.length === 10) {
        phone = `+91${phone}`;
      } else {
        phone = `+${phone}`;
      }
    }

    // 1. Rate Limiting (Max 5 attempts per phone per 10 mins)
    const rateLimitKey = `attempts_limit:${phone}`;
    const attemptsCountVal = await cacheService.get(rateLimitKey);
    const attempts = attemptsCountVal ? parseInt(attemptsCountVal, 10) : 0;

    if (attempts >= 5) {
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again in 10 minutes.',
      });
    }

    // 2. Generate 6-digit OTP
    // Default mock OTP to '123456' for the two seeded test accounts in development
    let otp = '';
    if (phone === '+919999999999' || phone === '+918888888888') {
      otp = '123456';
    } else {
      otp = Math.floor(100000 + Math.random() * 900000).toString();
    }

    // 3. Hash OTP and store in cache with 5min (300s) TTL
    const hashedOtp = await bcrypt.hash(otp, 10);
    await cacheService.set(`otp:${phone}`, hashedOtp, 300);

    // 4. Dispatch OTP SMS
    const smsSent = await sendOtpSms(phone, otp);
    if (!smsSent) {
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to send OTP SMS',
      });
    }

    return { success: true, message: 'OTP sent successfully' };
  });

  // ─── POST /auth/verify-otp ─────────────────────────────────────────
  server.post('/verify-otp', async (request, reply) => {
    const bodySchema = z.object({
      phone: z.string(),
      otp: z.string().length(6, 'OTP must be 6 digits'),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    let phone = parsed.data.phone.trim();
    if (!phone.startsWith('+')) {
      if (phone.length === 10) {
        phone = `+91${phone}`;
      } else {
        phone = `+${phone}`;
      }
    }
    const otp = parsed.data.otp.trim();

    // 1. Get OTP from cache
    const cachedHash = await cacheService.get(`otp:${phone}`);
    if (!cachedHash) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'OTP has expired or was not requested',
      });
    }

    // 2. Validate OTP
    const isCorrect = await bcrypt.compare(otp, cachedHash);
    if (!isCorrect) {
      // Increment rate limiter count
      const rateLimitKey = `attempts_limit:${phone}`;
      const failedAttempts = await cacheService.incr(rateLimitKey);

      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Incorrect OTP code entered',
        attemptsLeft: Math.max(0, 5 - failedAttempts),
      });
    }

    // OTP matched: reset rate limiter & clean up cache
    await cacheService.del(`attempts_limit:${phone}`);
    await cacheService.del(`otp:${phone}`);

    // 3. Find Employee in DB
    const employee = await server.prisma.employee.findUnique({
      where: { phone },
    });

    if (!employee) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'This phone number is not registered in the system',
      });
    }

    // 4. Check status
    if (employee.status === 'inactive') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Your employee profile has been deactivated',
      });
    }

    // 5. Generate Access Token & Refresh Token
    const accessToken = server.jwt.sign({
      id: employee.id,
      role: employee.accessRole,
      orgLevel: employee.orgLevel,
    }, { expiresIn: '15m' });

    const refreshTokenString = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await server.prisma.refreshToken.create({
      data: {
        token: refreshTokenString,
        employeeId: employee.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
      employee,
    };
  });

  // ─── POST /auth/refresh ───────────────────────────────────────────
  server.post('/refresh', async (request, reply) => {
    const bodySchema = z.object({
      refreshToken: z.string(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const { refreshToken } = parsed.data;

    // 1. Locate refresh token in DB
    const rt = await server.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { employee: true },
    });

    if (!rt || rt.expiresAt < new Date()) {
      if (rt) {
        // Clean up expired token
        await server.prisma.refreshToken.delete({ where: { id: rt.id } }).catch(() => {});
      }
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh session',
      });
    }

    // 2. Validate employee status
    if (rt.employee.status === 'inactive') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Employee profile is deactivated',
      });
    }

    // 3. Rotate tokens (delete old, create new)
    await server.prisma.refreshToken.delete({ where: { id: rt.id } }).catch(() => {});

    const newAccessToken = server.jwt.sign({
      id: rt.employee.id,
      role: rt.employee.accessRole,
      orgLevel: rt.employee.orgLevel,
    }, { expiresIn: '15m' });

    const newRefreshTokenString = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await server.prisma.refreshToken.create({
      data: {
        token: newRefreshTokenString,
        employeeId: rt.employeeId,
        expiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenString,
    };
  });

  // ─── POST /auth/logout ────────────────────────────────────────────
  server.post('/logout', async (request, reply) => {
    const bodySchema = z.object({
      refreshToken: z.string(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0].message,
      });
    }

    const { refreshToken } = parsed.data;

    // Delete refresh token from DB to invalidate session
    await server.prisma.refreshToken.delete({
      where: { token: refreshToken },
    }).catch(() => {});

    return { success: true, message: 'Logged out successfully' };
  });
};

export default authRoutes;
