
-- Table for society-configurable notice types
CREATE TABLE public.notice_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  name text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'bg-primary',
  has_structured_fields boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint per society
ALTER TABLE public.notice_types ADD CONSTRAINT notice_types_society_name_unique UNIQUE (society_id, name);

-- Enable RLS
ALTER TABLE public.notice_types ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Notice types viewable by authenticated"
  ON public.notice_types FOR SELECT TO authenticated
  USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage notice types"
  ON public.notice_types FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Super admins can manage
CREATE POLICY "Super admins can manage notice types"
  ON public.notice_types FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed default types for all existing societies
INSERT INTO public.notice_types (society_id, name, label, color, has_structured_fields, sort_order)
SELECT s.id, t.name, t.label, t.color, t.has_structured_fields, t.sort_order
FROM public.societies s
CROSS JOIN (VALUES
  ('notice', 'Notice', 'bg-primary', false, 0),
  ('meeting_minutes', 'Meeting Minutes', 'bg-amber-600', true, 1),
  ('circular', 'Circular', 'bg-emerald-600', false, 2)
) AS t(name, label, color, has_structured_fields, sort_order);
