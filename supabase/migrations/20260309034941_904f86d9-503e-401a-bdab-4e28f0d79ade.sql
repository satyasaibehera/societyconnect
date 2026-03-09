
INSERT INTO storage.buckets (id, name, public)
VALUES ('resident-photos', 'resident-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload resident photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resident-photos');

CREATE POLICY "Anyone can view resident photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'resident-photos');

CREATE POLICY "Users can update own resident photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resident-photos');

CREATE POLICY "Users can delete own resident photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resident-photos');
