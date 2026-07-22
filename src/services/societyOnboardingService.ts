/**
 * Society onboarding orchestration.
 *
 * Creates a society via the Netlify tenant router and dynamically provisions
 * the society’s Neon database using the schema manifest + provisioner.
 * Table lists / DDL live only in the manifest — never in this service.
 */

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
  /** When true (default), request DB provisioning with the current schema manifest. */
  provisionDatabase?: boolean;
  /**
   * Optional direct Neon connection for server-side / admin tooling.
   * When provided, `provisionTenantDatabase` runs locally after society registration.
   * Never ship production credentials into the browser bundle.
   */
  connectionConfig?: TenantConnectionConfig;
  /** Override generated society id (useful for retries). */
  societyId?: string;
  isActive?: boolean;
}

export interface SocietyOnboardingResult {
  success: boolean;
  societyId: string | null;
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

/**
 * Register a new society and provision its tenant database schema dynamically.
 */
export async function onboardSociety(
  payload: SocietyOnboardingPayload,
): Promise<SocietyOnboardingResult> {
  const societyId = createSocietyId(payload.societyId);
  const shouldProvision = payload.provisionDatabase !== false;

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

  // Manifest is passed as configuration — engine stays free of hardcoded tables.
  const manifest = buildTenantSchemaManifest(ctx);
  const migrations = shouldProvision
    ? serializeManifestForRemote(manifest, ctx, { runSeeds: true })
    : [];

  let routerResponse: unknown = null;

  try {
    const response = await fetch(`${ROUTER_URL}/api/societies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        id: societyId,
        name: payload.society_name,
        address: payload.address ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        is_active: payload.isActive ?? false,
        admin: payload.admin,
        provision: shouldProvision
          ? {
              // Data-driven: remote executor only runs the provided statements.
              migrations,
              runSeeds: true,
            }
          : undefined,
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    routerResponse = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof routerResponse === "object" &&
        routerResponse &&
        "error" in routerResponse &&
        typeof (routerResponse as { error?: unknown }).error === "string"
          ? (routerResponse as { error: string }).error
          : `Society registration failed (${response.status})`;

      return {
        success: false,
        societyId,
        routerResponse,
        provision: null,
        error: message,
      };
    }
  } catch (err) {
    return {
      success: false,
      societyId,
      routerResponse,
      provision: null,
      error: err instanceof Error ? err.message : "Failed to reach society registration API",
    };
  }

  let provision: ProvisionTenantResult | null = null;

  // Optional direct provisioning when a connection config is supplied (server-side).
  if (shouldProvision && payload.connectionConfig) {
    provision = await provisionTenantDatabase(payload.connectionConfig, manifest, {
      runSeeds: true,
      context: ctx,
    });

    if (!provision.success) {
      return {
        success: false,
        societyId,
        routerResponse,
        provision,
        error: provision.error ?? "Tenant database provisioning failed",
      };
    }
  }

  return {
    success: true,
    societyId,
    routerResponse,
    provision,
  };
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

    // Fallback for routers that only accept provision on collection create.
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
          routerResponse,
          provision: null,
          error: "Tenant provisioning request failed",
        };
      }
    } else if (!response.ok) {
      return {
        success: false,
        societyId: input.societyId,
        routerResponse,
        provision: null,
        error: "Tenant provisioning request failed",
      };
    }
  } catch (err) {
    return {
      success: false,
      societyId: input.societyId,
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
        routerResponse,
        provision,
        error: provision.error,
      };
    }
  }

  return {
    success: true,
    societyId: input.societyId,
    routerResponse,
    provision,
  };
}
