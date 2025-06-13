"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, X, ImageIcon, Loader2, AlertTriangle } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { processImage, validateImageFile, getImageDimensions, type ProcessedImage } from "@/lib/image-processing"

export interface ProcessedImageData {
  id: string
  file: File
  processed: ProcessedImage
  dimensions: { width: number; height: number }
  fileSize: number
  isNew: boolean
}

interface EnhancedImageUploadProps {
  images: ProcessedImageData[]
  onImagesChange: (images: ProcessedImageData[]) => void
  maxImages?: number
  disabled?: boolean
}

export default function EnhancedImageUpload({
  images,
  onImagesChange,
  maxImages = 10,
  disabled = false,
}: EnhancedImageUploadProps) {
  const [processing, setProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      if (disabled) return

      setError(null)
      setProcessing(true)
      setProcessingProgress(0)

      const fileArray = Array.from(files)
      const totalFiles = fileArray.length

      // Check if we'll exceed max images
      if (images.length + totalFiles > maxImages) {
        setError(`Maximum ${maxImages} images allowed. You can add ${maxImages - images.length} more.`)
        setProcessing(false)
        return
      }

      const newImages: ProcessedImageData[] = []

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]

        try {
          // Validate file
          const validation = validateImageFile(file)
          if (!validation.valid) {
            throw new Error(validation.error)
          }

          // Get original dimensions
          const dimensions = await getImageDimensions(file)

          // Process image (resize and compress)
          const processed = await processImage(file)

          const imageData: ProcessedImageData = {
            id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            file,
            processed,
            dimensions,
            fileSize: file.size,
            isNew: true,
          }

          newImages.push(imageData)

          // Update progress
          setProcessingProgress(((i + 1) / totalFiles) * 100)
        } catch (error) {
          console.error("Error processing image:", error)
          setError(`Error processing ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`)
          break
        }
      }

      if (newImages.length > 0) {
        onImagesChange([...images, ...newImages])
      }

      setProcessing(false)
      setProcessingProgress(0)
    },
    [images, onImagesChange, maxImages, disabled],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (disabled) return

      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleFileSelect(files)
      }
    },
    [handleFileSelect, disabled],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const removeImage = useCallback(
    (id: string) => {
      onImagesChange(images.filter((img) => img.id !== id))
    },
    [images, onImagesChange],
  )

  const moveImage = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newImages = [...images]
      const [movedImage] = newImages.splice(fromIndex, 1)
      newImages.splice(toIndex, 0, movedImage)
      onImagesChange(newImages)
    },
    [images, onImagesChange],
  )

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          disabled ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <CardContent className="p-6">
          <div className="text-center" onDrop={handleDrop} onDragOver={handleDragOver}>
            <div className="flex flex-col items-center space-y-3">
              {processing ? (
                <>
                  <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                  <p className="text-sm text-gray-600">Processing images...</p>
                  <Progress value={processingProgress} className="w-full max-w-xs" />
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Drag and drop images here, or click to select</p>
                    <p className="text-xs text-gray-500">
                      Supports JPEG, PNG, WebP, GIF • Max 10MB per image • Up to {maxImages} images
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Images will be automatically optimized and resized</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                    className="hidden"
                    id="image-upload"
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("image-upload")?.click()}
                    disabled={disabled || images.length >= maxImages}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Choose Images
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((imageData, index) => (
            <Card key={imageData.id} className="relative group">
              <CardContent className="p-2">
                <div className="relative aspect-square">
                  <Image
                    src={imageData.processed.medium || "/placeholder.svg"}
                    alt={`Upload ${index + 1}`}
                    fill
                    className="object-cover rounded-md"
                  />

                  {/* Remove Button */}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(imageData.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>

                  {/* New Badge */}
                  {imageData.isNew && <Badge className="absolute bottom-1 left-1 text-xs bg-blue-500">New</Badge>}

                  {/* Image Info */}
                  <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge variant="secondary" className="text-xs">
                      {imageData.dimensions.width}×{imageData.dimensions.height}
                    </Badge>
                  </div>
                </div>

                {/* File Info */}
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <div className="truncate">{imageData.file.name}</div>
                  <div>{formatFileSize(imageData.fileSize)}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image Count */}
      {images.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          {images.length} of {maxImages} images selected
        </div>
      )}
    </div>
  )
}
