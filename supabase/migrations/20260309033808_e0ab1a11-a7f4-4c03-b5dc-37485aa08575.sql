
CREATE TABLE public.rent_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_record_id uuid REFERENCES public.payment_records(id) ON DELETE CASCADE NOT NULL,
  owner_user_id uuid NOT NULL,
  tenant_user_id uuid NOT NULL,
  owner_name text NOT NULL,
  tenant_name text NOT NULL,
  unit_id uuid REFERENCES public.units(id) NOT NULL,
  amount numeric NOT NULL,
  period_label text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_number text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rent_receipts ENABLE ROW LEVEL SECURITY;

-- Owners can manage receipts they issued
CREATE POLICY "Owners can manage own receipts"
  ON public.rent_receipts FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Tenants can view receipts issued to them
CREATE POLICY "Tenants can view own receipts"
  ON public.rent_receipts FOR SELECT
  USING (auth.uid() = tenant_user_id);

-- Super admins full access
CREATE POLICY "Super admins can manage rent receipts"
  ON public.rent_receipts FOR ALL
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Generate receipt number sequence
CREATE SEQUENCE IF NOT EXISTS rent_receipt_seq START 1001;
