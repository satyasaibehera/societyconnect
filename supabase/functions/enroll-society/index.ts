// @ts-nocheck
/**
 * ============================================================================
 * Supabase Edge Function: enroll-society
 * ============================================================================
 *
 *   1. Accepts multi-format frontend payload keys (camelCase or snake_case).
 *   2. Validates mandatory registration fields (email, password, society name).
 *   3. Provisions Supabase Auth credentials ONLY (or reuses an existing user_id).
 *   4. Writes application data to Neon PostgreSQL via DATABASE_URL:
 *      a) public.users (keyed by auth UUID; contact + lifecycle status)
 *      b) public.societies (created_by references auth.users UUID)
 *
 * Supabase Auth is never used for application profile/contact storage.
 * Secrets Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - DATABASE_URL (Neon DB Connection String)
 * ============================================================================
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let sql: ReturnType<typeof postgres> | null = null
  let supabaseClient: ReturnType<typeof createClient> | null = null
  let createdAuthUser = false
  let userId: string | null = null

  try {
    const dbUrl = Deno.env.get('DATABASE_URL')
    if (!dbUrl) {
      console.error('[CONFIG ERROR] DATABASE_URL secret is missing.')
      return jsonResponse(
        {
          success: false,
          stage: 'configuration',
          error: 'DATABASE_URL secret is missing in Supabase Edge Functions environment.',
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

    sql = postgres(dbUrl)
    supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    const payload = await req.json()
    console.log('[INFO] Incoming enrollment payload received:', JSON.stringify(payload))

    const email = payload.email
    const password = payload.password
    const societyName = payload.societyName || payload.society_name || payload.name
    const fullName = payload.fullName || payload.full_name || payload.adminName || societyName
    const phone = payload.phone || null
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

      console.log(`[INFO] Provisioning auth account for email: ${email}`)
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
      console.log(`[INFO] Supabase Auth user created (${userId}); provisioning Neon users + society...`)
    }

    const userStatus = existingUserId ? 'pending' : 'active'
    const userRole = 'SOCIETY_ADMIN'

    try {
      console.log(`[INFO] Upserting Neon public.users id=${userId} status=${userStatus}`)

      await sql`
        INSERT INTO public.users (id, email, full_name, phone_number, role, status, updated_at)
        VALUES (
          ${userId},
          ${email},
          ${fullName},
          ${phone},
          ${userRole},
          ${userStatus},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          phone_number = EXCLUDED.phone_number,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          updated_at = NOW()
      `

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
          context: {
            userId,
            email,
            societyName,
            authUserRolledBack: createdAuthUser,
          },
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
