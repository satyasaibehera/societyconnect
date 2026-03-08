
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS tenancy_start_date date DEFAULT null,
  ADD COLUMN IF NOT EXISTS tenancy_end_date date DEFAULT null,
  ADD COLUMN IF NOT EXISTS has_vacated boolean NOT NULL DEFAULT false;
