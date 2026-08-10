import { apiFetch } from "@/services/apiClient";
import { tenantDb } from "@/services/tenantDb";

export type PlatformSociety = {
  id: string;
  name: string;
  city?: string | null;
  code?: string | null;
};

export type PlatformResident = {
  id: string;
  user_id: string | null;
  full_name: string;
  resident_type: string;
  status: string;
};

/** GET /api/societies — Express + Neon (authenticated via apiClient). */
export async function fetchPlatformSocieties(): Promise<PlatformSociety[]> {
  const result = await apiFetch<{ societies: PlatformSociety[] }>("/api/societies");
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data?.societies ?? [];
}

/** Load approved residents for impersonation picker (tenant data plane). */
export async function fetchPlatformSocietyResidents(
  societyId: string,
): Promise<PlatformResident[]> {
  const { data, error } = await tenantDb
    .from("residents")
    .select("id, user_id, full_name, resident_type, status")
    .eq("society_id", societyId)
    .eq("status", "approved")
    .order("full_name", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  return (data as PlatformResident[]) ?? [];
}
