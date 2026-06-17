import type { FastifyPluginAsync } from 'fastify'

/**
 * /auth routes — login, OTP, token refresh.
 * Placeholder: real implementation comes in CTMS-005.
 */
const authRoutes: FastifyPluginAsync = async (server) => {
  server.get('/test', async () => ({
    route: 'auth',
    status: 'ok',
  }))
}

export default authRoutes
