const ROUTER_URL = (
  import.meta.env.VITE_ROUTER_API_URL || "https://universal-tenant-router.netlify.app"
).replace(/\/$/, "");

export type SocietyListItem = {
  id: string;
  name: string;
  city: string | null;
  is_active?: boolean;
};

export type FetchSocietiesResult = {
  societies: SocietyListItem[];
  url: string;
  status: number | null;
  error: string | null;
  raw: unknown;
};

type LooseSociety = Record<string, unknown>;

type RouterSocietiesPayload =
  | LooseSociety[]
  | {
      societies?: LooseSociety[];
      data?: LooseSociety[];
      results?: LooseSociety[];
      items?: LooseSociety[];
      rows?: LooseSociety[];
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

function pickActive(row: LooseSociety): boolean | undefined {
  const value = row.is_active ?? row.active ?? row.isActive;
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "active"].includes(normalized)) return true;
    if (["false", "0", "no", "inactive"].includes(normalized)) return false;
  }
  return undefined;
}

function extractRawList(payload: RouterSocietiesPayload): LooseSociety[] {
  if (Array.isArray(payload)) return payload;

  const nestedKeys = ["societies", "data", "results", "items", "rows"] as const;
  for (const key of nestedKeys) {
    const value = payload[key];
    if (Array.isArray(value)) return value as LooseSociety[];
  }

  const dataObj = asRecord(payload.data);
  if (dataObj) {
    for (const key of nestedKeys) {
      const value = dataObj[key];
      if (Array.isArray(value)) return value as LooseSociety[];
    }
  }

  return [];
}

function normalizeSocieties(payload: RouterSocietiesPayload): SocietyListItem[] {
  const raw = extractRawList(payload);

  return raw
    .map((row): SocietyListItem | null => {
      if (!row || typeof row !== "object") return null;
      const id = pickString(row, ["id", "society_id", "societyId", "uuid"]);
      const name = pickString(row, ["name", "society_name", "societyName", "title"]);
      if (!id || !name) return null;

      const city = pickString(row, ["city", "location_city", "town"]);
      const isActive = pickActive(row);
      if (isActive === false) return null;

      return {
        id,
        name,
        city,
        is_active: isActive ?? true,
      };
    })
    .filter((s): s is SocietyListItem => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Public registration catalog — no Authorization header.
 * Router marks GET /api/societies as a public route (active societies only).
 */
export async function fetchActiveSocietiesDetailed(): Promise<FetchSocietiesResult> {
  const url = `${ROUTER_URL}/api/societies`;
  console.log("[societiesService] Fetching active societies (public) — URL:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const contentType = response.headers.get("content-type") || "";
    let raw: unknown = null;

    if (contentType.includes("application/json")) {
      raw = await response.json();
    } else {
      raw = await response.text();
    }

    console.log("[societiesService] Response status:", response.status);
    console.log("[societiesService] Parsed JSON payload:", raw);

    if (!response.ok) {
      const message =
        raw && typeof raw === "object" && "error" in raw && typeof (raw as { error: unknown }).error === "string"
          ? (raw as { error: string }).error
          : `Router returned ${response.status}`;

      console.warn("[societiesService] Societies request failed:", message);

      return {
        societies: [],
        url,
        status: response.status,
        error: message,
        raw,
      };
    }

    const societies = normalizeSocieties(raw as RouterSocietiesPayload);
    console.log(
      "[societiesService] Normalized societies array (" + societies.length + "):",
      societies,
    );

    return {
      societies,
      url,
      status: response.status,
      error: null,
      raw,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch societies from router";
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

/** Convenience wrapper used by UI components. */
export async function fetchActiveSocieties(): Promise<SocietyListItem[]> {
  const result = await fetchActiveSocietiesDetailed();
  return result.societies;
}
