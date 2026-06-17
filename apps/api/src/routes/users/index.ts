import type { FastifyPluginAsync } from 'fastify'

/**
 * /users routes — employee listing, profile, org-level queries.
 * Placeholder: real implementation comes in CTMS-010.
 */
const userRoutes: FastifyPluginAsync = async (server) => {
  server.get('/test', async () => ({
    route: 'users',
    status: 'ok',
  }))
}

export default userRoutes
