// @ts-nocheck
/**
 * ============================================================================
 * Supabase Edge Function: enroll-society
 * ============================================================================
 *
 * Auth: Supabase Auth (admin.createUser / deleteUser).
 * Data: Neon PostgreSQL via NEON_DATABASE_URL.
 *
 * Flow:
 *   1. Pre-check duplicate email (Neon + Supabase Auth)
 *   2. Bcrypt-hash password for Neon public.users.password
 *   3. Create Supabase Auth user (when user_id not supplied)
 *   4. Atomic Neon transaction: users → profiles → societies → role_requests
 *   5. On Neon failure: delete orphaned Supabase Auth user
 *
 * Secrets Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - NEON_DATABASE_URL
 * ============================================================================
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DUPLICATE_ACCOUNT_MESSAGE =
  'An account with this email already exists. Please log in.'

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

/** Ensure sslmode=require is present on the connection string. */
function ensureSslRequire(connectionUrl: string): string {
  if (/sslmode=/i.test(connectionUrl)) {
    return connectionUrl
  }
  const separator = connectionUrl.includes('?') ? '&' : '?'
  return `${connectionUrl}${separator}sslmode=require`
}

/** Resolve Neon application database connection string from NEON_DATABASE_URL. */
function resolveDatabaseUrl(): { url: string | null; error: string | null } {
  const databaseUrl = Deno.env.get('NEON_DATABASE_URL')?.trim()

  if (!databaseUrl) {
    return {
      url: null,
      error: 'NEON_DATABASE_URL is missing in Edge Function secrets.',
    }
  }

  const lower = databaseUrl.toLowerCase()

  if (lower.includes('supabase.co') || lower.includes('pooler.supabase.com')) {
    return {
      url: null,
      error:
        'NEON_DATABASE_URL must not point at Supabase Postgres. Use your Neon application database connection string.',
    }
  }

  const url = ensureSslRequire(databaseUrl)
  console.log('[DIAG] Database driver initialization', diagnosticContext({ ssl: 'require' }))

  return { url, error: null }
}

/** Create postgres.js client with SSL required. */
function createSqlClient(connectionUrl: string): ReturnType<typeof postgres> {
  return postgres(connectionUrl, {
    ssl: 'require',
    connect_timeout: 15,
  })
}

async function hashPassword(rawPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(rawPassword, salt)
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

function formatDatabaseError(serialized: Record<string, unknown>): string {
  const message = typeof serialized.message === 'string' ? serialized.message : ''
  const code = serialized.code

  if (code === '23505') {
    return 'A record with this information already exists. Please log in or contact support.'
  }
  if (code === '23503') {
    return 'Enrollment could not be completed because a related record is missing or invalid.'
  }
  if (message.toLowerCase().includes('connection')) {
    return 'Unable to reach the application database. Please try again shortly.'
  }
  if (message.trim()) {
    return message
  }
  return 'Unable to complete society enrollment. Please try again or contact support.'
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

/** True when the email is present in Neon public.users and Supabase Auth. */
async function isEmailFullyRegistered(
  sql: ReturnType<typeof postgres>,
  supabaseClient: ReturnType<typeof createClient>,
  email: string,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase()

  const neonRows = await sql`
    SELECT id FROM public.users
    WHERE lower(trim(email)) = ${normalizedEmail}
    LIMIT 1
  `

  if (neonRows.length === 0) {
    return false
  }

  const neonUserId = neonRows[0].id as string

  const { data: authById, error: authByIdError } = await supabaseClient.auth.admin.getUserById(neonUserId)
  if (!authByIdError && authById?.user) {
    return true
  }

  let page = 1
  const perPage = 200

  while (page <= 10) {
    const { data, error } = await supabaseClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.warn('[WARN] Auth listUsers failed during duplicate check:', error.message)
      return false
    }

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail)
    if (match) {
      return true
    }

    if (data.users.length < perPage) {
      break
    }
    page++
  }

  return false
}

type EnrollmentTxParams = {
  userId: string
  email: string
  passwordHash: string
  fullName: string
  phone: string | null
  userRole: string
  profileStatus: string
  societyName: string
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  societyStatus: string
  requestedRole: string
}

/** All Neon writes in one atomic transaction (auto-ROLLBACK on any failure). */
async function enrollSocietyInTransaction(
  sql: ReturnType<typeof postgres>,
  params: EnrollmentTxParams,
): Promise<Record<string, unknown>> {
  return sql.begin(async (tx) => {
    console.log(`[INFO] [TX] Upserting public.users id=${params.userId}`)
    await tx`
      INSERT INTO public.users (id, email, password)
      VALUES (${params.userId}, ${params.email}, ${params.passwordHash})
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        id = EXCLUDED.id,
        updated_at = NOW()
    `

    console.log(`[INFO] [TX] Upserting public.profiles user_id=${params.userId}`)
    await tx`
      INSERT INTO public.profiles (user_id, full_name, phone_number, role, status)
      VALUES (${params.userId}, ${params.fullName}, ${params.phone}, ${params.userRole}, ${params.profileStatus})
      ON CONFLICT (user_id) DO UPDATE SET
        phone_number = EXCLUDED.phone_number,
        full_name = EXCLUDED.full_name,
        updated_at = NOW()
    `

    console.log(`[INFO] [TX] Inserting society "${params.societyName}" into public.societies`)
    const societyResult = await tx`
      INSERT INTO public.societies (
        name,
        address,
        city,
        state,
        pincode,
        status,
        created_by,
        is_active
      )
      VALUES (
        ${params.societyName},
        ${params.address},
        ${params.city},
        ${params.state},
        ${params.pincode},
        ${params.societyStatus},
        ${params.userId},
        ${false}
      )
      RETURNING *
    `

    const society = societyResult[0]
    if (!society) {
      throw new Error('Society insert did not return a row.')
    }

    console.log(`[INFO] [TX] Inserting role_request for user_id=${params.userId}`)
    await tx`
      INSERT INTO public.role_requests (
        requester_id,
        requested_role,
        society_id,
        reason,
        status
      )
      VALUES (
        ${params.userId},
        ${params.requestedRole},
        ${society.id},
        ${`New society registration: ${params.societyName}`},
        ${'pending'}
      )
    `

    return society as Record<string, unknown>
  })
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
    const { url: dbUrl, error: dbConfigError } = resolveDatabaseUrl()
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

    sql = createSqlClient(dbUrl)
    supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const payload = await req.json()
    console.log('[INFO] Incoming enrollment payload received:', JSON.stringify(payload))

    const email = payload.email
    const rawPassword = payload.password
    const societyName = payload.societyName || payload.society_name || payload.name
    const fullName = payload.fullName || payload.full_name || payload.adminName || societyName
    const phone = payload.phone || payload.phone_number || null
    const address = payload.address || null
    const city = payload.city || null
    const state = payload.state || null
    const pincode = payload.pincode || payload.pin_code || null
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

    if (!rawPassword) {
      return jsonResponse(
        {
          success: false,
          stage: 'validation',
          error: 'Missing required field: password is mandatory.',
        },
        400,
      )
    }

    // Pre-check before creating a new Supabase Auth user (platform admin path).
    if (!existingUserId) {
      const alreadyRegistered = await isEmailFullyRegistered(sql, supabaseClient, email)
      if (alreadyRegistered) {
        console.warn(`[VALIDATION ERROR] Email already registered in Neon + Supabase Auth: ${email}`)
        return jsonResponse(
          {
            success: false,
            stage: 'validation',
            error: DUPLICATE_ACCOUNT_MESSAGE,
          },
          400,
        )
      }
    }

    console.log('[INFO] Hashing password for Neon public.users')
    const passwordHash = await hashPassword(rawPassword)

    if (existingUserId) {
      userId = existingUserId
      console.log(`[INFO] Reusing existing auth user id from payload: ${userId}`)
    } else {
      console.log(`[INFO] Provisioning Supabase Auth account for email: ${email}`)
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password: rawPassword,
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
      console.log(`[INFO] Supabase Auth user created (${userId}); starting atomic Neon transaction...`)
    }

    const profileStatus = existingUserId ? 'pending' : 'active'
    const userRole = 'SOCIETY_ADMIN'
    const societyStatus = 'PENDING'
    // app_role enum: super_admin (platform bootstrap) | admin (standard society admin)
    const requestedRole = existingUserId ? 'admin' : 'super_admin'

    try {
      const society = await enrollSocietyInTransaction(sql, {
        userId: userId!,
        email,
        passwordHash,
        fullName,
        phone,
        userRole,
        profileStatus,
        societyName,
        address,
        city,
        state,
        pincode,
        societyStatus,
        requestedRole,
      })

      console.log('[INFO] Society successfully created (transaction committed):', society)

      return jsonResponse(
        {
          success: true,
          message: 'Society enrolled successfully!',
          society,
          society_id: society?.id ?? null,
          user: {
            id: userId,
            email,
          },
          context: diagnosticContext({ userId }),
        },
        200,
      )
    } catch (dbError) {
      console.error('[DATABASE ERROR] Neon transaction failed — full error object:')
      console.error(dbError)
      console.error('[DATABASE ERROR] Serialized:', JSON.stringify(serializeError(dbError), null, 2))

      await rollbackAuthUser(supabaseClient, userId!, createdAuthUser)

      const serialized = serializeError(dbError)

      return jsonResponse(
        {
          success: false,
          stage: 'database',
          error: formatDatabaseError(serialized),
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
