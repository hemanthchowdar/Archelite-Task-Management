import Fastify from 'fastify'
import type { Employee } from '@ctms/types'

const app = Fastify({ logger: true })

app.get('/health', async () => {
  const testEmployee: Pick<Employee, 'id' | 'name' | 'role'> = {
    id: '123',
    name: 'Test User',
    role: 'admin'
  }
  return { 
    status: 'ok',
    testImport: testEmployee.role
  }
})

const start = async () => {
  try {
    await app.listen({ port: 3001 })
    console.log('API running at http://localhost:3001')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
