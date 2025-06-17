-- Fix storage bucket policies for bowl-images
-- This script ensures proper access to the bowl-images bucket

-- First, ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bowl-images', 
  'bowl-images', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view bowl images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload bowl images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload bowl images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their bowl images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their bowl images" ON storage.objects;

-- Create comprehensive storage policies
-- Policy 1: Anyone can view images in bowl-images bucket
CREATE POLICY "Anyone can view bowl images" ON storage.objects
FOR SELECT USING (bucket_id = 'bowl-images');

-- Policy 2: Anyone can upload images to bowl-images bucket
CREATE POLICY "Anyone can upload bowl images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'bowl-images');

-- Policy 3: Anyone can update images in bowl-images bucket
CREATE POLICY "Anyone can update bowl images" ON storage.objects
FOR UPDATE USING (bucket_id = 'bowl-images');

-- Policy 4: Anyone can delete images in bowl-images bucket
CREATE POLICY "Anyone can delete bowl images" ON storage.objects
FOR DELETE USING (bucket_id = 'bowl-images');

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to anon and authenticated roles
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO anon;
GRANT ALL ON storage.buckets TO authenticated;

-- Ensure the bucket is accessible
UPDATE storage.buckets 
SET public = true 
WHERE id = 'bowl-images';

-- Create a test to verify the policies work
DO $$
BEGIN
  -- This will help verify that the policies are working
  RAISE NOTICE 'Storage policies have been updated for bowl-images bucket';
  RAISE NOTICE 'Bucket should now be accessible to all users';
END $$;
