import type { FastifyPluginAsync } from 'fastify'

/**
 * /notifications routes — push tokens, read status, listing.
 * Placeholder: real implementation comes in CTMS-015.
 */
const notificationRoutes: FastifyPluginAsync = async (server) => {
  server.get('/test', async () => ({
    route: 'notifications',
    status: 'ok',
  }))
}

export default notificationRoutes
