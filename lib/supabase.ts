import { createClient } from "@supabase/supabase-js"

// These environment variables need to be set in your deployment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseUrl && supabaseAnonKey && supabaseUrl !== "" && supabaseAnonKey !== ""
}

// Create a single supabase client for the entire app (only if configured)
export const supabase = isSupabaseConfigured() ? createClient(supabaseUrl, supabaseAnonKey) : null

// Type definitions for our database tables
export type Bowl = {
  id: string
  wood_type: string
  wood_source: string
  date_made: string
  comments: string | null
  user_id: string | null
  created_at: string
  updated_at: string
}

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
  updated_at: string
}

export type BowlFinish = {
  id: string
  bowl_id: string
  finish_name: string
}

export type BowlImage = {
  id: string
  bowl_id: string
  image_url: string // Legacy field
  storage_path: string // Legacy field
  thumbnail_url?: string
  thumbnail_path?: string
  medium_url?: string
  medium_path?: string
  full_url?: string
  full_path?: string
  original_url?: string
  original_path?: string
  file_size?: number
  original_dimensions?: { width: number; height: number }
  display_order: number
}

export type BowlImageUrls = {
  thumbnail: string
  medium: string
  full: string
  original: string
}

// Helper function to get the best available image URL for each size
export const getImageUrls = (image: BowlImage): BowlImageUrls => {
  return {
    thumbnail: image.thumbnail_url || image.image_url || "/placeholder.svg?height=150&width=150",
    medium: image.medium_url || image.image_url || "/placeholder.svg?height=400&width=400",
    full: image.full_url || image.image_url || "/placeholder.svg?height=800&width=800",
    original: image.original_url || image.image_url || "/placeholder.svg?height=1200&width=1200",
  }
}

// Helper function to convert database bowl to frontend bowl format
export const mapDatabaseBowlToFrontend = async (bowl: Bowl) => {
  if (!supabase) {
    throw new Error("Supabase not configured")
  }

  // Get finishes for this bowl
  const { data: finishesData } = await supabase.from("bowl_finishes").select("finish_name").eq("bowl_id", bowl.id)

  // Get images for this bowl
  const { data: imagesData } = await supabase
    .from("bowl_images")
    .select("*")
    .eq("bowl_id", bowl.id)
    .order("display_order", { ascending: true })

  // Get creator profile if user_id exists
  let creatorName = "Unknown"
  if (bowl.user_id) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", bowl.user_id)
      .single()

    if (profileData) {
      creatorName = profileData.full_name || profileData.email || "Unknown"
    }
  }

  // Process images to get the best available URLs
  const processedImages =
    imagesData?.map((img) => {
      const urls = getImageUrls(img)
      return {
        id: img.id,
        thumbnail: urls.thumbnail,
        medium: urls.medium,
        full: urls.full,
        original: urls.original,
        dimensions: img.original_dimensions,
        fileSize: img.file_size,
      }
    }) || []

  return {
    id: bowl.id,
    woodType: bowl.wood_type,
    woodSource: bowl.wood_source,
    dateMade: bowl.date_made,
    comments: bowl.comments || "",
    finishes: finishesData?.map((f) => f.finish_name) || [],
    images: processedImages,
    createdAt: bowl.created_at,
    userId: bowl.user_id,
    createdBy: creatorName,
  }
}
