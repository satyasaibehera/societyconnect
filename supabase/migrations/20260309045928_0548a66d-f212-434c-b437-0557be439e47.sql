
ALTER TABLE public.notices
  ADD COLUMN notice_type text NOT NULL DEFAULT 'notice',
  ADD COLUMN meeting_date date,
  ADD COLUMN attendees text,
  ADD COLUMN key_decisions text,
  ADD COLUMN action_items text;
