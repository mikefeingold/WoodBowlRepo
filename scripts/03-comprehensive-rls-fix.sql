-- Comprehensive RLS and Storage Policy Fix

-- 1. Disable RLS temporarily on all tables to ensure they work
ALTER TABLE bowls DISABLE ROW LEVEL SECURITY;
ALTER TABLE bowl_finishes DISABLE ROW LEVEL SECURITY;
ALTER TABLE bowl_images DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies
DROP POLICY IF EXISTS "Enable all operations for bowls" ON bowls;
DROP POLICY IF EXISTS "Enable all operations for bowl_finishes" ON bowl_finishes;
DROP POLICY IF EXISTS "Enable all operations for bowl_images" ON bowl_images;

-- 3. Re-enable RLS with permissive policies
ALTER TABLE bowls ENABLE ROW LEVEL SECURITY;
ALTER TABLE bowl_finishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bowl_images ENABLE ROW LEVEL SECURITY;

-- 4. Create very permissive policies
CREATE POLICY "Allow all for bowls" ON bowls FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for bowl_finishes" ON bowl_finishes FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for bowl_images" ON bowl_images FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. Grant necessary permissions
GRANT ALL ON bowls TO public;
GRANT ALL ON bowl_finishes TO public;
GRANT ALL ON bowl_images TO public;
GRANT USAGE ON SCHEMA public TO public;

-- Note: After running this script, you also need to configure storage policies
-- in the Supabase dashboard under Storage > Policies for the "bowl-images" bucket
