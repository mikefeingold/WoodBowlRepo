import { supabase, isSupabaseConfigured } from "./supabase"

// Alternative upload method that bypasses some RLS issues
export async function uploadImageAlternative(
  base64Image: string,
  bowlId: string,
): Promise<{ url: string; path: string } | null> {
  if (!isSupabaseConfigured() || !supabase) {
    console.error("Supabase not configured")
    return null
  }

  try {
    // Extract the file data from the base64 string
    const [meta, data] = base64Image.split(",")
    if (!meta || !data) {
      throw new Error("Invalid base64 image format")
    }

    const mimeMatch = meta.match(/data:([^;]+)/)
    if (!mimeMatch) {
      throw new Error("Could not determine image type")
    }

    const mimeType = mimeMatch[1]
    const fileExt = mimeType.split("/")[1] || "jpg"
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    let filePath = `bowls/${bowlId}/${fileName}`

    // Convert base64 to Uint8Array (alternative approach)
    const binaryString = atob(data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    console.log(`Attempting upload to: ${filePath}`)

    // Try multiple upload approaches
    let uploadResult = null
    let lastError = null

    // Approach 1: Direct upload with minimal options
    try {
      const { data: uploadData, error } = await supabase.storage.from("bowl-images").upload(filePath, bytes, {
        contentType: mimeType,
        upsert: true,
      })

      if (!error) {
        uploadResult = uploadData
      } else {
        lastError = error
        console.log("Approach 1 failed:", error.message)
      }
    } catch (e) {
      lastError = e
      console.log("Approach 1 exception:", e)
    }

    // Approach 2: Upload as blob if first approach failed
    if (!uploadResult) {
      try {
        const blob = new Blob([bytes], { type: mimeType })
        const { data: uploadData, error } = await supabase.storage.from("bowl-images").upload(filePath, blob, {
          upsert: true,
        })

        if (!error) {
          uploadResult = uploadData
        } else {
          lastError = error
          console.log("Approach 2 failed:", error.message)
        }
      } catch (e) {
        lastError = e
        console.log("Approach 2 exception:", e)
      }
    }

    // Approach 3: Try with different path structure
    if (!uploadResult) {
      const simplePath = `${bowlId}-${fileName}`
      try {
        const { data: uploadData, error } = await supabase.storage.from("bowl-images").upload(simplePath, bytes, {
          contentType: mimeType,
        })

        if (!error) {
          uploadResult = uploadData
          filePath = simplePath // Update the path
        } else {
          lastError = error
          console.log("Approach 3 failed:", error.message)
        }
      } catch (e) {
        lastError = e
        console.log("Approach 3 exception:", e)
      }
    }

    if (!uploadResult) {
      throw lastError || new Error("All upload approaches failed")
    }

    console.log("Upload successful:", uploadResult)

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
    console.error("Error in uploadImageAlternative:", error)

    // Return a more detailed error
    if (error && typeof error === "object" && "message" in error) {
      throw new Error(`Storage upload failed: ${error.message}`)
    }
    throw error
  }
}

// Fallback: Store image as base64 in database if storage fails
export async function storeImageAsBase64(
  base64Image: string,
  bowlId: string,
  displayOrder: number,
): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null
  }

  try {
    // Store the base64 image directly in the database as a fallback
    const { data, error } = await supabase
      .from("bowl_images")
      .insert({
        bowl_id: bowlId,
        image_url: base64Image, // Store base64 directly
        storage_path: `base64-${Date.now()}`, // Dummy path
        display_order: displayOrder,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return base64Image
  } catch (error) {
    console.error("Error storing base64 image:", error)
    return null
  }
}
