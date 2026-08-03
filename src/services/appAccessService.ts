import type { User } from "@supabase/supabase-js";
import { APP_CONFIG } from "@/config/appConfig";

export type AppAccessResult =
  | { allowed: true }
  | { allowed: false; reason: string };

function normalizeEmail(email: string | undefined | null): string {
  return (email || "").trim().toLowerCase();
}

function readAppIds(user: User): string[] {
  const meta = user.user_metadata || {};
  const ids = new Set<string>();

  const primary = meta.app_id;
  if (typeof primary === "string" && primary.trim()) {
    ids.add(primary.trim());
  }

  const list = meta.app_ids;
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (typeof entry === "string" && entry.trim()) {
        ids.add(entry.trim());
      }
    }
  }

  return [...ids];
}

/**
 * Platform super-admin email is allowed on any app instance.
 */
export function isPlatformSuperAdmin(user: User): boolean {
  return normalizeEmail(user.email) === APP_CONFIG.superAdminEmail;
}

/**
 * Verify the authenticated user belongs to the current app deployment.
 * Users without app metadata are treated as legacy and allowed (migration path).
 */
export function verifyAppAccess(user: User): AppAccessResult {
  if (isPlatformSuperAdmin(user)) {
    return { allowed: true };
  }

  const boundApps = readAppIds(user);

  // Legacy accounts created before app_id tagging
  if (boundApps.length === 0) {
    return { allowed: true };
  }

  if (boundApps.includes(APP_CONFIG.appId)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Your account is registered for a different application.",
  };
}

/** Metadata fragment injected on every sign-up for multi-app isolation. */
export function appRegistrationMetadata(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...extra,
    app_id: APP_CONFIG.appId,
  };
}
