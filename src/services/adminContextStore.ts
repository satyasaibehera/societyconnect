import type { AppRole } from "@/types/auth";

export type AdminContextSnapshot = {
  impersonatedRole: AppRole | null;
  selectedTenantId: string | null;
  selectedUserId: string | null;
};

let snapshot: AdminContextSnapshot = {
  impersonatedRole: null,
  selectedTenantId: null,
  selectedUserId: null,
};

export function getAdminContextSnapshot(): AdminContextSnapshot {
  return snapshot;
}

export function setAdminContextSnapshot(next: AdminContextSnapshot): void {
  snapshot = {
    impersonatedRole: next.impersonatedRole,
    selectedTenantId: next.selectedTenantId,
    selectedUserId: next.selectedUserId,
  };
}

export function clearAdminContextSnapshot(): void {
  snapshot = {
    impersonatedRole: null,
    selectedTenantId: null,
    selectedUserId: null,
  };
}

export function getAdminContextHeaders(): {
  tenantId: string | null;
  impersonateRole: string | null;
  userId: string | null;
} {
  return {
    tenantId: snapshot.selectedTenantId,
    impersonateRole: snapshot.impersonatedRole,
    userId: snapshot.selectedUserId,
  };
}

/** Super admins must pick a society before tenant data-plane requests run. */
export function canLoadTenantDataForSuperAdmin(isSuperAdmin: boolean): boolean {
  if (!isSuperAdmin) return true;
  return Boolean(snapshot.selectedTenantId);
}
