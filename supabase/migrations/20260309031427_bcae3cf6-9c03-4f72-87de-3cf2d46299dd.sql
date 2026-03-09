
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
  _recipient_id uuid;
  _title text;
  _body text;
  _meta jsonb;
BEGIN
  SELECT r.full_name, r.phone, r.email, r.resident_type,
         u.unit_number, b.name
  INTO _raiser_name, _raiser_phone, _raiser_email, _raiser_type,
       _unit_label, _building_name
  FROM public.residents r
  LEFT JOIN public.units u ON r.unit_id = u.id
  LEFT JOIN public.buildings b ON u.building_id = b.id
  WHERE r.user_id = NEW.raised_by AND r.status = 'approved'
  LIMIT 1;

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

  -- Collect all unique recipient user_ids and insert one notification each
  FOR _recipient_id IN
    SELECT DISTINCT uid FROM (
      SELECT ss.user_id AS uid FROM public.security_staff ss
        WHERE ss.user_id IS NOT NULL AND ss.society_id = NEW.society_id
      UNION
      SELECT ob.user_id AS uid FROM public.office_bearers ob
        WHERE ob.society_id = NEW.society_id
      UNION
      SELECT ur.user_id AS uid FROM public.user_roles ur
        WHERE ur.role IN ('admin', 'super_admin')
    ) all_recipients
  LOOP
    INSERT INTO public.notifications (recipient_id, title, body, metadata, type, related_id)
    VALUES (_recipient_id, _title, _body, _meta, 'emergency', NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;
