/** Resolved tenant Neon schema/database name from AuthContext (set after login). */
let tenantDbName: string | null = null;

export function setTenantDbName(name: string | null): void {
  tenantDbName = name?.trim() || null;
}

export function getTenantDbName(): string | null {
  return tenantDbName;
}
