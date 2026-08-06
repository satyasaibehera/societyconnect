import { neon } from "@neondatabase/serverless";

export type PublicUnit = {
  id: string;
  unit_number: string;
  floor: number;
  building_id: string;
  has_owner: boolean;
};

export type PublicBuilding = {
  id: string;
  name: string;
  society_id: string;
  floors: number;
  units_per_floor: number;
  units: PublicUnit[];
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url?.trim()) {
    throw new Error("Missing DATABASE_URL for buildings/units access");
  }

  return url.trim();
}

/**
 * Buildings + flats for a society (registration catalog).
 * Includes has_owner without exposing resident PII.
 */
export async function listBuildingsForSociety(societyId: string): Promise<PublicBuilding[]> {
  const sql = neon(getDatabaseUrl());

  const buildingRows = await sql`
    SELECT
      id,
      name,
      society_id,
      floors,
      units_per_floor
    FROM public.buildings
    WHERE society_id = ${societyId}
    ORDER BY name ASC
  `;

  const unitRows = await sql`
    SELECT
      u.id,
      u.unit_number,
      u.floor,
      u.building_id,
      EXISTS (
        SELECT 1
        FROM public.residents r
        WHERE r.unit_id = u.id
          AND r.resident_type = 'owner'
          AND r.status = 'approved'
          AND COALESCE(r.has_vacated, false) = false
      ) AS has_owner
    FROM public.units u
    INNER JOIN public.buildings b ON b.id = u.building_id
    WHERE b.society_id = ${societyId}
    ORDER BY u.floor ASC, u.unit_number ASC
  `;

  const unitsByBuilding = new Map<string, PublicUnit[]>();
  for (const row of unitRows as Array<Record<string, unknown>>) {
    const buildingId = String(row.building_id);
    const list = unitsByBuilding.get(buildingId) ?? [];
    list.push({
      id: String(row.id),
      unit_number: String(row.unit_number),
      floor: Number(row.floor) || 0,
      building_id: buildingId,
      has_owner: Boolean(row.has_owner),
    });
    unitsByBuilding.set(buildingId, list);
  }

  return (buildingRows as Array<Record<string, unknown>>).map((row) => {
    const id = String(row.id);
    return {
      id,
      name: String(row.name),
      society_id: String(row.society_id),
      floors: Number(row.floors) || 1,
      units_per_floor: Number(row.units_per_floor) || 1,
      units: unitsByBuilding.get(id) ?? [],
    };
  });
}
