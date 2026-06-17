import type { FastifyPluginAsync } from 'fastify'

/**
 * /tasks routes — CRUD, status transitions, assignments.
 * Placeholder: real implementation comes in CTMS-009.
 */
const taskRoutes: FastifyPluginAsync = async (server) => {
  server.get('/test', async () => ({
    route: 'tasks',
    status: 'ok',
  }))
}

export default taskRoutes
