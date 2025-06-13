-- Create tables for the wooden bowl tracking application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create bowls table
CREATE TABLE IF NOT EXISTS bowls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wood_type TEXT NOT NULL,
  wood_source TEXT NOT NULL,
  date_made DATE NOT NULL,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create finishes table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS bowl_finishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bowl_id UUID REFERENCES bowls(id) ON DELETE CASCADE,
  finish_name TEXT NOT NULL,
  UNIQUE(bowl_id, finish_name)
);

-- Create images table
CREATE TABLE IF NOT EXISTS bowl_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bowl_id UUID REFERENCES bowls(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  display_order INTEGER DEFAULT 0
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bowl_finishes_bowl_id ON bowl_finishes(bowl_id);
CREATE INDEX IF NOT EXISTS idx_bowl_images_bowl_id ON bowl_images(bowl_id);
