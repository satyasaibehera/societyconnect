/**
 * Society onboarding orchestration.
 *
 * Enrollment is submitted to the Universal Tenant Router:
 *   POST ${TENANT_ROUTER_URL}/api/v1/auth/enroll
 */

import { signOut } from "@/services/authService";
import { APP_CONFIG } from "@/config/appConfig";
import {
  submitEnrollment,
  type EnrollmentApiError,
} from "@/lib/api/enrollment";
import {
  buildTenantSchemaManifest,
  provisionTenantDatabase,
  serializeManifestForRemote,
  type ManifestContext,
  type ProvisionTenantResult,
  type TenantConnectionConfig,
} from "@/services/db";

const ROUTER_URL = APP_CONFIG.routerBaseUrl;

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
  pincode?: string;
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
  userId: string | null;
  mode: SocietyOnboardingMode | null;
  status: "APPROVED" | "PENDING_APPROVAL" | null;
  routerResponse: unknown;
  provision: ProvisionTenantResult | null;
  error?: string;
  enrollmentError?: EnrollmentApiError;
  duplicateAccount?: boolean;
}

function createSocietyId(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isSuperAdminEnrollmentEmail(email: string): boolean {
  return email.trim().toLowerCase() === APP_CONFIG.superAdminEmail;
}

/**
 * Enroll a society admin via the Universal Tenant Router.
 */
export async function onboardSociety(
  payload: SocietyOnboardingPayload,
): Promise<SocietyOnboardingResult> {
  const email = payload.admin.email.trim();
  const isPlatformAdmin = isSuperAdminEnrollmentEmail(email);

  try {
    const enrollResult = await submitEnrollment({
      email,
      password: payload.admin.password,
      full_name: payload.admin.full_name,
      phone_number: payload.admin.phone || null,
      society_name: payload.society_name,
      address: payload.address ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      pincode: payload.pincode ?? null,
    });

    if (!enrollResult.success) {
      const failed = enrollResult;
      if (failed.duplicateAccount) {
        await signOut();
      }

      return {
        success: false,
        societyId: null,
        userId: null,
        mode: isPlatformAdmin ? "platform_admin" : "standard",
        status: null,
        routerResponse: failed.raw,
        provision: null,
        error: failed.error,
        enrollmentError: failed.apiError,
        duplicateAccount: failed.duplicateAccount,
      };
    }

    const societyId =
      enrollResult.data.societyId || createSocietyId(payload.societyId);
    const userId = enrollResult.data.userId;

    if (payload.provisionDatabase !== false) {
      try {
        await provisionViaRouter(payload, societyId);
      } catch (err) {
        console.warn("[onboardSociety] Router provision skipped/failed:", err);
      }
    }

    try {
      await signOut();
    } catch (err) {
      console.warn("[onboardSociety] signOut after enrollment skipped:", err);
    }

    return {
      success: true,
      societyId,
      userId,
      mode: isPlatformAdmin ? "platform_admin" : "standard",
      status: isPlatformAdmin ? "APPROVED" : "PENDING_APPROVAL",
      routerResponse: enrollResult.raw,
      provision: null,
    };
  } catch (err) {
    return {
      success: false,
      societyId: null,
      userId: null,
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
      requireAuth: false,
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
          userId: null,
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
        userId: null,
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
      userId: null,
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
        userId: null,
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
    userId: null,
    mode: null,
    status: null,
    routerResponse,
    provision,
  };
}
