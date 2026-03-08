
-- Create office bearer designation enum
CREATE TYPE public.office_bearer_designation AS ENUM (
  'president',
  'vice_president',
  'secretary',
  'joint_secretary',
  'treasurer',
  'joint_treasurer',
  'ward_leader'
);

-- Create office_bearers table
CREATE TABLE public.office_bearers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  designation office_bearer_designation NOT NULL,
  is_approver BOOLEAN NOT NULL DEFAULT false,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, society_id)
);

-- Enable RLS
ALTER TABLE public.office_bearers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Office bearers viewable by authenticated"
  ON public.office_bearers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage office bearers"
  ON public.office_bearers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage office bearers"
  ON public.office_bearers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add updated_at trigger
CREATE TRIGGER update_office_bearers_updated_at
  BEFORE UPDATE ON public.office_bearers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
