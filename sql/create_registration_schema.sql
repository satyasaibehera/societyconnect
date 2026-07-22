-- Registration schema aligned with src/db/schema.ts (Drizzle)
-- Safe to run on Neon / Postgres.

CREATE TABLE IF NOT EXISTS societies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code varchar(64),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  flat_number text NOT NULL,
  is_occupied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone_number text NOT NULL,
  is_ownership_transfer boolean NOT NULL DEFAULT false,
  supporting_document_url text,
  status varchar(32) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buildings_society_id ON buildings (society_id);
CREATE INDEX IF NOT EXISTS idx_flats_building_id ON flats (building_id);
CREATE INDEX IF NOT EXISTS idx_registration_requests_society_id ON registration_requests (society_id);
CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests (status);

CREATE TABLE IF NOT EXISTS addition_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  requester_phone text,
  requester_email text,
  building_name text NOT NULL,
  flat_number text NOT NULL,
  notes text,
  status varchar(32) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addition_requests_society_id ON addition_requests (society_id);
CREATE INDEX IF NOT EXISTS idx_addition_requests_status ON addition_requests (status);
