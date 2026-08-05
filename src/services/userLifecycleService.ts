/**
 * User lifecycle sync — Supabase Auth (credentials) ↔ Neon DB (application data).
 *
 * Auth-only in Supabase: email, password, ban state.
 * Neon-only: profile contact fields, status, society/resident metadata.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPool } from "@/db/client";

export const USER_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export type NeonProfileInput = {
  userId: string;
  fullName?: string | null;
  phone?: string | null;
  status?: UserStatus;
};

export type NeonContactUpdate = {
  fullName?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
};

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL are required for user lifecycle sync",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Insert or update the Neon profile row for an auth UUID. */
export async function upsertNeonUserProfile(input: NeonProfileInput): Promise<void> {
  const pool = getPool();
  const status = input.status ?? USER_STATUS.PENDING;

  await pool.query(
    `
      INSERT INTO public.profiles (user_id, full_name, phone, status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE
      SET
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        status = COALESCE(EXCLUDED.status, public.profiles.status),
        updated_at = now()
    `,
    [input.userId, input.fullName ?? null, input.phone ?? null, status],
  );
}

/** Contact / profile metadata — Neon DB only (never Supabase user_metadata). */
export async function updateNeonUserContact(
  userId: string,
  fields: NeonContactUpdate,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      UPDATE public.profiles
      SET
        full_name = COALESCE($2, full_name),
        phone = COALESCE($3, phone),
        date_of_birth = COALESCE($4, date_of_birth),
        updated_at = now()
      WHERE user_id = $1
    `,
    [userId, fields.fullName ?? null, fields.phone ?? null, fields.dateOfBirth ?? null],
  );
}

/** Approval / activation: Neon status active + unban Supabase Auth user. */
export async function syncUserApproved(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE public.profiles SET status = $2, updated_at = now() WHERE user_id = $1`,
    [userId, USER_STATUS.ACTIVE],
  );

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) {
    console.error("[userLifecycleService] activate auth sync failed:", error);
    throw new Error(error.message);
  }
}

/** Revocation / disable: Neon suspended + ban Supabase Auth user. */
export async function syncUserSuspended(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE public.profiles SET status = $2, updated_at = now() WHERE user_id = $1`,
    [userId, USER_STATUS.SUSPENDED],
  );

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });
  if (error) {
    console.error("[userLifecycleService] suspend auth sync failed:", error);
    throw new Error(error.message);
  }
}

/** Removal: delete Neon app rows then remove Supabase Auth user. */
export async function syncUserRemoved(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM public.user_roles WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM public.profiles WHERE user_id = $1`, [userId]);

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[userLifecycleService] remove auth sync failed:", error);
    throw new Error(error.message);
  }
}

/** Roll back a freshly created auth user when Neon provisioning fails. */
export async function rollbackAuthUser(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[userLifecycleService] auth rollback failed:", error);
    throw new Error(error.message);
  }
}
