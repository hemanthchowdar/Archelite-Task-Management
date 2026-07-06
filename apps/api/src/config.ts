import dotenv from 'dotenv'
import path from 'path'

// Load local apps/api/.env first
dotenv.config()
// Load root .env to inherit shared monorepo configurations
dotenv.config({ path: path.join(__dirname, '../../../.env') })
import { z } from 'zod'

/**
 * Environment variable schema — validated at startup.
 * The app refuses to boot if any required variable is missing or malformed.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z
    .string()
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

  // SMS Gateway (MSG91) - Optional, fallback to console logging
  MSG91_API_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().default('NIRMAN'),
  MSG91_TEMPLATE_ID: z.string().optional(),

  // Redis / Upstash config - Optional, fallback to in-memory store
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
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
