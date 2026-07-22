const ROUTER_URL = (
  import.meta.env.VITE_ROUTER_API_URL || "https://universal-tenant-router.netlify.app"
).replace(/\/$/, "");

export type BuildingUnit = {
  id: string;
  unit_number: string;
  floor?: number;
  building_id?: string;
  has_owner: boolean;
};

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

function normalizeUnits(raw: unknown, buildingId?: string): BuildingUnit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): BuildingUnit | null => {
      const row = asRecord(item);
      if (!row) return null;
      const id = pickString(row, ["id", "unit_id", "unitId"]);
      const unitNumber = pickString(row, ["unit_number", "unitNumber", "number", "label"]);
      if (!id || !unitNumber) return null;
      return {
        id,
        unit_number: unitNumber,
        floor: typeof row.floor === "number" ? row.floor : undefined,
        building_id: pickString(row, ["building_id", "buildingId"]) ?? buildingId,
        has_owner: pickBoolean(row, ["has_owner", "hasOwner", "owned"]),
      };
    })
    .filter((u): u is BuildingUnit => u !== null);
}

function normalizeBuildings(payload: unknown): BuildingWithUnits[] {
  const root = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.buildings)
      ? root!.buildings
      : Array.isArray(root?.data)
        ? root!.data
        : [];

  return (list as unknown[])
    .map((item): BuildingWithUnits | null => {
      const row = asRecord(item);
      if (!row) return null;
      const id = pickString(row, ["id", "building_id", "buildingId"]);
      const name = pickString(row, ["name", "building_name", "buildingName"]);
      if (!id || !name) return null;
      return {
        id,
        name,
        society_id: pickString(row, ["society_id", "societyId"]) ?? undefined,
        units: normalizeUnits(row.units ?? row.flats, id),
      };
    })
    .filter((b): b is BuildingWithUnits => b !== null);
}

/**
 * Flatten buildings → flat options for the registration Select.
 */
export function buildingsToFlatOptions(buildings: BuildingWithUnits[]): FlatOption[] {
  const options: FlatOption[] = [];
  for (const building of buildings) {
    for (const unit of building.units) {
      options.push({
        id: unit.id,
        unit_number: unit.unit_number,
        building_name: building.name,
        has_owner: unit.has_owner,
      });
    }
  }
  return options.sort(
    (a, b) =>
      a.building_name.localeCompare(b.building_name) ||
      a.unit_number.localeCompare(b.unit_number),
  );
}

/**
 * Public GET /api/buildings?society_id=… — no Authorization header.
 */
export async function fetchBuildingsForSociety(societyId: string): Promise<BuildingWithUnits[]> {
  const url = `${ROUTER_URL}/api/buildings?society_id=${encodeURIComponent(societyId)}`;
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
        : `Router returned ${response.status}`;
    throw new Error(message);
  }

  const buildings = normalizeBuildings(raw);
  console.log("[buildingsService] Normalized buildings:", buildings.length);
  return buildings;
}

export async function fetchFlatOptionsForSociety(societyId: string): Promise<FlatOption[]> {
  const buildings = await fetchBuildingsForSociety(societyId);
  return buildingsToFlatOptions(buildings);
}
