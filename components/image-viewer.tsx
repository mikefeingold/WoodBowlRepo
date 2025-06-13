"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, X, Download, ZoomIn, ZoomOut, RotateCw } from "lucide-react"

interface ImageData {
  id: string
  thumbnail: string
  medium: string
  full: string
  original: string
  dimensions?: { width: number; height: number }
  fileSize?: number
}

interface ImageViewerProps {
  images: ImageData[]
  initialIndex?: number
  isOpen: boolean
  onClose: () => void
}

export default function ImageViewer({ images, initialIndex = 0, isOpen, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    setCurrentIndex(initialIndex)
    setZoom(1)
    setRotation(0)
  }, [initialIndex, isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case "Escape":
          onClose()
          break
        case "ArrowLeft":
          goToPrevious()
          break
        case "ArrowRight":
          goToNext()
          break
        case "+":
        case "=":
          zoomIn()
          break
        case "-":
          zoomOut()
          break
        case "r":
          rotate()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, currentIndex])

  if (!images || !images.length) return null

  // Ensure currentIndex is within bounds
  const safeIndex = Math.max(0, Math.min(currentIndex, images.length - 1))
  const currentImage = images[safeIndex] || {}

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
    setZoom(1)
    setRotation(0)
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
    setZoom(1)
    setRotation(0)
  }

  const zoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.2, 3))
  }

  const zoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.2, 0.5))
  }

  const rotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const resetView = () => {
    setZoom(1)
    setRotation(0)
  }

  const downloadImage = () => {
    if (!currentImage.original) return

    const link = document.createElement("a")
    link.href = currentImage.original
    link.download = `bowl-image-${safeIndex + 1}.jpg`
    link.click()
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ""
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-full h-[90vh] p-0 bg-black/95">
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-white/20 text-white">
                  {safeIndex + 1} of {images.length}
                </Badge>
                {currentImage?.dimensions && (
                  <Badge variant="secondary" className="bg-white/20 text-white">
                    {currentImage.dimensions.width} × {currentImage.dimensions.height}
                  </Badge>
                )}
                {currentImage?.fileSize && (
                  <Badge variant="secondary" className="bg-white/20 text-white">
                    {formatFileSize(currentImage.fileSize)}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Main Image */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            <div
              className="relative transition-transform duration-200 ease-out"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              <Image
                src={currentImage?.full || "/placeholder.svg?height=800&width=800"}
                alt={`Bowl image ${safeIndex + 1}`}
                width={800}
                height={800}
                className="max-w-full max-h-full object-contain"
                priority
              />
            </div>

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 w-12 h-12"
                  onClick={goToPrevious}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 w-12 h-12"
                  onClick={goToNext}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/50 to-transparent p-4">
            <div className="flex items-center justify-center gap-2">
              <Button variant="ghost" size="icon" onClick={zoomOut} className="text-white hover:bg-white/20">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={resetView} className="text-white hover:bg-white/20">
                {Math.round(zoom * 100)}%
              </Button>
              <Button variant="ghost" size="icon" onClick={zoomIn} className="text-white hover:bg-white/20">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <div className="w-px h-6 bg-white/20 mx-2" />
              <Button variant="ghost" size="icon" onClick={rotate} className="text-white hover:bg-white/20">
                <RotateCw className="w-4 h-4" />
              </Button>
              <div className="w-px h-6 bg-white/20 mx-2" />
              <Button
                variant="ghost"
                size="icon"
                onClick={downloadImage}
                className="text-white hover:bg-white/20"
                disabled={!currentImage?.original}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10">
              <div className="flex gap-2 bg-black/50 rounded-lg p-2 max-w-md overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={image.id || index}
                    onClick={() => {
                      setCurrentIndex(index)
                      setZoom(1)
                      setRotation(0)
                    }}
                    className={`relative w-12 h-12 rounded overflow-hidden flex-shrink-0 ${
                      index === safeIndex ? "ring-2 ring-white" : "opacity-60 hover:opacity-80"
                    }`}
                  >
                    <Image
                      src={image?.thumbnail || "/placeholder.svg?height=75&width=75"}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      className="object-contain bg-white/30"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
