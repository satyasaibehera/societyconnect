
-- Notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb DEFAULT '{}'::jsonb,
  type text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  related_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id);

-- System inserts via trigger (SECURITY DEFINER function)
-- No direct INSERT policy needed for end users

-- Super admins can manage all
CREATE POLICY "Super admins can manage notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to fan out emergency alert notifications to security + office bearers
CREATE OR REPLACE FUNCTION public.notify_emergency_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _raiser_name text;
  _raiser_phone text;
  _raiser_email text;
  _raiser_type text;
  _unit_label text;
  _building_name text;
  _recipient record;
  _title text;
  _body text;
  _meta jsonb;
BEGIN
  -- Get raiser details from residents table
  SELECT r.full_name, r.phone, r.email, r.resident_type,
         u.unit_number, b.name
  INTO _raiser_name, _raiser_phone, _raiser_email, _raiser_type,
       _unit_label, _building_name
  FROM public.residents r
  LEFT JOIN public.units u ON r.unit_id = u.id
  LEFT JOIN public.buildings b ON u.building_id = b.id
  WHERE r.user_id = NEW.raised_by AND r.status = 'approved'
  LIMIT 1;

  -- Fallback to profiles if not a resident
  IF _raiser_name IS NULL THEN
    SELECT p.full_name, p.phone
    INTO _raiser_name, _raiser_phone
    FROM public.profiles p
    WHERE p.user_id = NEW.raised_by
    LIMIT 1;
  END IF;

  _title := '🚨 Emergency: ' || INITCAP(REPLACE(NEW.alert_type, '_', ' '));
  _body := COALESCE(_raiser_name, 'Unknown') || ' raised a ' || REPLACE(NEW.alert_type, '_', ' ') || ' alert';
  
  IF _unit_label IS NOT NULL AND _building_name IS NOT NULL THEN
    _body := _body || ' from ' || _building_name || ' - ' || _unit_label;
  END IF;

  _meta := jsonb_build_object(
    'alert_id', NEW.id,
    'alert_type', NEW.alert_type,
    'alert_message', COALESCE(NEW.message, ''),
    'raiser_name', COALESCE(_raiser_name, 'Unknown'),
    'raiser_phone', COALESCE(_raiser_phone, ''),
    'raiser_email', COALESCE(_raiser_email, ''),
    'raiser_type', COALESCE(_raiser_type, ''),
    'unit', COALESCE(_unit_label, ''),
    'building', COALESCE(_building_name, ''),
    'raised_at', NEW.created_at
  );

  -- Notify all security staff
  FOR _recipient IN
    SELECT DISTINCT ss.user_id as uid
    FROM public.security_staff ss
    WHERE ss.user_id IS NOT NULL AND ss.society_id = NEW.society_id
  LOOP
    INSERT INTO public.notifications (recipient_id, title, body, metadata, type, related_id)
    VALUES (_recipient.uid, _title, _body, _meta, 'emergency', NEW.id);
  END LOOP;

  -- Notify all office bearers
  FOR _recipient IN
    SELECT DISTINCT ob.user_id as uid
    FROM public.office_bearers ob
    WHERE ob.society_id = NEW.society_id
  LOOP
    INSERT INTO public.notifications (recipient_id, title, body, metadata, type, related_id)
    VALUES (_recipient.uid, _title, _body, _meta, 'emergency', NEW.id);
  END LOOP;

  -- Notify all admins and super_admins
  FOR _recipient IN
    SELECT DISTINCT ur.user_id as uid
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'super_admin')
  LOOP
    INSERT INTO public.notifications (recipient_id, title, body, metadata, type, related_id)
    VALUES (_recipient.uid, _title, _body, _meta, 'emergency', NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger on emergency_alerts insert
CREATE TRIGGER on_emergency_alert_created
  AFTER INSERT ON public.emergency_alerts
  FOR EACH ROW EXECUTE FUNCTION public.notify_emergency_alert();
