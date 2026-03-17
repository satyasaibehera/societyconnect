
-- Access controls table: stores per-module, per-role permissions
CREATE TABLE public.access_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL,
  role_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_key, role_key)
);

ALTER TABLE public.access_controls ENABLE ROW LEVEL SECURITY;

-- Only super_admins can manage access controls
CREATE POLICY "Super admins can manage access controls"
  ON public.access_controls FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- All authenticated users can read access controls (needed to check their own access)
CREATE POLICY "Authenticated can read access controls"
  ON public.access_controls FOR SELECT TO authenticated
  USING (true);

-- Seed default permissions: all modules enabled for all roles
-- Modules
INSERT INTO public.access_controls (module_key, role_key, is_enabled) VALUES
  -- Management modules
  ('dashboard', 'super_admin', true), ('dashboard', 'admin', true), ('dashboard', 'office_bearer', true), ('dashboard', 'owner', true), ('dashboard', 'tenant', true), ('dashboard', 'family', true), ('dashboard', 'security', true),
  ('approvals', 'super_admin', true), ('approvals', 'admin', true), ('approvals', 'office_bearer', false), ('approvals', 'owner', false), ('approvals', 'tenant', false), ('approvals', 'family', false), ('approvals', 'security', false),
  ('residents', 'super_admin', true), ('residents', 'admin', true), ('residents', 'office_bearer', false), ('residents', 'owner', false), ('residents', 'tenant', false), ('residents', 'family', false), ('residents', 'security', false),
  ('visitors', 'super_admin', true), ('visitors', 'admin', true), ('visitors', 'office_bearer', false), ('visitors', 'owner', false), ('visitors', 'tenant', false), ('visitors', 'family', false), ('visitors', 'security', true),
  ('security', 'super_admin', true), ('security', 'admin', true), ('security', 'office_bearer', false), ('security', 'owner', false), ('security', 'tenant', false), ('security', 'family', false), ('security', 'security', false),
  ('vehicles', 'super_admin', true), ('vehicles', 'admin', true), ('vehicles', 'office_bearer', false), ('vehicles', 'owner', false), ('vehicles', 'tenant', false), ('vehicles', 'family', false), ('vehicles', 'security', false),
  ('helpers', 'super_admin', true), ('helpers', 'admin', true), ('helpers', 'office_bearer', false), ('helpers', 'owner', false), ('helpers', 'tenant', false), ('helpers', 'family', false), ('helpers', 'security', false),
  ('payments', 'super_admin', true), ('payments', 'admin', true), ('payments', 'office_bearer', false), ('payments', 'owner', false), ('payments', 'tenant', false), ('payments', 'family', false), ('payments', 'security', false),
  ('office-bearers', 'super_admin', true), ('office-bearers', 'admin', true), ('office-bearers', 'office_bearer', true), ('office-bearers', 'owner', true), ('office-bearers', 'tenant', true), ('office-bearers', 'family', true), ('office-bearers', 'security', false),
  -- Resident modules
  ('my-family', 'super_admin', true), ('my-family', 'admin', true), ('my-family', 'office_bearer', true), ('my-family', 'owner', true), ('my-family', 'tenant', true), ('my-family', 'family', true), ('my-family', 'security', false),
  ('my-visitors', 'super_admin', true), ('my-visitors', 'admin', true), ('my-visitors', 'office_bearer', true), ('my-visitors', 'owner', true), ('my-visitors', 'tenant', true), ('my-visitors', 'family', true), ('my-visitors', 'security', false),
  ('my-helpers', 'super_admin', true), ('my-helpers', 'admin', true), ('my-helpers', 'office_bearer', true), ('my-helpers', 'owner', true), ('my-helpers', 'tenant', false), ('my-helpers', 'family', false), ('my-helpers', 'security', false),
  ('my-vehicles', 'super_admin', true), ('my-vehicles', 'admin', true), ('my-vehicles', 'office_bearer', true), ('my-vehicles', 'owner', true), ('my-vehicles', 'tenant', true), ('my-vehicles', 'family', false), ('my-vehicles', 'security', false),
  ('my-tenants', 'super_admin', true), ('my-tenants', 'admin', true), ('my-tenants', 'office_bearer', true), ('my-tenants', 'owner', true), ('my-tenants', 'tenant', false), ('my-tenants', 'family', false), ('my-tenants', 'security', false),
  ('my-payments', 'super_admin', true), ('my-payments', 'admin', true), ('my-payments', 'office_bearer', true), ('my-payments', 'owner', true), ('my-payments', 'tenant', true), ('my-payments', 'family', false), ('my-payments', 'security', false),
  ('my-gate-passes', 'super_admin', true), ('my-gate-passes', 'admin', true), ('my-gate-passes', 'office_bearer', true), ('my-gate-passes', 'owner', true), ('my-gate-passes', 'tenant', true), ('my-gate-passes', 'family', false), ('my-gate-passes', 'security', false),
  -- Community modules
  ('notices', 'super_admin', true), ('notices', 'admin', true), ('notices', 'office_bearer', true), ('notices', 'owner', true), ('notices', 'tenant', true), ('notices', 'family', true), ('notices', 'security', true),
  ('complaints', 'super_admin', true), ('complaints', 'admin', true), ('complaints', 'office_bearer', true), ('complaints', 'owner', true), ('complaints', 'tenant', true), ('complaints', 'family', true), ('complaints', 'security', false),
  ('voting', 'super_admin', true), ('voting', 'admin', true), ('voting', 'office_bearer', true), ('voting', 'owner', true), ('voting', 'tenant', false), ('voting', 'family', false), ('voting', 'security', false),
  ('meetings', 'super_admin', true), ('meetings', 'admin', true), ('meetings', 'office_bearer', true), ('meetings', 'owner', true), ('meetings', 'tenant', true), ('meetings', 'family', false), ('meetings', 'security', false),
  ('resolutions', 'super_admin', true), ('resolutions', 'admin', true), ('resolutions', 'office_bearer', true), ('resolutions', 'owner', true), ('resolutions', 'tenant', true), ('resolutions', 'family', false), ('resolutions', 'security', false),
  -- System modules
  ('digital-ids', 'super_admin', true), ('digital-ids', 'admin', true), ('digital-ids', 'office_bearer', true), ('digital-ids', 'owner', true), ('digital-ids', 'tenant', true), ('digital-ids', 'family', true), ('digital-ids', 'security', true),
  ('vehicle-passes', 'super_admin', true), ('vehicle-passes', 'admin', true), ('vehicle-passes', 'office_bearer', false), ('vehicle-passes', 'owner', false), ('vehicle-passes', 'tenant', false), ('vehicle-passes', 'family', false), ('vehicle-passes', 'security', true),
  ('emergency', 'super_admin', true), ('emergency', 'admin', true), ('emergency', 'office_bearer', true), ('emergency', 'owner', true), ('emergency', 'tenant', true), ('emergency', 'family', true), ('emergency', 'security', true),
  ('settings', 'super_admin', true), ('settings', 'admin', true), ('settings', 'office_bearer', false), ('settings', 'owner', true), ('settings', 'tenant', true), ('settings', 'family', true), ('settings', 'security', false);
