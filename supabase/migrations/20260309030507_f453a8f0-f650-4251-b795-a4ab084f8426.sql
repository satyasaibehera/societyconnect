
-- Emergency alerts table
CREATE TABLE public.emergency_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES public.societies(id),
  raised_by uuid NOT NULL,
  alert_type text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'active',
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view alerts in their society
CREATE POLICY "Emergency alerts viewable by authenticated"
  ON public.emergency_alerts FOR SELECT TO authenticated
  USING (true);

-- Any authenticated user can raise an alert
CREATE POLICY "Authenticated can create emergency alerts"
  ON public.emergency_alerts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = raised_by);

-- Admins/super_admins can manage (resolve) alerts
CREATE POLICY "Super admins can manage emergency alerts"
  ON public.emergency_alerts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage emergency alerts"
  ON public.emergency_alerts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Security can update (resolve) alerts
CREATE POLICY "Security can update emergency alerts"
  ON public.emergency_alerts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'security'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;

-- Updated_at trigger
CREATE TRIGGER update_emergency_alerts_updated_at
  BEFORE UPDATE ON public.emergency_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
