const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export type BuildingFlat = {
  id: string;
  building_id: string;
  flat_number: string;
  is_occupied: boolean;
};

export type BuildingWithFlats = {
  id: string;
  name: string;
  society_id?: string;
  flats: BuildingFlat[];
};

type LooseRow = Record<string, unknown>;

function asRecord(value: unknown): LooseRow | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseRow)
    : null;
}

function pickString(row: LooseRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickBoolean(row: LooseRow, keys: string[]): boolean {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes"].includes(normalized)) return true;
      if (["false", "0", "no"].includes(normalized)) return false;
    }
  }
  return false;
}

function normalizeFlats(raw: unknown, buildingId: string): BuildingFlat[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): BuildingFlat | null => {
      const row = asRecord(item);
      if (!row) return null;
      const id = pickString(row, ["id", "flat_id", "unit_id"]);
      const flatNumber = pickString(row, ["flat_number", "flatNumber", "unit_number", "number"]);
      if (!id || !flatNumber) return null;
      return {
        id,
        building_id: pickString(row, ["building_id", "buildingId"]) ?? buildingId,
        flat_number: flatNumber,
        is_occupied: pickBoolean(row, ["is_occupied", "isOccupied", "has_owner", "owned"]),
      };
    })
    .filter((f): f is BuildingFlat => f !== null)
    .sort((a, b) => a.flat_number.localeCompare(b.flat_number));
}

function normalizeBuildings(payload: unknown): BuildingWithFlats[] {
  const root = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.buildings)
      ? root!.buildings
      : Array.isArray(root?.data)
        ? root!.data
        : [];

  return (list as unknown[])
    .map((item): BuildingWithFlats | null => {
      const row = asRecord(item);
      if (!row) return null;
      const id = pickString(row, ["id", "building_id", "buildingId"]);
      const name = pickString(row, ["name", "building_name", "buildingName"]);
      if (!id || !name) return null;
      return {
        id,
        name,
        society_id: pickString(row, ["society_id", "societyId"]) ?? undefined,
        flats: normalizeFlats(row.flats ?? row.units, id),
      };
    })
    .filter((b): b is BuildingWithFlats => b !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** GET /api/buildings?society_id=… */
export async function fetchBuildingsForSociety(societyId: string): Promise<BuildingWithFlats[]> {
  const url = `${API_BASE}/api/buildings?society_id=${encodeURIComponent(societyId)}`;
  console.log("[buildingsService] Fetching buildings — URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const contentType = response.headers.get("content-type") || "";
  const raw = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  console.log("[buildingsService] Response status:", response.status);
  console.log("[buildingsService] Parsed payload:", raw);

  if (!response.ok) {
    const message =
      raw && typeof raw === "object" && "error" in raw && typeof (raw as { error: unknown }).error === "string"
        ? (raw as { error: string }).error
        : `API returned ${response.status}`;
    throw new Error(message);
  }

  return normalizeBuildings(raw);
}

export type RegisterPayload = {
  society_id: string;
  full_name: string;
  phone_number: string;
  email?: string;
  resident_type?: string;
  is_ownership_transfer?: boolean;
  supporting_document_url?: string | null;
  supporting_document_base64?: string | null;
  supporting_document_content_type?: string | null;
  /** Existing flat path */
  building_id?: string;
  flat_id?: string;
  /** Missing flat path — creates FlatRequest + WAITING_FOR_FLAT registration */
  request_new_flat?: boolean;
  building_name?: string;
  flat_number?: string;
  notes?: string;
};

/** POST /api/register */
export async function submitRegistration(payload: RegisterPayload): Promise<unknown> {
  const url = `${API_BASE}/api/register`;
  console.log("[buildingsService] Submitting registration — URL:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      raw && typeof raw === "object" && "error" in raw && typeof (raw as { error: unknown }).error === "string"
        ? (raw as { error: string }).error
        : `API returned ${response.status}`;
    throw new Error(message);
  }
  return raw;
}

export type AdditionRequestPayload = {
  society_id: string;
  requested_type?: "building" | "flat";
  requested_name?: string;
  building_name?: string;
  flat_number?: string;
  notes?: string;
};

/** POST /api/addition-requests (standalone FlatRequest) */
export async function submitAdditionRequest(payload: AdditionRequestPayload): Promise<void> {
  const url = `${API_BASE}/api/addition-requests`;
  console.log("[buildingsService] Submitting addition request — URL:", url);

  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      raw && typeof raw === "object" && "error" in raw && typeof (raw as { error: unknown }).error === "string"
        ? (raw as { error: string }).error
        : `API returned ${response.status}`;
    throw new Error(message);
  }
}

export type FlatRequestRow = {
  id: string;
  society_id: string;
  requested_type: string;
  requested_name: string;
  building_name: string | null;
  flat_number: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

export type RegistrationRow = {
  id: string;
  society_id: string;
  building_id: string | null;
  flat_id: string | null;
  flat_request_id: string | null;
  full_name: string;
  phone_number: string;
  email: string | null;
  resident_type: string | null;
  status: string;
  created_at: string;
  flat_request_building_name?: string | null;
  flat_request_flat_number?: string | null;
  flat_request_status?: string | null;
};

export async function fetchPendingFlatRequests(societyId?: string): Promise<FlatRequestRow[]> {
  const qs = new URLSearchParams({ status: "PENDING" });
  if (societyId) qs.set("society_id", societyId);
  const response = await fetch(`${API_BASE}/api/addition-requests?${qs}`, {
    headers: { Accept: "application/json" },
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof raw?.error === "string" ? raw.error : `API returned ${response.status}`,
    );
  }
  return Array.isArray(raw?.requests) ? raw.requests : [];
}

export async function approveFlatRequest(id: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/addition-requests/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof raw?.error === "string" ? raw.error : `API returned ${response.status}`);
  }
  return raw;
}

export async function rejectFlatRequest(id: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/addition-requests/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof raw?.error === "string" ? raw.error : `API returned ${response.status}`);
  }
  return raw;
}

export async function fetchPendingRegistrations(societyId?: string): Promise<RegistrationRow[]> {
  const qs = new URLSearchParams();
  if (societyId) qs.set("society_id", societyId);
  const response = await fetch(`${API_BASE}/api/register?${qs}`, {
    headers: { Accept: "application/json" },
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof raw?.error === "string" ? raw.error : `API returned ${response.status}`);
  }
  return Array.isArray(raw?.registrations) ? raw.registrations : [];
}

export async function approveRegistration(id: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/register/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof raw?.error === "string" ? raw.error : `API returned ${response.status}`);
  }
  return raw;
}

export async function rejectRegistration(id: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/register/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof raw?.error === "string" ? raw.error : `API returned ${response.status}`);
  }
  return raw;
}
