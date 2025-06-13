// Image processing utilities for compression and resizing

export interface ProcessedImage {
  thumbnail: string // 150x150 for grid view
  medium: string // 400x400 for detail view
  full: string // 800x800 max for full view
  original: string // Original size (compressed)
}

export interface ImageDimensions {
  width: number
  height: number
}

// Compress and resize image to multiple sizes
export async function processImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      try {
        const processed = {
          thumbnail: resizeImage(img, 150, 150, 0.8),
          medium: resizeImage(img, 400, 400, 0.85),
          full: resizeImage(img, 800, 800, 0.9),
          original: resizeImage(img, 1200, 1200, 0.95), // Compress but keep larger
        }
        resolve(processed)
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = URL.createObjectURL(file)
  })
}

// Resize image to fit within max dimensions while maintaining aspect ratio
function resizeImage(img: HTMLImageElement, maxWidth: number, maxHeight: number, quality: number): string {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!

  // Calculate new dimensions maintaining aspect ratio
  const { width, height } = calculateDimensions(img.width, img.height, maxWidth, maxHeight)

  canvas.width = width
  canvas.height = height

  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  // Draw the resized image
  ctx.drawImage(img, 0, 0, width, height)

  // Convert to base64 with compression
  return canvas.toDataURL("image/jpeg", quality)
}

// Calculate new dimensions maintaining aspect ratio
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
): ImageDimensions {
  let { width, height } = { width: originalWidth, height: originalHeight }

  // Scale down if larger than max dimensions
  if (width > maxWidth) {
    height = (height * maxWidth) / width
    width = maxWidth
  }

  if (height > maxHeight) {
    width = (width * maxHeight) / height
    height = maxHeight
  }

  return { width: Math.round(width), height: Math.round(height) }
}

// Get image dimensions from file
export function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = URL.createObjectURL(file)
  })
}

// Validate image file
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "File must be an image" }
  }

  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: "Image must be smaller than 10MB" }
  }

  // Check supported formats
  const supportedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
  if (!supportedTypes.includes(file.type)) {
    return { valid: false, error: "Supported formats: JPEG, PNG, WebP, GIF" }
  }

  return { valid: true }
}

// Convert base64 to blob for more efficient storage
export function base64ToBlob(base64: string): Blob {
  const [header, data] = base64.split(",")
  const mimeMatch = header.match(/data:([^;]+)/)
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg"

  const byteString = atob(data)
  const arrayBuffer = new ArrayBuffer(byteString.length)
  const uint8Array = new Uint8Array(arrayBuffer)

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i)
  }

  return new Blob([arrayBuffer], { type: mimeType })
}
