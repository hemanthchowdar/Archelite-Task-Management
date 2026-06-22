import Fastify from 'fastify'
import { config } from './config'

// plugins
import prismaPlugin from './plugins/prisma'
import corsPlugin from './plugins/cors'
import authPlugin from './plugins/auth'

// domain routes
import authRoutes from './routes/auth'
import taskRoutes from './routes/tasks'
import userRoutes from './routes/users'
import employeeRoutes from './routes/employees'
import notificationRoutes from './routes/notifications'

// ── Build server ────────────────────────────────────────
const server = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    ...(config.NODE_ENV !== 'production' && {
      transport: { target: 'pino-pretty' },
    }),
  },
})

async function main() {
  // ── Plugins (order matters) ─────────────────────────
  await server.register(corsPlugin)
  await server.register(prismaPlugin)
  await server.register(authPlugin)

  // ── Root route (Welcome & API Info) ─────────────────
  server.get('/', async () => {
    return {
      name: 'CTMS API (Construction Task Management System)',
      status: 'running',
      version: '1.0.0',
      environment: config.NODE_ENV,
      endpoints: {
        health: '/health',
        auth: '/auth/test',
        tasks: '/tasks/test',
        users: '/users/test',
        employees: '/employees',
        notifications: '/notifications/test',
      },
    }
  })

  // ── Health check ────────────────────────────────────
  server.get('/health', async (request) => {
    await request.server.prisma.$queryRaw`SELECT 1`
    return {
      status: 'ok',
      db: 'connected',
      environment: config.NODE_ENV,
      uptime: Math.round(process.uptime()),
    }
  })

  // ── Domain routes ───────────────────────────────────
  await server.register(authRoutes, { prefix: '/auth' })
  await server.register(taskRoutes, { prefix: '/tasks' })
  await server.register(userRoutes, { prefix: '/users' })
  await server.register(employeeRoutes, { prefix: '/employees' })
  await server.register(notificationRoutes, { prefix: '/notifications' })

  // ── Start listening ─────────────────────────────────
  await server.listen({ port: config.PORT, host: '0.0.0.0' })
  console.log(`\n🚀  CTMS API ready at http://localhost:${config.PORT}\n`)
}

main().catch((err) => {
  server.log.error(err)
  process.exit(1)
})
