-- Enable Row Level Security on the auth.users table
-- This is usually enabled by default, but let's make sure

-- Add user_id column to bowls table
ALTER TABLE bowls ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create a profile table for user information
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles table
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Update RLS policies for bowls table to include user ownership
DROP POLICY IF EXISTS "Enable read access for all users" ON bowls;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON bowls;
DROP POLICY IF EXISTS "Enable update for users based on email" ON bowls;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON bowls;

-- New policies for bowls with user ownership
CREATE POLICY "Enable read access for all users" ON bowls
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON bowls
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for bowl owners only" ON bowls
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for bowl owners only" ON bowls
  FOR DELETE USING (auth.uid() = user_id);

-- Update RLS policies for bowl_finishes table
DROP POLICY IF EXISTS "Enable read access for all users" ON bowl_finishes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON bowl_finishes;
DROP POLICY IF EXISTS "Enable update for users based on email" ON bowl_finishes;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON bowl_finishes;

CREATE POLICY "Enable read access for all users" ON bowl_finishes
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for bowl owners only" ON bowl_finishes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bowls 
      WHERE bowls.id = bowl_finishes.bowl_id 
      AND bowls.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable update for bowl owners only" ON bowl_finishes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bowls 
      WHERE bowls.id = bowl_finishes.bowl_id 
      AND bowls.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable delete for bowl owners only" ON bowl_finishes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM bowls 
      WHERE bowls.id = bowl_finishes.bowl_id 
      AND bowls.user_id = auth.uid()
    )
  );

-- Update RLS policies for bowl_images table
DROP POLICY IF EXISTS "Enable read access for all users" ON bowl_images;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON bowl_images;
DROP POLICY IF EXISTS "Enable update for users based on email" ON bowl_images;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON bowl_images;

CREATE POLICY "Enable read access for all users" ON bowl_images
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for bowl owners only" ON bowl_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bowls 
      WHERE bowls.id = bowl_images.bowl_id 
      AND bowls.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable update for bowl owners only" ON bowl_images
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bowls 
      WHERE bowls.id = bowl_images.bowl_id 
      AND bowls.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable delete for bowl owners only" ON bowl_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM bowls 
      WHERE bowls.id = bowl_images.bowl_id 
      AND bowls.user_id = auth.uid()
    )
  );

-- Create a function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
