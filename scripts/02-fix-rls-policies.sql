-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on bowls" ON bowls;
DROP POLICY IF EXISTS "Allow all operations on bowl_finishes" ON bowl_finishes;
DROP POLICY IF EXISTS "Allow all operations on bowl_images" ON bowl_images;

-- Create more permissive policies for now (you can restrict these later with authentication)
CREATE POLICY "Enable all operations for bowls" ON bowls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for bowl_finishes" ON bowl_finishes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for bowl_images" ON bowl_images FOR ALL USING (true) WITH CHECK (true);

-- Also ensure storage bucket has proper policies
-- Note: You'll need to run this in the Supabase dashboard under Storage > Policies

-- For the bowl-images bucket, create these policies in the Supabase dashboard:
-- 1. Allow SELECT for everyone: bucket_id = 'bowl-images'
-- 2. Allow INSERT for everyone: bucket_id = 'bowl-images'
-- 3. Allow UPDATE for everyone: bucket_id = 'bowl-images'
-- 4. Allow DELETE for everyone: bucket_id = 'bowl-images'
