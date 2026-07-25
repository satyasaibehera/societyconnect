/**
 * Society onboarding orchestration.
 *
 * - Platform Admin bootstrap (email === VITE_SUPER_ADMIN_EMAIL only — no env password):
 *   edge function creates a confirmed SUPER_ADMIN / PLATFORM_ADMIN with the form password.
 * - Standard enrollment: client signUp (confirmation email) + edge function
 *   saves society + admin role_request as PENDING_APPROVAL.
 */

import { supabase } from "@/integrations/supabase/client";
import { signOut, signUp } from "@/services/authService";
import {
  buildTenantSchemaManifest,
  provisionTenantDatabase,
  serializeManifestForRemote,
  type ManifestContext,
  type ProvisionTenantResult,
  type TenantConnectionConfig,
} from "@/services/db";

const ROUTER_URL =
  import.meta.env.VITE_ROUTER_API_URL || "https://universal-tenant-router.netlify.app";

const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL || "").trim().toLowerCase();

export interface SocietyOnboardingAdmin {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface SocietyOnboardingPayload {
  society_name: string;
  address?: string;
  city?: string;
  state?: string;
  admin: SocietyOnboardingAdmin;
  provisionDatabase?: boolean;
  connectionConfig?: TenantConnectionConfig;
  societyId?: string;
  isActive?: boolean;
}

export type SocietyOnboardingMode = "platform_admin" | "standard";

export interface SocietyOnboardingResult {
  success: boolean;
  societyId: string | null;
  mode: SocietyOnboardingMode | null;
  status: "APPROVED" | "PENDING_APPROVAL" | null;
  routerResponse: unknown;
  provision: ProvisionTenantResult | null;
  error?: string;
}

function createSocietyId(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isSuperAdminEnrollmentEmail(email: string): boolean {
  return Boolean(SUPER_ADMIN_EMAIL) && email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

/**
 * Enroll a society admin — Platform Admin bootstrap (email match only) or standard pending onboarding.
 * Bootstrap password is always the form password; never an env password.
 */
export async function onboardSociety(
  payload: SocietyOnboardingPayload,
): Promise<SocietyOnboardingResult> {
  const email = payload.admin.email.trim();
  const isPlatformAdmin = isSuperAdminEnrollmentEmail(email);

  try {
    if (isPlatformAdmin) {
      const formPassword = payload.admin.password;
      const { data, error } = await supabase.functions.invoke("enroll-society", {
        body: {
          email,
          password: formPassword,
          full_name: payload.admin.full_name,
          phone: payload.admin.phone || null,
          society_name: payload.society_name,
          address: payload.address ?? null,
          city: payload.city ?? null,
          state: payload.state ?? null,
        },
      });

      if (error) {
        return {
          success: false,
          societyId: null,
          mode: "platform_admin",
          status: null,
          routerResponse: data,
          provision: null,
          error: error.message || "Platform Admin bootstrap failed",
        };
      }
      if (data?.error) {
        return {
          success: false,
          societyId: null,
          mode: "platform_admin",
          status: null,
          routerResponse: data,
          provision: null,
          error: String(data.error),
        };
      }

      await signOut();

      return {
        success: true,
        societyId: data?.society_id ?? null,
        mode: "platform_admin",
        status: "APPROVED",
        routerResponse: data,
        provision: null,
      };
    }

    // Standard path: native Supabase signUp → confirmation email
    const emailRedirectTo = `${window.location.origin}/auth/callback`;
    const { data: signUpData, error: signUpError } = await signUp({
      email,
      password: payload.admin.password,
      options: {
        emailRedirectTo,
        data: {
          full_name: payload.admin.full_name,
          phone: payload.admin.phone || null,
          onboarding: {
            type: "society_admin",
            society_name: payload.society_name,
            address: payload.address ?? null,
            city: payload.city ?? null,
            state: payload.state ?? null,
          },
        },
      },
    });

    if (signUpError) {
      return {
        success: false,
        societyId: null,
        mode: "standard",
        status: null,
        routerResponse: null,
        provision: null,
        error: signUpError.message,
      };
    }

    const userId = signUpData?.user?.id;
    if (!userId) {
      return {
        success: false,
        societyId: null,
        mode: "standard",
        status: null,
        routerResponse: signUpData,
        provision: null,
        error: "Signup did not return a user id",
      };
    }

    const { data, error } = await supabase.functions.invoke("enroll-society", {
      body: {
        email,
        password: payload.admin.password,
        full_name: payload.admin.full_name,
        phone: payload.admin.phone || null,
        society_name: payload.society_name,
        address: payload.address ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        user_id: userId,
      },
    });

    if (error || data?.error) {
      return {
        success: false,
        societyId: null,
        mode: "standard",
        status: null,
        routerResponse: data,
        provision: null,
        error: error?.message || String(data?.error || "Failed to save society enrollment"),
      };
    }

    // Best-effort router / tenant provision (non-blocking for auth flow)
    const societyId = (data?.society_id as string | undefined) || createSocietyId(payload.societyId);
    if (payload.provisionDatabase !== false) {
      try {
        await provisionViaRouter(payload, societyId);
      } catch (err) {
        console.warn("[onboardSociety] Router provision skipped/failed:", err);
      }
    }

    await signOut();

    return {
      success: true,
      societyId,
      mode: "standard",
      status: "PENDING_APPROVAL",
      routerResponse: data,
      provision: null,
    };
  } catch (err) {
    return {
      success: false,
      societyId: null,
      mode: isPlatformAdmin ? "platform_admin" : "standard",
      status: null,
      routerResponse: null,
      provision: null,
      error: err instanceof Error ? err.message : "Society registration failed",
    };
  }
}

async function provisionViaRouter(
  payload: SocietyOnboardingPayload,
  societyId: string,
): Promise<void> {
  const shouldProvision = payload.provisionDatabase !== false;
  if (!shouldProvision) return;

  const ctx: ManifestContext = {
    societyId,
    society: {
      name: payload.society_name,
      address: payload.address ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      isActive: payload.isActive ?? false,
    },
  };

  const manifest = buildTenantSchemaManifest(ctx);
  const migrations = serializeManifestForRemote(manifest, ctx, { runSeeds: true });

  await fetch(`${ROUTER_URL}/api/societies`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      id: societyId,
      name: payload.society_name,
      address: payload.address ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      is_active: false,
      admin: payload.admin,
      provision: { migrations, runSeeds: true },
    }),
  }).catch(() => null);

  if (payload.connectionConfig) {
    await provisionTenantDatabase(payload.connectionConfig, manifest, {
      runSeeds: true,
      context: ctx,
    });
  }
}

/**
 * Ask the tenant router to run the current schema manifest against an
 * already-created society (e.g. after the onboarding wizard launches).
 */
export async function provisionSocietyTenant(input: {
  societyId: string;
  society_name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  isActive?: boolean;
  connectionConfig?: TenantConnectionConfig;
}): Promise<SocietyOnboardingResult> {
  const ctx: ManifestContext = {
    societyId: input.societyId,
    society: {
      name: input.society_name,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      isActive: input.isActive ?? true,
    },
  };

  const manifest = buildTenantSchemaManifest(ctx);
  const migrations = serializeManifestForRemote(manifest, ctx, { runSeeds: true });

  let routerResponse: unknown = null;

  try {
    const response = await fetch(
      `${ROUTER_URL}/api/societies/${encodeURIComponent(input.societyId)}/provision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          society_id: input.societyId,
          migrations,
          runSeeds: true,
        }),
      },
    );

    const contentType = response.headers.get("content-type") || "";
    routerResponse = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (response.status === 404) {
      const fallback = await fetch(`${ROUTER_URL}/api/societies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          id: input.societyId,
          name: input.society_name,
          address: input.address ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          is_active: input.isActive ?? true,
          provision: { migrations, runSeeds: true },
        }),
      });

      routerResponse = (fallback.headers.get("content-type") || "").includes("application/json")
        ? await fallback.json()
        : await fallback.text();

      if (!fallback.ok) {
        return {
          success: false,
          societyId: input.societyId,
          mode: null,
          status: null,
          routerResponse,
          provision: null,
          error: "Tenant provisioning request failed",
        };
      }
    } else if (!response.ok) {
      return {
        success: false,
        societyId: input.societyId,
        mode: null,
        status: null,
        routerResponse,
        provision: null,
        error: "Tenant provisioning request failed",
      };
    }
  } catch (err) {
    return {
      success: false,
      societyId: input.societyId,
      mode: null,
      status: null,
      routerResponse,
      provision: null,
      error: err instanceof Error ? err.message : "Failed to reach provisioning API",
    };
  }

  let provision: ProvisionTenantResult | null = null;
  if (input.connectionConfig) {
    provision = await provisionTenantDatabase(input.connectionConfig, manifest, {
      runSeeds: true,
      context: ctx,
    });
    if (!provision.success) {
      return {
        success: false,
        societyId: input.societyId,
        mode: null,
        status: null,
        routerResponse,
        provision,
        error: provision.error,
      };
    }
  }

  return {
    success: true,
    societyId: input.societyId,
    mode: null,
    status: null,
    routerResponse,
    provision,
  };
}
