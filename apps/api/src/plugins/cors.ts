import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config'

/**
 * CORS plugin.
 *   - development: allows ALL origins (for mobile emulator, admin panel, etc.)
 *   - production:  restricts to the configured CORS_ORIGIN
 */
const corsPlugin: FastifyPluginAsync = async (server) => {
  await server.register(cors, {
    origin: config.NODE_ENV === 'development' ? true : config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
}

export default fp(corsPlugin, {
  name: 'cors',
})
