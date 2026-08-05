// @ts-nocheck
/**
 * ============================================================================
 * Supabase Edge Function: enroll-society
 * ============================================================================
 *
 * Auth: Supabase Auth ONLY (admin.createUser / deleteUser).
 * Data: Neon PostgreSQL ONLY via NEON_DATABASE_URL → *.neon.tech
 *
 * Dual-table upsert on Neon:
 *   1. public.users   — id, email, password_hash (SUPABASE_MANAGED_AUTH)
 *   2. public.profiles — user_id, full_name, phone_number, role, status
 *   3. public.societies — society record
 *
 * Secrets Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - NEON_DATABASE_URL (required — direct Neon @ep-....neon.tech connection)
 * ============================================================================
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_MANAGED_AUTH = 'SUPABASE_MANAGED_AUTH'

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

const NEON_CONNECTION_LABEL = 'NEON_DATABASE_URL'

function diagnosticContext(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { neonConnection: NEON_CONNECTION_LABEL, ...extra }
}

/** Ensure sslmode=require is present on the Neon connection string. */
function ensureSslRequire(connectionUrl: string): string {
  if (/sslmode=/i.test(connectionUrl)) {
    return connectionUrl
  }
  const separator = connectionUrl.includes('?') ? '&' : '?'
  return `${connectionUrl}${separator}sslmode=require`
}

/**
 * Resolve Neon connection string — strictly NEON_DATABASE_URL only.
 */
function resolveNeonDatabaseUrl(): { url: string | null; error: string | null } {
  const neonUrl = Deno.env.get('NEON_DATABASE_URL')?.trim()

  if (!neonUrl) {
    return {
      url: null,
      error: 'NEON_DATABASE_URL is missing in Edge Function secrets.',
    }
  }

  const lower = neonUrl.toLowerCase()

  if (lower.includes('supabase.co') || lower.includes('pooler.supabase.com')) {
    return {
      url: null,
      error:
        'NEON_DATABASE_URL must not point at Supabase Postgres. Use your @ep-....neon.tech connection string.',
    }
  }

  if (!lower.includes('neon.tech')) {
    return {
      url: null,
      error: 'NEON_DATABASE_URL must point to a Neon host (*.neon.tech).',
    }
  }

  const url = ensureSslRequire(neonUrl)
  console.log('[DIAG] Neon driver initialization', diagnosticContext({ ssl: 'require' }))

  return { url, error: null }
}

/** Create postgres.js client against Neon with SSL required. */
function createNeonSqlClient(connectionUrl: string): ReturnType<typeof postgres> {
  return postgres(connectionUrl, {
    ssl: 'require',
    connect_timeout: 15,
  })
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err === null || err === undefined) {
    return { message: 'Unknown error' }
  }

  if (typeof err === 'object') {
    const record = err as Record<string, unknown>
    const serialized: Record<string, unknown> = {}

    for (const key of [
      'name',
      'message',
      'code',
      'status',
      'details',
      'hint',
      'detail',
      'table',
      'schema',
      'column',
      'constraint',
      'severity',
      'routine',
      'file',
      'line',
    ]) {
      if (record[key] !== undefined && record[key] !== null) {
        serialized[key] = record[key]
      }
    }

    if (Object.keys(serialized).length > 0) {
      return serialized
    }
  }

  return { message: String(err) }
}

function authErrorStatus(authError: { status?: number; code?: string; message?: string }): number {
  const message = (authError.message || '').toLowerCase()
  if (
    authError.status === 422 ||
    authError.code === 'email_exists' ||
    message.includes('already been registered') ||
    message.includes('already registered')
  ) {
    return 409
  }
  return authError.status && authError.status >= 400 && authError.status < 600
    ? authError.status
    : 400
}

function databaseErrorStatus(dbError: { code?: string }): number {
  if (dbError.code === '23505') return 409
  if (dbError.code === '23503') return 400
  return 500
}

async function rollbackAuthUser(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
  createdByThisRequest: boolean,
): Promise<void> {
  if (!createdByThisRequest) return

  console.warn(`[INFO] Rolling back orphaned Supabase Auth user: ${userId}`)
  const { error } = await supabaseClient.auth.admin.deleteUser(userId)
  if (error) {
    console.error('[AUTH ROLLBACK ERROR] Failed to delete orphaned auth user:', JSON.stringify(error, null, 2))
  }
}

/** Step 1: root credential row in Neon public.users */
async function upsertNeonUserCredential(
  sql: ReturnType<typeof postgres>,
  userId: string,
  email: string,
): Promise<void> {
  await sql`
    INSERT INTO public.users (id, email, password_hash)
    VALUES (${userId}, ${email}, ${SUPABASE_MANAGED_AUTH})
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email
  `
}

/** Step 2: profile metadata in Neon public.profiles */
async function upsertNeonUserProfile(
  sql: ReturnType<typeof postgres>,
  userId: string,
  fullName: string,
  phoneNumber: string | null,
  role: string,
  status: string,
): Promise<void> {
  await sql`
    INSERT INTO public.profiles (user_id, full_name, phone_number, role, status)
    VALUES (${userId}, ${fullName}, ${phoneNumber}, ${role}, ${status})
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      phone_number = EXCLUDED.phone_number,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      updated_at = NOW()
  `
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let sql: ReturnType<typeof postgres> | null = null
  let supabaseClient: ReturnType<typeof createClient> | null = null
  let createdAuthUser = false
  let userId: string | null = null

  try {
    const { url: dbUrl, error: dbConfigError } = resolveNeonDatabaseUrl()
    if (!dbUrl || dbConfigError) {
      console.error('[CONFIG ERROR]', dbConfigError)
      return jsonResponse(
        {
          success: false,
          stage: 'configuration',
          error: dbConfigError,
          context: diagnosticContext(),
        },
        500,
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[CONFIG ERROR] Supabase project secrets (URL/Service Role Key) are missing.')
      return jsonResponse(
        {
          success: false,
          stage: 'configuration',
          error: 'Supabase URL or Service Role Key secret is unconfigured.',
        },
        500,
      )
    }

    sql = createNeonSqlClient(dbUrl)
    supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const payload = await req.json()
    console.log('[INFO] Incoming enrollment payload received:', JSON.stringify(payload))

    const email = payload.email
    const password = payload.password
    const societyName = payload.societyName || payload.society_name || payload.name
    const fullName = payload.fullName || payload.full_name || payload.adminName || societyName
    const phone = payload.phone || payload.phone_number || null
    const address = payload.address || null
    const city = payload.city || null
    const state = payload.state || null
    const existingUserId = payload.user_id || payload.userId || null

    if (!email || !societyName) {
      console.warn('[VALIDATION ERROR] Missing mandatory parameters:', {
        hasEmail: Boolean(email),
        hasSocietyName: Boolean(societyName),
      })
      return jsonResponse(
        {
          success: false,
          stage: 'validation',
          error: 'Missing required fields: email and societyName/society_name are mandatory.',
        },
        400,
      )
    }

    if (existingUserId) {
      userId = existingUserId
      console.log(`[INFO] Reusing existing auth user id from payload: ${userId}`)
    } else {
      if (!password) {
        return jsonResponse(
          {
            success: false,
            stage: 'validation',
            error: 'Missing required field: password is mandatory when user_id is not provided.',
          },
          400,
        )
      }

      console.log(`[INFO] Provisioning Supabase Auth account for email: ${email}`)
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'SOCIETY_ADMIN',
        },
      })

      if (authError) {
        console.error('[AUTH ERROR] Supabase Auth admin.createUser failed — full error object:')
        console.error(JSON.stringify(authError, null, 2))

        return jsonResponse(
          {
            success: false,
            stage: 'auth',
            error: authError.message || 'Supabase Auth user creation failed.',
            code: authError.code ?? authError.status ?? null,
            details: serializeError(authError),
          },
          authErrorStatus(authError),
        )
      }

      if (!authData?.user?.id) {
        console.error('[AUTH ERROR] createUser succeeded but no user id was returned:', authData)
        return jsonResponse(
          {
            success: false,
            stage: 'auth',
            error: 'Supabase Auth returned no user id after createUser.',
            details: serializeError(authData),
          },
          500,
        )
      }

      userId = authData.user.id
      createdAuthUser = true
      console.log(`[INFO] Supabase Auth user created (${userId}); provisioning Neon users + profiles + society...`)
    }

    const profileStatus = existingUserId ? 'pending' : 'active'
    const userRole = 'SOCIETY_ADMIN'

    try {
      console.log(`[INFO] Upserting Neon public.users credential id=${userId}`)
      await upsertNeonUserCredential(sql, userId, email)

      console.log(`[INFO] Upserting Neon public.profiles user_id=${userId} status=${profileStatus}`)
      await upsertNeonUserProfile(sql, userId, fullName, phone, userRole, profileStatus)

      console.log(`[INFO] Inserting society record "${societyName}" into public.societies...`)

      const isActive =
        payload.is_active ?? payload.isActive ?? (existingUserId ? false : true)

      const societyResult = await sql`
        INSERT INTO public.societies (
          name,
          address,
          city,
          state,
          created_by,
          is_active
        )
        VALUES (
          ${societyName},
          ${address},
          ${city},
          ${state},
          ${userId},
          ${isActive}
        )
        RETURNING *
      `

      console.log('[INFO] Society successfully created:', societyResult[0])

      return jsonResponse(
        {
          success: true,
          message: 'Society enrolled successfully!',
          society: societyResult[0],
          society_id: societyResult[0]?.id ?? null,
          user: {
            id: userId,
            email,
          },
          context: diagnosticContext({ userId }),
        },
        200,
      )
    } catch (dbError) {
      console.error('[DATABASE ERROR] Neon PostgreSQL operation failed — full error object:')
      console.error(dbError)
      console.error('[DATABASE ERROR] Serialized:', JSON.stringify(serializeError(dbError), null, 2))

      await rollbackAuthUser(supabaseClient, userId!, createdAuthUser)

      const serialized = serializeError(dbError)
      const dbMessage =
        typeof serialized.message === 'string'
          ? serialized.message
          : 'Neon database operation failed during society enrollment.'

      return jsonResponse(
        {
          success: false,
          stage: 'database',
          error: dbMessage,
          code: serialized.code ?? null,
          detail: serialized.detail ?? null,
          hint: serialized.hint ?? null,
          table: serialized.table ?? null,
          constraint: serialized.constraint ?? null,
          details: serialized,
          context: diagnosticContext({
            userId,
            email,
            societyName,
            authUserRolledBack: createdAuthUser,
          }),
        },
        databaseErrorStatus(serialized as { code?: string }),
      )
    }
  } catch (unexpectedError) {
    console.error('[UNEXPECTED ERROR] enroll-society failed — full error object:')
    console.error(unexpectedError)
    console.error(
      '[UNEXPECTED ERROR] Serialized:',
      JSON.stringify(serializeError(unexpectedError), null, 2),
    )

    if (supabaseClient && userId && createdAuthUser) {
      await rollbackAuthUser(supabaseClient, userId, true)
    }

    const serialized = serializeError(unexpectedError)

    return jsonResponse(
      {
        success: false,
        stage: 'unknown',
        error:
          typeof serialized.message === 'string'
            ? serialized.message
            : 'An unexpected error occurred during society enrollment.',
        details: serialized,
        context: diagnosticContext(),
      },
      500,
    )
  } finally {
    if (sql) {
      try {
        await sql.end({ timeout: 5 })
      } catch (closeError) {
        console.warn('[WARN] Failed to close Neon SQL connection:', closeError)
      }
    }
  }
})
