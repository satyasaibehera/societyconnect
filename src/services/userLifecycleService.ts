/**
 * User lifecycle sync — Supabase Auth (credentials) ↔ Neon DB.
 *
 * Dual-table model:
 *   public.users    — id, email, password_hash (SUPABASE_MANAGED_AUTH)
 *   public.profiles — user_id, full_name, phone_number, role, status
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPool } from "@/db/client";

export const USER_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
} as const;

export const SUPABASE_MANAGED_AUTH = "SUPABASE_MANAGED_AUTH";

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export type NeonUserCredentialUpsert = {
  id: string;
  email?: string | null;
};

export type NeonProfileUpsert = {
  userId: string;
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

/** Root credential upsert — public.users */
export async function upsertNeonUserCredential(input: NeonUserCredentialUpsert): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO public.users (id, email, password_hash)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email
    `,
    [input.id, input.email ?? null, SUPABASE_MANAGED_AUTH],
  );
}

/** Profile metadata upsert — public.profiles */
export async function upsertNeonUserProfile(input: NeonProfileUpsert): Promise<void> {
  const pool = getPool();
  const status = input.status ?? USER_STATUS.PENDING;

  await pool.query(
    `
      INSERT INTO public.profiles (user_id, full_name, phone_number, role, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone_number = EXCLUDED.phone_number,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        updated_at = NOW()
    `,
    [
      input.userId,
      input.fullName ?? null,
      input.phoneNumber ?? null,
      input.role ?? null,
      status,
    ],
  );
}

/** Contact metadata — Neon profiles only (never Supabase user_metadata). */
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
        phone_number = COALESCE($3, phone_number),
        updated_at = NOW()
      WHERE user_id = $1
    `,
    [userId, fields.fullName ?? null, fields.phoneNumber ?? null],
  );
}

async function upsertNeonProfileStatus(userId: string, status: UserStatus): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO public.profiles (user_id, status)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()
    `,
    [userId, status],
  );
}

/** Approval / activation: profiles status active + unban Supabase Auth user. */
export async function syncUserApproved(userId: string): Promise<void> {
  await upsertNeonProfileStatus(userId, USER_STATUS.ACTIVE);

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) {
    console.error("[userLifecycleService] activate auth sync failed:", error);
    throw new Error(error.message);
  }
}

/** Revocation / disable: profiles status suspended + ban Supabase Auth user. */
export async function syncUserSuspended(userId: string): Promise<void> {
  await upsertNeonProfileStatus(userId, USER_STATUS.SUSPENDED);

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });
  if (error) {
    console.error("[userLifecycleService] suspend auth sync failed:", error);
    throw new Error(error.message);
  }
}

/** Removal: delete Neon profiles + users, then Supabase Auth user. */
export async function syncUserRemoved(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM public.user_roles WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM public.profiles WHERE user_id = $1`, [userId]);
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

/** @deprecated Use upsertNeonUserCredential + upsertNeonUserProfile */
export async function upsertNeonUser(input: {
  id: string;
  email?: string | null;
  fullName?: string | null;
  phoneNumber?: string | null;
  role?: string | null;
  status?: UserStatus;
}): Promise<void> {
  await upsertNeonUserCredential({ id: input.id, email: input.email });
  await upsertNeonUserProfile({
    userId: input.id,
    fullName: input.fullName,
    phoneNumber: input.phoneNumber,
    role: input.role,
    status: input.status,
  });
}
