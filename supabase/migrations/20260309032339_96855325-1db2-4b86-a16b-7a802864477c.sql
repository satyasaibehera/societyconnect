
-- Payment categories configured by society admin
CREATE TABLE public.payment_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES public.societies(id),
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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment categories viewable by authenticated"
  ON public.payment_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can manage payment categories"
  ON public.payment_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage payment categories"
  ON public.payment_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_payment_categories_updated_at
  BEFORE UPDATE ON public.payment_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Owner bank details for rent payments (no raw bank details stored long-term — only UPI ID + display info)
CREATE TABLE public.owner_payment_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.units(id),
  upi_id text,
  account_holder_name text,
  bank_name text,
  rent_amount numeric(12,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, unit_id)
);

ALTER TABLE public.owner_payment_config ENABLE ROW LEVEL SECURITY;

-- Owner can manage own config
CREATE POLICY "Owners can manage own payment config"
  ON public.owner_payment_config FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Tenants in same unit can view owner config (to generate QR)
CREATE POLICY "Unit members can view owner payment config"
  ON public.owner_payment_config FOR SELECT TO authenticated
  USING (is_unit_member(auth.uid(), unit_id));

-- Super admins can manage
CREATE POLICY "Super admins can manage owner payment config"
  ON public.owner_payment_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_owner_payment_config_updated_at
  BEFORE UPDATE ON public.owner_payment_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payment records for tracking
CREATE TABLE public.payment_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES public.societies(id),
  payer_user_id uuid NOT NULL,
  payment_type text NOT NULL,
  category_id uuid REFERENCES public.payment_categories(id),
  owner_config_id uuid REFERENCES public.owner_payment_config(id),
  amount numeric(12,2) NOT NULL,
  transaction_ref text,
  notes text,
  status text NOT NULL DEFAULT 'declared',
  declared_at timestamp with time zone NOT NULL DEFAULT now(),
  verified_at timestamp with time zone,
  verified_by uuid,
  rejection_reason text,
  period_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- Payers can view own records
CREATE POLICY "Users can view own payment records"
  ON public.payment_records FOR SELECT TO authenticated
  USING (auth.uid() = payer_user_id);

-- Payers can insert own records
CREATE POLICY "Users can create own payment records"
  ON public.payment_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = payer_user_id);

-- Admins can manage all records (verify, etc.)
CREATE POLICY "Admins can manage payment records"
  ON public.payment_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can manage payment records"
  ON public.payment_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Owners can view and update rent payment records for their unit
CREATE POLICY "Owners can view rent payments for their unit"
  ON public.payment_records FOR SELECT TO authenticated
  USING (
    payment_type = 'rent' AND owner_config_id IN (
      SELECT id FROM public.owner_payment_config WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update rent payments for their unit"
  ON public.payment_records FOR UPDATE TO authenticated
  USING (
    payment_type = 'rent' AND owner_config_id IN (
      SELECT id FROM public.owner_payment_config WHERE owner_user_id = auth.uid()
    )
  );

CREATE TRIGGER update_payment_records_updated_at
  BEFORE UPDATE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
