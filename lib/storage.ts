import { supabase, isSupabaseConfigured } from "./supabase"
import type { ProcessedImage } from "./image-processing"

export interface UploadedImageSet {
  thumbnail: { url: string; path: string }
  medium: { url: string; path: string }
  full: { url: string; path: string }
  original: { url: string; path: string }
}

// Upload a processed image set to Supabase Storage
export async function uploadImageSet(
  processedImages: ProcessedImage,
  bowlId: string,
): Promise<UploadedImageSet | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.error("Supabase not configured")
    return null
  }

  try {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(7)
    const baseFileName = `${timestamp}-${randomId}`

    const results: Partial<UploadedImageSet> = {}

    // Upload each size
    const sizes: (keyof ProcessedImage)[] = ["thumbnail", "medium", "full", "original"]

    for (const size of sizes) {
      const base64Image = processedImages[size]
      const filePath = `bowls/${bowlId}/${size}/${baseFileName}.jpg`

      try {
        const uploadResult = await uploadSingleImage(base64Image, filePath)
        if (uploadResult) {
          results[size] = uploadResult
        } else {
          throw new Error(`Failed to upload ${size} image`)
        }
      } catch (error) {
        console.error(`Error uploading ${size} image:`, error)
        // Clean up any successful uploads
        await cleanupPartialUpload(results)
        throw error
      }
    }

    return results as UploadedImageSet
  } catch (error) {
    console.error("Error in uploadImageSet:", error)
    return null
  }
}

// Upload a single image
async function uploadSingleImage(base64Image: string, filePath: string): Promise<{ url: string; path: string } | null> {
  if (!supabase) return null

  try {
    // Extract the file data from the base64 string
    const [meta, data] = base64Image.split(",")
    if (!meta || !data) {
      throw new Error("Invalid base64 image format")
    }

    const mimeType = "image/jpeg" // We're converting everything to JPEG for consistency

    // Convert base64 to bytes
    const binaryString = atob(data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    console.log(`Uploading image to path: ${filePath}`)

    // Upload to Supabase Storage
    const { data: uploadData, error } = await supabase.storage.from("bowl-images").upload(filePath, bytes, {
      contentType: mimeType,
      upsert: true,
    })

    if (error) {
      console.error("Storage upload error:", error)
      throw new Error(`Storage upload failed: ${error.message}`)
    }

    console.log("Upload successful:", uploadData)

    // Get the public URL
    const { data: publicUrlData } = supabase.storage.from("bowl-images").getPublicUrl(filePath)

    if (!publicUrlData?.publicUrl) {
      throw new Error("Failed to get public URL for uploaded image")
    }

    return {
      url: publicUrlData.publicUrl,
      path: filePath,
    }
  } catch (error) {
    console.error("Error in uploadSingleImage:", error)
    throw error
  }
}

// Clean up partial uploads if something fails
async function cleanupPartialUpload(partialResults: Partial<UploadedImageSet>) {
  if (!supabase) return

  const pathsToDelete: string[] = []

  Object.values(partialResults).forEach((result) => {
    if (result?.path) {
      pathsToDelete.push(result.path)
    }
  })

  if (pathsToDelete.length > 0) {
    try {
      await supabase.storage.from("bowl-images").remove(pathsToDelete)
      console.log("Cleaned up partial upload:", pathsToDelete)
    } catch (error) {
      console.error("Error cleaning up partial upload:", error)
    }
  }
}

// Legacy function for backward compatibility
export async function uploadImage(base64Image: string, bowlId: string): Promise<{ url: string; path: string } | null> {
  const filePath = `bowls/${bowlId}/legacy/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
  return uploadSingleImage(base64Image, filePath)
}

// Delete an image set (all sizes)
export async function deleteImageSet(imagePaths: string[]): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    console.error("Supabase not configured")
    return false
  }

  try {
    // Filter out empty paths to prevent errors
    const validPaths = imagePaths.filter((path) => path && path.trim().length > 0)

    if (validPaths.length === 0) {
      console.log("No valid image paths to delete")
      return true // Nothing to delete is still a successful operation
    }

    console.log(`Deleting ${validPaths.length} images:`, validPaths)

    // Delete images in batches to avoid potential limitations
    const batchSize = 100
    for (let i = 0; i < validPaths.length; i += batchSize) {
      const batch = validPaths.slice(i, i + batchSize)
      const { error } = await supabase.storage.from("bowl-images").remove(batch)

      if (error) {
        console.error(`Error deleting batch ${i / batchSize + 1}:`, error)
        // Continue with other batches even if one fails
      }
    }

    console.log("Image set deletion completed")
    return true
  } catch (error) {
    console.error("Error in deleteImageSet:", error)
    return false
  }
}

// Delete an image from Supabase Storage (legacy)
export async function deleteImage(path: string): Promise<boolean> {
  return path ? deleteImageSet([path]) : false
}

// Get all image paths for a bowl to clean up when deleting
export async function getBowlImagePaths(bowlId: string): Promise<string[]> {
  if (!isSupabaseConfigured() || !supabase) {
    console.error("Supabase not configured")
    return []
  }

  try {
    console.log(`Fetching image paths for bowl: ${bowlId}`)

    const { data, error } = await supabase
      .from("bowl_images")
      .select("thumbnail_path, medium_path, full_path, original_path, storage_path")
      .eq("bowl_id", bowlId)

    if (error) {
      console.error("Error getting bowl image paths:", error)
      return []
    }

    if (!data || data.length === 0) {
      console.log("No images found for this bowl")
      return []
    }

    console.log(`Found ${data.length} image records`)

    const paths: string[] = []
    data.forEach((item) => {
      // Add all available paths, including legacy storage_path
      if (item.thumbnail_path) paths.push(item.thumbnail_path)
      if (item.medium_path) paths.push(item.medium_path)
      if (item.full_path) paths.push(item.full_path)
      if (item.original_path) paths.push(item.original_path)
      if (item.storage_path) paths.push(item.storage_path)
    })

    console.log(`Collected ${paths.length} total image paths`)
    return paths
  } catch (error) {
    console.error("Error in getBowlImagePaths:", error)
    return []
  }
}
