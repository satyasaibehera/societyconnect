import { apiFetch } from "@/services/apiClient";

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

export async function fetchPlatformSocieties(): Promise<PlatformSociety[]> {
  const result = await apiFetch<{ societies: PlatformSociety[] }>("/api/platform/societies");
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data?.societies ?? [];
}

export async function fetchPlatformSocietyResidents(
  societyId: string,
): Promise<PlatformResident[]> {
  const result = await apiFetch<{ residents: PlatformResident[] }>(
    `/api/platform/societies/${encodeURIComponent(societyId)}/residents`,
  );
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data?.residents ?? [];
}
