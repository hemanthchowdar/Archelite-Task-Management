import 'dotenv/config'
import { z } from 'zod'

/**
 * Environment variable schema — validated at startup.
 * The app refuses to boot if any required variable is missing or malformed.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required' })
    .min(1, 'DATABASE_URL must not be empty'),

  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters'),

  PORT: z
    .string()
    .default('3001')
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535)),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  CORS_ORIGIN: z.string().default('*'),
})

export type Env = z.infer<typeof envSchema>

// ── Parse & validate ────────────────────────────────────
const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('\n❌  Invalid environment variables:\n')
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join('.')} — ${issue.message}`)
  }
  console.error('')
  process.exit(1)
}

export const config = parsed.data
