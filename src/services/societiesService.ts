import type { SocietyListItem } from "@/types/society";

export type { SocietyListItem };

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export type FetchSocietiesResult = {
  societies: SocietyListItem[];
  url: string;
  status: number | null;
  error: string | null;
  raw: unknown;
};

type LooseSociety = Record<string, unknown>;

type SocietiesPayload =
  | LooseSociety[]
  | {
      societies?: LooseSociety[];
      data?: LooseSociety[];
      error?: string;
      message?: string;
    };

function asRecord(value: unknown): LooseSociety | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseSociety)
    : null;
}

function pickString(row: LooseSociety, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizeSocieties(payload: SocietiesPayload): SocietyListItem[] {
  const root = asRecord(payload);
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.societies)
      ? (root!.societies as LooseSociety[])
      : Array.isArray(root?.data)
        ? (root!.data as LooseSociety[])
        : [];

  return raw
    .map((row): SocietyListItem | null => {
      if (!row || typeof row !== "object") return null;
      const id = pickString(row, ["id", "society_id", "societyId"]);
      const name = pickString(row, ["name", "society_name", "societyName"]);
      if (!id || !name) return null;
      return {
        id,
        name,
        code: pickString(row, ["code"]),
        city: pickString(row, ["city"]),
        is_active: true,
      };
    })
    .filter((s): s is SocietyListItem => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * GET /api/societies — local Express API (Vite proxies /api in dev).
 */
export async function fetchActiveSocietiesDetailed(): Promise<FetchSocietiesResult> {
  const url = `${API_BASE}/api/societies`;
  console.log("[societiesService] Fetching active societies — URL:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    console.log("[societiesService] Response status:", response.status);
    console.log("[societiesService] Parsed JSON payload:", raw);

    if (!response.ok) {
      const message =
        raw && typeof raw === "object" && "error" in raw && typeof (raw as { error: unknown }).error === "string"
          ? (raw as { error: string }).error
          : `API returned ${response.status}`;

      return {
        societies: [],
        url,
        status: response.status,
        error: message,
        raw,
      };
    }

    const societies = normalizeSocieties(raw as SocietiesPayload);
    console.log("[societiesService] Normalized societies:", societies.length);

    return {
      societies,
      url,
      status: response.status,
      error: null,
      raw,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch societies";
    console.warn("[societiesService] Network error:", message, err);
    return {
      societies: [],
      url,
      status: null,
      error: message,
      raw: null,
    };
  }
}

export async function fetchActiveSocieties(): Promise<SocietyListItem[]> {
  const result = await fetchActiveSocietiesDetailed();
  return result.societies;
}
