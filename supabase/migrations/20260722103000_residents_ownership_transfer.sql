-- Standalone migration: ownership transfer fields on residents (registration table)
-- Safe to run on Neon (public / society_connect) and Supabase.

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS is_ownership_transfer boolean NOT NULL DEFAULT false;

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS supporting_document_url text;

COMMENT ON COLUMN public.residents.is_ownership_transfer IS
  'True when the registrant claims Flat Owner on a unit that already has an approved owner (ownership transfer claim).';

COMMENT ON COLUMN public.residents.supporting_document_url IS
  'URL of uploaded proof of ownership (Sale Deed, Index II, or Tax Receipt) for ownership transfer claims.';

-- Optional index for admin approval queues filtering transfer claims
CREATE INDEX IF NOT EXISTS idx_residents_ownership_transfer
  ON public.residents (society_id, is_ownership_transfer)
  WHERE is_ownership_transfer = true;
