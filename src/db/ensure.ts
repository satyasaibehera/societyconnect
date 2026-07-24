import { randomUUID } from "node:crypto";
import type { Pool } from "@neondatabase/serverless";

/**
 * Ensure registration / flat-request tables + columns exist on society DBs
 * that predate the dependent-approval state machine.
 */
export async function ensureRegistrationTables(pool: Pool): Promise<void> {
  await pool.query(`
DO $$ BEGIN
  CREATE TYPE addition_requested_type AS ENUM ('building', 'flat');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`);

  await pool.query(`
CREATE TABLE IF NOT EXISTS addition_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  requested_type addition_requested_type NOT NULL,
  requested_name text NOT NULL,
  building_name text,
  flat_number text,
  notes text,
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  resolved_building_id uuid,
  resolved_flat_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`);

  await pool.query(`
CREATE TABLE IF NOT EXISTS registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  building_id uuid REFERENCES buildings(id) ON DELETE CASCADE,
  flat_id uuid REFERENCES flats(id) ON DELETE CASCADE,
  flat_request_id uuid REFERENCES addition_requests(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone_number text NOT NULL,
  email text,
  resident_type varchar(32),
  is_ownership_transfer boolean NOT NULL DEFAULT false,
  supporting_document_url text,
  status varchar(32) NOT NULL DEFAULT 'READY_FOR_REVIEW',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`);

  // Additive columns for older table shapes
  const alters = [
    `ALTER TABLE addition_requests ADD COLUMN IF NOT EXISTS building_name text`,
    `ALTER TABLE addition_requests ADD COLUMN IF NOT EXISTS flat_number text`,
    `ALTER TABLE addition_requests ADD COLUMN IF NOT EXISTS resolved_building_id uuid`,
    `ALTER TABLE addition_requests ADD COLUMN IF NOT EXISTS resolved_flat_id uuid`,
    `ALTER TABLE addition_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`,
    `ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS flat_request_id uuid`,
    `ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS email text`,
    `ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS resident_type varchar(32)`,
  ];

  for (const sql of alters) {
    await pool.query(sql);
  }

  // Allow null building/flat while waiting for FlatRequest approval
  await pool.query(`
DO $$ BEGIN
  ALTER TABLE registration_requests ALTER COLUMN building_id DROP NOT NULL;
EXCEPTION WHEN undefined_column OR others THEN NULL;
END $$;
`);
  await pool.query(`
DO $$ BEGIN
  ALTER TABLE registration_requests ALTER COLUMN flat_id DROP NOT NULL;
EXCEPTION WHEN undefined_column OR others THEN NULL;
END $$;
`);

  await pool.query(`
CREATE INDEX IF NOT EXISTS idx_addition_requests_society_id ON addition_requests (society_id);
`);
  await pool.query(`
CREATE INDEX IF NOT EXISTS idx_addition_requests_status ON addition_requests (status);
`);
  await pool.query(`
CREATE INDEX IF NOT EXISTS idx_registration_requests_society_id ON registration_requests (society_id);
`);
  await pool.query(`
CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests (status);
`);
  await pool.query(`
CREATE INDEX IF NOT EXISTS idx_registration_requests_flat_request_id ON registration_requests (flat_request_id);
`);
}

/** @deprecated use ensureRegistrationTables */
export async function ensureAdditionRequestsTable(pool: Pool): Promise<void> {
  await ensureRegistrationTables(pool);
}

export { randomUUID };
