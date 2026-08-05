/**
 * Client facade for user lifecycle operations (server-side sync via Express API).
 * Profile contact edits should use tenantDb → Neon only (see Settings page).
 */

import { apiFetch } from "@/services/apiClient";

export async function activateUser(userId: string) {
  return apiFetch<{ success: boolean; userId: string; status: string }>(
    `/api/users/${encodeURIComponent(userId)}/activate`,
    { method: "POST" },
  );
}

export async function suspendUser(userId: string) {
  return apiFetch<{ success: boolean; userId: string; status: string }>(
    `/api/users/${encodeURIComponent(userId)}/suspend`,
    { method: "POST" },
  );
}

export async function removeUser(userId: string) {
  return apiFetch<{ success: boolean; userId: string }>(
    `/api/users/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}
