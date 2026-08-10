import { apiFetch } from "@/services/apiClient";
import { tenantDb } from "@/services/tenantDb";
import type { SocietyListItem } from "@/types/society";

export type { SocietyListItem };

export type PlatformResident = {
  id: string;
  user_id: string | null;
  full_name: string;
  resident_type: string;
  status: string;
};

/** GET /api/societies — Express + Neon (authenticated via apiClient). */
export async function fetchPlatformSocieties(): Promise<SocietyListItem[]> {
  const result = await apiFetch<{ societies: SocietyListItem[] }>("/api/societies");
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
