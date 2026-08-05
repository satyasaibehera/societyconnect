/**
 * User lifecycle sync — Supabase Auth (credentials) ↔ Neon DB `public.users`.
 *
 * Auth-only in Supabase: email, password, ban state.
 * Neon-only: full_name, phone_number, role, status (keyed by auth UUID as `id`).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPool } from "@/db/client";

export const USER_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export type NeonUserUpsert = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  phoneNumber?: string | null;
  role?: string | null;
  status?: UserStatus;
};

export type NeonContactUpdate = {
  fullName?: string | null;
  phoneNumber?: string | null;
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

/** Idempotent full upsert into Neon `public.users` keyed by auth UUID. */
export async function upsertNeonUser(input: NeonUserUpsert): Promise<void> {
  const pool = getPool();
  const status = input.status ?? USER_STATUS.PENDING;

  await pool.query(
    `
      INSERT INTO public.users (id, email, full_name, phone_number, role, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone_number = EXCLUDED.phone_number,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        updated_at = NOW()
    `,
    [
      input.id,
      input.email ?? null,
      input.fullName ?? null,
      input.phoneNumber ?? null,
      input.role ?? null,
      status,
    ],
  );
}

/** Idempotent status-only upsert (approval / suspension) without clobbering other columns. */
async function upsertNeonUserStatus(userId: string, status: UserStatus): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO public.users (id, status, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()
    `,
    [userId, status],
  );
}

/** Contact metadata — Neon DB only (never Supabase user_metadata). */
export async function updateNeonUserContact(
  userId: string,
  fields: NeonContactUpdate,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      UPDATE public.users
      SET
        full_name = COALESCE($2, full_name),
        phone_number = COALESCE($3, phone_number),
        updated_at = NOW()
      WHERE id = $1
    `,
    [userId, fields.fullName ?? null, fields.phoneNumber ?? null],
  );
}

/** Approval / activation: upsert Neon status active + unban Supabase Auth user. */
export async function syncUserApproved(userId: string): Promise<void> {
  await upsertNeonUserStatus(userId, USER_STATUS.ACTIVE);

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) {
    console.error("[userLifecycleService] activate auth sync failed:", error);
    throw new Error(error.message);
  }
}

/** Revocation / disable: upsert Neon status suspended + ban Supabase Auth user. */
export async function syncUserSuspended(userId: string): Promise<void> {
  await upsertNeonUserStatus(userId, USER_STATUS.SUSPENDED);

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
  await pool.query(`DELETE FROM public.users WHERE id = $1`, [userId]);

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

/** @deprecated Use upsertNeonUser */
export async function upsertNeonUserProfile(input: {
  userId: string;
  fullName?: string | null;
  phone?: string | null;
  status?: UserStatus;
  email?: string | null;
  role?: string | null;
}): Promise<void> {
  return upsertNeonUser({
    id: input.userId,
    email: input.email,
    fullName: input.fullName,
    phoneNumber: input.phone,
    role: input.role,
    status: input.status,
  });
}
