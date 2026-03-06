-- =====================================================
-- MIGRATION 004: Create Storage Buckets
-- Run this in Supabase Dashboard > SQL Editor
-- =====================================================

-- Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('private-uploads', 'private-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for uploads bucket (public read, authenticated write)
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Allow public read uploads" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'uploads');

CREATE POLICY "Allow authenticated delete uploads" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'uploads');

-- Policies for private-uploads bucket (authenticated only)
CREATE POLICY "Allow authenticated private uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'private-uploads');

CREATE POLICY "Allow authenticated read private" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'private-uploads');

CREATE POLICY "Allow authenticated delete private" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'private-uploads');
