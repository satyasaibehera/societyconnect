/**
 * Parameterized DDL + seed manifest for per-society Neon tenant databases.
 *
 * Adding / changing tables: append or edit entries here only.
 * The provisioner engine never hardcodes table names.
 */

import type { ManifestContext, SchemaManifest, SchemaManifestEntry, SqlParameter } from "./types";

const SCHEMA = "public";

/** Default role keys used by access-control matrix seeding. */
export const DEFAULT_ROLE_KEYS = [
  "super_admin",
  "admin",
  "office_bearer",
  "owner",
  "tenant",
  "family",
  "security",
] as const;

/** Default module keys used by access-control matrix seeding. */
export const DEFAULT_MODULE_KEYS = [
  "dashboard",
  "approvals",
  "residents",
  "visitors",
  "security",
  "vehicles",
  "helpers",
  "payments",
  "office-bearers",
  "my-family",
  "my-visitors",
  "my-helpers",
  "my-vehicles",
  "my-tenants",
  "my-payments",
  "my-gate-passes",
  "notices",
  "complaints",
  "voting",
  "meetings",
  "resolutions",
  "digital-ids",
  "vehicle-passes",
  "emergency",
  "settings",
] as const;

/** Modules that are disabled for most non-admin roles (mirrors production seed). */
const DISABLED_FOR: Record<string, ReadonlySet<string>> = {
  approvals: new Set(["office_bearer", "owner", "tenant", "family", "security"]),
  residents: new Set(["office_bearer", "owner", "tenant", "family", "security"]),
  visitors: new Set(["office_bearer", "owner", "tenant", "family"]),
  security: new Set(["office_bearer", "owner", "tenant", "family", "security"]),
  vehicles: new Set(["office_bearer", "owner", "tenant", "family", "security"]),
  helpers: new Set(["office_bearer", "owner", "tenant", "family", "security"]),
  payments: new Set(["office_bearer", "owner", "tenant", "family", "security"]),
  "my-helpers": new Set(["tenant", "family", "security"]),
  "my-vehicles": new Set(["family", "security"]),
  "my-tenants": new Set(["tenant", "family", "security"]),
  "my-payments": new Set(["family", "security"]),
  "my-gate-passes": new Set(["family", "security"]),
  "my-family": new Set(["security"]),
  "my-visitors": new Set(["security"]),
  "office-bearers": new Set(["security"]),
  complaints: new Set(["security"]),
  voting: new Set(["tenant", "family", "security"]),
  meetings: new Set(["family", "security"]),
  resolutions: new Set(["family", "security"]),
  "vehicle-passes": new Set(["office_bearer", "owner", "tenant", "family"]),
  settings: new Set(["office_bearer", "security"]),
};

export const DEFAULT_NOTICE_TYPES: ReadonlyArray<{
  name: string;
  label: string;
  color: string;
  has_structured_fields: boolean;
  sort_order: number;
}> = [
  { name: "notice", label: "Notice", color: "bg-primary", has_structured_fields: false, sort_order: 0 },
  {
    name: "meeting_minutes",
    label: "Meeting Minutes",
    color: "bg-amber-600",
    has_structured_fields: true,
    sort_order: 1,
  },
  { name: "circular", label: "Circular", color: "bg-emerald-600", has_structured_fields: false, sort_order: 2 },
];

function entry(
  partial: Omit<SchemaManifestEntry, "phase"> & { phase?: SchemaManifestEntry["phase"] },
): SchemaManifestEntry {
  return {
    ...partial,
    phase: partial.phase ?? "tables",
  };
}

/** Build access_controls seed rows as data (engine stays table-agnostic). */
export function buildAccessControlSeedRows(): Array<{
  module_key: string;
  role_key: string;
  is_enabled: boolean;
}> {
  const rows: Array<{ module_key: string; role_key: string; is_enabled: boolean }> = [];
  for (const moduleKey of DEFAULT_MODULE_KEYS) {
    const disabled = DISABLED_FOR[moduleKey] ?? new Set<string>();
    for (const roleKey of DEFAULT_ROLE_KEYS) {
      rows.push({
        module_key: moduleKey,
        role_key: roleKey,
        is_enabled: !disabled.has(roleKey),
      });
    }
  }
  return rows;
}

function accessControlSeedSql(): string {
  const rows = buildAccessControlSeedRows();
  const values = rows
    .map(
      (r) =>
        `('${r.module_key.replace(/'/g, "''")}', '${r.role_key.replace(/'/g, "''")}', ${r.is_enabled})`,
    )
    .join(",\n  ");

  return `
INSERT INTO ${SCHEMA}.access_controls (module_key, role_key, is_enabled)
VALUES
  ${values}
ON CONFLICT (module_key, role_key) DO NOTHING;
`.trim();
}

function noticeTypesSeedSql(ctx: ManifestContext): string {
  const values = DEFAULT_NOTICE_TYPES.map(
    (t) =>
      `($1, '${t.name}', '${t.label.replace(/'/g, "''")}', '${t.color}', ${t.has_structured_fields}, ${t.sort_order})`,
  ).join(",\n  ");

  return `
INSERT INTO ${SCHEMA}.notice_types (society_id, name, label, color, has_structured_fields, sort_order)
VALUES
  ${values}
ON CONFLICT (society_id, name) DO NOTHING;
`.trim();
}

function noticeTypesSeedParams(ctx: ManifestContext): SqlParameter[] {
  return [ctx.societyId];
}

function societySeedSql(ctx: ManifestContext): string {
  return `
INSERT INTO ${SCHEMA}.societies (
  id, name, address, city, state, created_by, is_active
) VALUES (
  $1, $2, $3, $4, $5, $6, $7
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  updated_at = now();
`.trim();
}

function societySeedParams(ctx: ManifestContext): SqlParameter[] {
  const s = ctx.society;
  return [
    ctx.societyId,
    s?.name ?? "New Society",
    s?.address ?? null,
    s?.city ?? null,
    s?.state ?? null,
    s?.createdBy ?? null,
    s?.isActive ?? false,
  ];
}

/**
 * Full tenant schema manifest — extensions → enums → tables → indexes → seeds.
 * Pass into `provisionTenantDatabase(connectionConfig, manifest)`.
 */
export function buildTenantSchemaManifest(ctx?: Partial<ManifestContext>): SchemaManifest {
  // ctx is accepted so callers can pre-bind factories if desired; factories
  // still receive the live context from the provisioner at execution time.
  void ctx;

  const manifest: SchemaManifestEntry[] = [
    // ── Extensions ──────────────────────────────────────────────────────────
    entry({
      id: "ext.pgcrypto",
      description: "Enable pgcrypto for gen_random_uuid()",
      phase: "extensions",
      sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
    }),

    // ── Enums ───────────────────────────────────────────────────────────────
    entry({
      id: "enum.app_role",
      description: "Create app_role enum",
      phase: "enums",
      sql: `
DO $$ BEGIN
  CREATE TYPE ${SCHEMA}.app_role AS ENUM (
    'super_admin', 'admin', 'office_bearer', 'resident', 'security'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`.trim(),
    }),
    entry({
      id: "enum.approval_status",
      description: "Create approval_status enum",
      phase: "enums",
      sql: `
DO $$ BEGIN
  CREATE TYPE ${SCHEMA}.approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`.trim(),
    }),
    entry({
      id: "enum.office_bearer_designation",
      description: "Create office_bearer_designation enum",
      phase: "enums",
      sql: `
DO $$ BEGIN
  CREATE TYPE ${SCHEMA}.office_bearer_designation AS ENUM (
    'president', 'vice_president', 'secretary', 'joint_secretary',
    'treasurer', 'joint_treasurer', 'ward_leader'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`.trim(),
    }),

    // ── Core identity / society tables ──────────────────────────────────────
    entry({
      id: "table.societies",
      description: "Create societies table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.societies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  created_by uuid,
  is_active boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  temp_pass_validity_hours integer NOT NULL DEFAULT 24,
  requires_admin_for_move_pass boolean NOT NULL DEFAULT false
);
`.trim(),
    }),
    entry({
      id: "table.users",
      description: "Create application users table (Neon, keyed by auth UUID)",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.users (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  phone_number text,
  role text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_status_check CHECK (status IN ('pending', 'active', 'suspended'))
);
`.trim(),
    }),
    entry({
      id: "table.profiles",
      description: "Create profiles table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  phone text,
  avatar_url text,
  date_of_birth date,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_status_check CHECK (status IN ('pending', 'active', 'suspended'))
);
`.trim(),
    }),
    entry({
      id: "table.user_roles",
      description: "Create user_roles table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role ${SCHEMA}.app_role NOT NULL,
  UNIQUE (user_id, role)
);
`.trim(),
    }),
    entry({
      id: "table.role_requests",
      description: "Create role_requests table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  requested_role ${SCHEMA}.app_role NOT NULL,
  society_id uuid REFERENCES ${SCHEMA}.societies(id) ON DELETE SET NULL,
  reason text,
  status ${SCHEMA}.approval_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),

    // ── Structure ───────────────────────────────────────────────────────────
    entry({
      id: "table.buildings",
      description: "Create buildings table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  name text NOT NULL,
  floors integer NOT NULL DEFAULT 1,
  units_per_floor integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.units",
      description: "Create units table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES ${SCHEMA}.buildings(id) ON DELETE CASCADE,
  unit_number text NOT NULL,
  floor integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, unit_number)
);
`.trim(),
    }),
    entry({
      id: "table.residents",
      description: "Create residents table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES ${SCHEMA}.units(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text,
  date_of_birth date,
  age integer,
  resident_type text NOT NULL DEFAULT 'owner'
    CHECK (resident_type = ANY (ARRAY['owner'::text, 'tenant'::text, 'family'::text])),
  photo_url text,
  status ${SCHEMA}.approval_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  relationship text,
  gender text,
  email text,
  tenancy_start_date date,
  tenancy_end_date date,
  has_vacated boolean NOT NULL DEFAULT false,
  is_ownership_transfer boolean NOT NULL DEFAULT false,
  supporting_document_url text
);
`.trim(),
    }),

    // ── Access / notices ────────────────────────────────────────────────────
    entry({
      id: "table.access_controls",
      description: "Create access_controls table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.access_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  role_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_key, role_key)
);
`.trim(),
    }),
    entry({
      id: "table.notice_types",
      description: "Create notice_types table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.notice_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  name text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'bg-primary',
  has_structured_fields boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (society_id, name)
);
`.trim(),
    }),
    entry({
      id: "table.notices",
      description: "Create notices table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  notice_type text NOT NULL DEFAULT 'notice',
  meeting_date date,
  attendees text,
  key_decisions text,
  action_items text
);
`.trim(),
    }),
    entry({
      id: "table.notifications",
      description: "Create notifications table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb DEFAULT '{}'::jsonb,
  type text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),

    // ── Domain tables ───────────────────────────────────────────────────────
    entry({
      id: "table.office_bearers",
      description: "Create office_bearers table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.office_bearers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  designation ${SCHEMA}.office_bearer_designation NOT NULL,
  is_approver boolean NOT NULL DEFAULT false,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.security_staff",
      description: "Create security_staff table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.security_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL,
  phone text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.visitors",
      description: "Create visitors table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  visiting_unit_id uuid REFERENCES ${SCHEMA}.units(id) ON DELETE SET NULL,
  visiting_unit_label text,
  entry_time timestamptz,
  exit_time timestamptz,
  purpose text,
  status ${SCHEMA}.approval_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.vehicles",
      description: "Create vehicles table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES ${SCHEMA}.residents(id) ON DELETE SET NULL,
  vehicle_number text NOT NULL,
  vehicle_type text CHECK (vehicle_type = ANY (ARRAY['car'::text, 'bike'::text, 'other'::text])),
  parking_slot text,
  status ${SCHEMA}.approval_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  ownership_type text DEFAULT 'self'
);
`.trim(),
    }),
    entry({
      id: "table.vehicle_passes",
      description: "Create vehicle_passes table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.vehicle_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text NOT NULL,
  vehicle_type text,
  pass_type text NOT NULL DEFAULT 'permanent'
    CHECK (pass_type = ANY (ARRAY['temporary'::text, 'permanent'::text])),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text])),
  visitor_name text,
  visitor_phone text,
  purpose text,
  unit_id uuid REFERENCES ${SCHEMA}.units(id) ON DELETE SET NULL,
  unit_label text,
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  requested_by uuid,
  approved_by uuid,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.helpers",
      description: "Create helpers table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.helpers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  service_type text,
  photo_url text,
  status ${SCHEMA}.approval_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.helper_assignments",
      description: "Create helper_assignments table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.helper_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  helper_id uuid NOT NULL REFERENCES ${SCHEMA}.helpers(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES ${SCHEMA}.units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (helper_id, unit_id)
);
`.trim(),
    }),
    entry({
      id: "table.complaints",
      description: "Create complaints table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES ${SCHEMA}.residents(id) ON DELETE SET NULL,
  category text,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])),
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.meetings",
      description: "Create meetings table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  title text NOT NULL,
  agenda text,
  meeting_date timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.polls",
      description: "Create polls table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.votes",
      description: "Create votes table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES ${SCHEMA}.polls(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES ${SCHEMA}.residents(id) ON DELETE SET NULL,
  vote_option text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.resolutions",
      description: "Create resolutions table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  decision_date date,
  related_poll_id uuid REFERENCES ${SCHEMA}.polls(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.payment_categories",
      description: "Create payment_categories table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.payment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  amount numeric(12,2),
  amount_min numeric(12,2),
  amount_max numeric(12,2),
  is_fixed_amount boolean NOT NULL DEFAULT true,
  due_day integer,
  frequency text NOT NULL DEFAULT 'monthly',
  upi_id text,
  account_holder_name text,
  account_number text,
  ifsc_code text,
  bank_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.owner_payment_config",
      description: "Create owner_payment_config table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.owner_payment_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  unit_id uuid NOT NULL REFERENCES ${SCHEMA}.units(id) ON DELETE CASCADE,
  upi_id text,
  account_holder_name text,
  bank_name text,
  rent_amount numeric(12,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.payment_records",
      description: "Create payment_records table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  payer_user_id uuid NOT NULL,
  payment_type text NOT NULL,
  category_id uuid REFERENCES ${SCHEMA}.payment_categories(id) ON DELETE SET NULL,
  owner_config_id uuid REFERENCES ${SCHEMA}.owner_payment_config(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  transaction_ref text,
  notes text,
  status text NOT NULL DEFAULT 'declared',
  declared_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_by uuid,
  rejection_reason text,
  period_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.rent_receipts",
      description: "Create rent_receipts table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.rent_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_record_id uuid NOT NULL REFERENCES ${SCHEMA}.payment_records(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  tenant_user_id uuid NOT NULL,
  owner_name text NOT NULL,
  tenant_name text NOT NULL,
  unit_id uuid NOT NULL REFERENCES ${SCHEMA}.units(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  period_label text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_number text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.move_passes",
      description: "Create move_passes table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.move_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES ${SCHEMA}.units(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  pass_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending_owner',
  scheduled_date date,
  notes text,
  owner_approved_by uuid,
  owner_approved_at timestamptz,
  owner_rejection_reason text,
  admin_approved_by uuid,
  admin_approved_at timestamptz,
  admin_rejection_reason text,
  dues_cleared boolean NOT NULL DEFAULT false,
  dues_cleared_by uuid,
  dues_cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tenant_name text,
  tenant_phone text,
  tenant_email text,
  purpose text,
  vehicle_number text,
  vehicle_type text,
  scheduled_time time
);
`.trim(),
    }),
    entry({
      id: "table.approval_delegates",
      description: "Create approval_delegates table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.approval_delegates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES ${SCHEMA}.units(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  delegate_id uuid NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.emergency_alerts",
      description: "Create emergency_alerts table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.emergency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES ${SCHEMA}.societies(id) ON DELETE CASCADE,
  raised_by uuid NOT NULL,
  alert_type text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'active',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),
    entry({
      id: "table.otp_codes",
      description: "Create otp_codes table",
      sql: `
CREATE TABLE IF NOT EXISTS ${SCHEMA}.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['email'::text, 'phone'::text])),
  target text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
`.trim(),
    }),

    // ── Indexes ─────────────────────────────────────────────────────────────
    entry({
      id: "index.residents_society",
      description: "Index residents by society",
      phase: "indexes",
      sql: `CREATE INDEX IF NOT EXISTS idx_residents_society_id ON ${SCHEMA}.residents (society_id);`,
    }),
    entry({
      id: "index.units_building",
      description: "Index units by building",
      phase: "indexes",
      sql: `CREATE INDEX IF NOT EXISTS idx_units_building_id ON ${SCHEMA}.units (building_id);`,
    }),
    entry({
      id: "index.user_roles_user",
      description: "Index user_roles by user",
      phase: "indexes",
      sql: `CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON ${SCHEMA}.user_roles (user_id);`,
    }),
    entry({
      id: "index.notices_society",
      description: "Index notices by society",
      phase: "indexes",
      sql: `CREATE INDEX IF NOT EXISTS idx_notices_society_id ON ${SCHEMA}.notices (society_id);`,
    }),

    // ── Seeds (data-driven; provisioner skips if runSeeds=false) ─────────────
    entry({
      id: "seed.society",
      description: "Upsert the society row for this tenant",
      phase: "seeds",
      sql: societySeedSql,
      params: societySeedParams,
    }),
    entry({
      id: "seed.access_controls",
      description: "Seed default module/role access controls",
      phase: "seeds",
      sql: accessControlSeedSql(),
    }),
    entry({
      id: "seed.notice_types",
      description: "Seed default notice types for society",
      phase: "seeds",
      sql: noticeTypesSeedSql,
      params: noticeTypesSeedParams,
    }),
    entry({
      id: "seed.default_roles_ref",
      description: "Ensure default role keys are documented via access_controls coverage",
      phase: "seeds",
      // No-op marker step — roles live as enum + access_controls role_key matrix.
      // Kept as an explicit seed so role defaults remain configuration-driven.
      sql: `SELECT 1;`,
    }),
  ];

  return manifest;
}

/** Default exportable manifest (unbound factories — provisioner supplies context). */
export const TENANT_SCHEMA_MANIFEST: SchemaManifest = buildTenantSchemaManifest();

/** Resolve a manifest entry against a live context. */
export function resolveManifestEntry(
  item: SchemaManifestEntry,
  ctx: ManifestContext,
): { id: string; description: string; phase: SchemaManifestEntry["phase"]; sql: string; params: SqlParameter[] } {
  const sql = typeof item.sql === "function" ? item.sql(ctx) : item.sql;
  const params = typeof item.params === "function" ? item.params(ctx) : item.params ?? [];
  return {
    id: item.id,
    description: item.description,
    phase: item.phase,
    sql,
    params,
  };
}
