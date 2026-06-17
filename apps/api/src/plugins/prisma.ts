import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { prisma, PrismaClient } from '@ctms/db'

/**
 * Prisma plugin — attaches the shared singleton client to the Fastify instance.
 * Connects on boot, disconnects on shutdown.
 */
const prismaPlugin: FastifyPluginAsync = async (server) => {
  await prisma.$connect()
  server.log.info('Prisma connected to database')

  server.decorate('prisma', prisma)

  server.addHook('onClose', async () => {
    server.log.info('Disconnecting Prisma…')
    await prisma.$disconnect()
  })
}

export default fp(prismaPlugin, {
  name: 'prisma',
})

// ── Type augmentation ───────────────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}
