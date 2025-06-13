-- Update the bowl_images table to support multiple image sizes

-- Add new columns for different image sizes
ALTER TABLE bowl_images 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
ADD COLUMN IF NOT EXISTS medium_url TEXT,
ADD COLUMN IF NOT EXISTS medium_path TEXT,
ADD COLUMN IF NOT EXISTS full_url TEXT,
ADD COLUMN IF NOT EXISTS full_path TEXT,
ADD COLUMN IF NOT EXISTS original_url TEXT,
ADD COLUMN IF NOT EXISTS original_path TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS original_dimensions JSONB;

-- Update existing records to use the image_url as the full_url for backward compatibility
UPDATE bowl_images 
SET full_url = image_url, 
    full_path = storage_path 
WHERE full_url IS NULL AND image_url IS NOT NULL;

-- The old image_url and storage_path columns are kept for backward compatibility
-- but new uploads will use the size-specific columns

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_bowl_images_bowl_id_order ON bowl_images(bowl_id, display_order);
