/**
 * Local API base for registration catalog endpoints.
 * Empty string → same-origin `/api/...` (Vite proxy in dev).
 */
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

/** @deprecated Use BuildingFlat — kept for older call sites */
export type BuildingUnit = {
  id: string;
  unit_number: string;
  floor?: number;
  building_id?: string;
  has_owner: boolean;
};

/** @deprecated Use BuildingWithFlats */
export type BuildingWithUnits = {
  id: string;
  name: string;
  society_id?: string;
  units: BuildingUnit[];
};

export type FlatOption = {
  id: string;
  unit_number: string;
  building_name: string;
  has_owner: boolean;
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
      const id = pickString(row, ["id", "flat_id", "unit_id", "unitId"]);
      const flatNumber = pickString(row, [
        "flat_number",
        "flatNumber",
        "unit_number",
        "unitNumber",
        "number",
        "label",
      ]);
      if (!id || !flatNumber) return null;
      return {
        id,
        building_id: pickString(row, ["building_id", "buildingId"]) ?? buildingId,
        flat_number: flatNumber,
        is_occupied: pickBoolean(row, ["is_occupied", "isOccupied", "has_owner", "hasOwner", "owned"]),
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

/**
 * GET /api/buildings?society_id=… — local Express API (via Vite proxy in dev).
 */
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

  const buildings = normalizeBuildings(raw);
  console.log("[buildingsService] Normalized buildings:", buildings.length);
  return buildings;
}

export type AdditionRequestPayload = {
  society_id: string;
  requester_name: string;
  requester_phone?: string;
  requester_email?: string;
  building_name: string;
  flat_number: string;
  notes?: string;
};

/**
 * POST /api/addition-requests — ask admin to add a missing building/flat.
 */
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

/** Legacy helper — flattens nested flats for single-select UIs. */
export async function fetchFlatOptionsForSociety(societyId: string): Promise<FlatOption[]> {
  const buildings = await fetchBuildingsForSociety(societyId);
  const options: FlatOption[] = [];
  for (const building of buildings) {
    for (const flat of building.flats) {
      options.push({
        id: flat.id,
        unit_number: flat.flat_number,
        building_name: building.name,
        has_owner: flat.is_occupied,
      });
    }
  }
  return options.sort(
    (a, b) =>
      a.building_name.localeCompare(b.building_name) ||
      a.unit_number.localeCompare(b.unit_number),
  );
}
