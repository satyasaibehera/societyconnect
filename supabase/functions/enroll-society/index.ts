// @ts-nocheck
/**
 * ============================================================================
 * Supabase Edge Function: enroll-society
 * ============================================================================
 * 
 * Architecture & Responsibility:
 *   1. Accepts multi-format frontend payload keys (camelCase or snake_case).
 *   2. Validates mandatory registration fields (email, password, society name).
 *   3. Connects to Supabase Auth Admin API to provision user credentials.
 *   4. Direct-connects to Neon PostgreSQL DB via DATABASE_URL to insert:
 *      a) User record in public.users (satisfies societies_created_by_fkey).
 *      b) Society record in public.societies.
 * 
 * Secrets Required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - DATABASE_URL (Neon DB Connection String)
 * ============================================================================
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js'

/**
 * Standard Cross-Origin Resource Sharing (CORS) headers.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // --------------------------------------------------------------------------
  // STEP 1: Handle CORS Preflight (OPTIONS) Requests
  // --------------------------------------------------------------------------
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ------------------------------------------------------------------------
    // STEP 2: Extract & Verify Environment Secrets
    // ------------------------------------------------------------------------
    const dbUrl = Deno.env.get('DATABASE_URL')
    if (!dbUrl) {
      console.error('[ERROR] DATABASE_URL secret is missing in Supabase Edge Function environment.')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'DATABASE_URL secret is missing in Supabase Edge Functions environment.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[ERROR] Supabase project secrets (URL/Service Role Key) are missing.')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Supabase URL or Service Role Key secret is unconfigured.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // ------------------------------------------------------------------------
    // STEP 3: Initialize Database & Auth Clients
    // ------------------------------------------------------------------------
    const sql = postgres(dbUrl)
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    // ------------------------------------------------------------------------
    // STEP 4: Parse & Process Payload
    // ------------------------------------------------------------------------
    const payload = await req.json()
    console.log('[INFO] Incoming enrollment payload received:', JSON.stringify(payload))

    const email = payload.email
    const password = payload.password
    const societyName = payload.societyName || payload.society_name || payload.name
    const fullName = payload.fullName || payload.full_name || payload.adminName || societyName
    const address = payload.address || null
    const city = payload.city || null
    const state = payload.state || null

    // ------------------------------------------------------------------------
    // STEP 5: Input Payload Validation
    // ------------------------------------------------------------------------
    if (!email || !password || !societyName) {
      console.warn('[WARN] Payload validation failed. Missing mandatory parameters.')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: email, password, and societyName/society_name are mandatory.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // ------------------------------------------------------------------------
    // STEP 6: Create Society Admin Credentials in Supabase Auth
    // ------------------------------------------------------------------------
    console.log(`[INFO] Provisioning auth account for email: ${email}`)
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        display_name: fullName,
        full_name: fullName,
        role: 'SOCIETY_ADMIN',
        society_name: societyName
      }
    })

    if (authError) {
      console.error('[ERROR] Supabase Auth creation failed:', authError.message)
      throw new Error(`Auth Error: ${authError.message}`)
    }

    const userId = authData.user.id

    // ------------------------------------------------------------------------
    // STEP 7: Provision User Record in Neon DB public.users Table
    // Satisfies foreign key constraints for created_by in societies table
    // ------------------------------------------------------------------------
    console.log(`[INFO] Inserting user record into Neon DB users table for ID: ${userId}`)
    
    await sql`
      INSERT INTO public.users (
        id, 
        email, 
        full_name, 
        role
      )
      VALUES (
        ${userId}, 
        ${email}, 
        ${fullName}, 
        'SOCIETY_ADMIN'
      )
      ON CONFLICT (id) DO UPDATE 
      SET email = EXCLUDED.email, full_name = EXCLUDED.full_name
    `

    // ------------------------------------------------------------------------
    // STEP 8: Insert Society Record in Neon DB public.societies Table
    // ------------------------------------------------------------------------
    console.log(`[INFO] Inserting society record "${societyName}" into Neon DB...`)
    
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
        true
      )
      RETURNING *
    `

    console.log('[INFO] Society successfully created in Neon DB:', societyResult[0])

    // ------------------------------------------------------------------------
    // STEP 9: Return Success Response
    // ------------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Society enrolled successfully in Neon DB!',
        society: societyResult[0],
        user: {
          id: userId,
          email: authData.user.email
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error: any) {
    // ------------------------------------------------------------------------
    // STEP 10: Global Exception Handling
    // ------------------------------------------------------------------------
    console.error('[EXCEPTION] Enrollment Edge Function failed:', error.message)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred during society enrollment.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    )
  }
})