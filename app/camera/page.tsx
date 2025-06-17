"use client"

/**
 * Camera Page Component
 *
 * This page provides camera functionality for capturing bowl images:
 * - Live camera preview with front/back camera switching
 * - Photo capture with flash effect
 * - Multiple photo capture and preview
 * - Integration with add bowl form (preserves form data)
 *
 * Features:
 * - Camera availability detection
 * - Error handling for camera access
 * - Image preview with deletion capability
 * - Seamless integration with form workflow
 */

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Camera, X, RotateCcw, ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { cameraManager } from "@/lib/pwa-utils"

export default function CameraPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Camera state
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImages, setCapturedImages] = useState<string[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [hasCamera, setHasCamera] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize camera on component mount
  useEffect(() => {
    checkCameraAvailability()
    return () => {
      stopCamera()
    }
  }, [])

  /**
   * Check if camera is available and start it if possible
   */
  const checkCameraAvailability = async () => {
    try {
      const available = await cameraManager.hasCamera()
      setHasCamera(available)

      if (available) {
        await startCamera()
      } else {
        setError("No camera available on this device")
      }
    } catch (err) {
      setError("Failed to access camera")
    } finally {
      setLoading(false)
    }
  }

  /**
   * Start the camera stream with current facing mode
   */
  const startCamera = async () => {
    try {
      setError(null)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported in this browser")
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      setStream(mediaStream)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      console.error("Camera access failed:", err)
      setError("Camera access denied or not available")
    }
  }

  /**
   * Stop the camera stream and clean up resources
   */
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }

  /**
   * Switch between front and back camera
   */
  const switchCamera = async () => {
    stopCamera()
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
    setTimeout(startCamera, 100)
  }

  /**
   * Capture a photo from the video stream
   * Adds flash effect and stores image as base64
   */
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    setIsCapturing(true)

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")!

    // Set canvas size to video size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0)

    // Convert to base64 with good quality
    const imageData = canvas.toDataURL("image/jpeg", 0.8)
    setCapturedImages((prev) => [...prev, imageData])

    // Create flash effect
    if (typeof document !== "undefined") {
      const flashDiv = document.createElement("div")
      flashDiv.style.position = "fixed"
      flashDiv.style.top = "0"
      flashDiv.style.left = "0"
      flashDiv.style.width = "100%"
      flashDiv.style.height = "100%"
      flashDiv.style.backgroundColor = "white"
      flashDiv.style.zIndex = "9999"
      flashDiv.style.opacity = "0.8"
      document.body.appendChild(flashDiv)

      setTimeout(() => {
        if (document.body.contains(flashDiv)) {
          document.body.removeChild(flashDiv)
        }
        setIsCapturing(false)
      }, 150)
    } else {
      setIsCapturing(false)
    }
  }

  /**
   * Remove a captured image from the preview
   */
  const removeImage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index))
  }

  /**
   * Proceed with captured images - store in sessionStorage and return to add page
   * The add page will automatically load these images and restore form data
   */
  const proceedWithImages = () => {
    // Store images in sessionStorage for the add page to pick up
    if (typeof window !== "undefined") {
      sessionStorage.setItem("capturedImages", JSON.stringify(capturedImages))
    }

    // Navigate back to add page with camera flag
    router.push("/add?from=camera")
  }

  /**
   * Go back to add page without saving images
   */
  const goBackToAdd = () => {
    // If there are captured images, confirm before discarding
    if (capturedImages.length > 0) {
      const shouldDiscard = window.confirm(
        `You have ${capturedImages.length} captured image${capturedImages.length !== 1 ? "s" : ""}. Are you sure you want to discard them?`,
      )
      if (!shouldDiscard) {
        return
      }
    }

    router.push("/add")
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-white text-center">
          <Camera className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p>Checking camera availability...</p>
        </div>
      </div>
    )
  }

  // Error state - no camera or access denied
  if (!hasCamera || error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Camera Not Available</h2>
            <p className="text-gray-600 mb-4">
              {error || "Your device doesn't have a camera or camera access is not supported."}
            </p>
            <Button onClick={goBackToAdd} className="w-full">
              Continue Without Camera
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Header with navigation and status */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={goBackToAdd}>
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Badge variant="secondary" className="bg-white/20 text-white">
            {capturedImages.length} photo{capturedImages.length !== 1 ? "s" : ""}
          </Badge>

          <Button
            variant="ghost"
            size="icon"
            onClick={switchCamera}
            className="text-white hover:bg-white/20"
            title="Switch camera"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Camera View */}
      <div className="relative w-full h-screen">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        <canvas ref={canvasRef} className="hidden" />

        {/* Camera Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-6">
          <div className="flex items-center justify-center space-x-8">
            {/* Capture Button */}
            <Button
              size="icon"
              onClick={capturePhoto}
              disabled={isCapturing}
              className="w-16 h-16 rounded-full bg-white hover:bg-gray-200 text-black border-4 border-white/50"
              title="Capture photo"
            >
              <Camera className="w-8 h-8" />
            </Button>

            {/* Proceed Button - only show if images captured */}
            {capturedImages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={proceedWithImages}
                className="text-white hover:bg-white/20"
                title={`Continue with ${capturedImages.length} photo${capturedImages.length !== 1 ? "s" : ""}`}
              >
                <Check className="w-6 h-6" />
              </Button>
            )}
          </div>
        </div>

        {/* Captured Images Preview */}
        {capturedImages.length > 0 && (
          <div className="absolute bottom-24 left-4 right-4">
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {capturedImages.map((image, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-white/50">
                    <Image
                      src={image || "/placeholder.svg"}
                      alt={`Captured ${index + 1}`}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                    title="Delete photo"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Camera Guidelines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-white/30 rounded-lg"></div>
          </div>
        </div>
      </div>

      {/* Error overlay */}
      {error && <div className="absolute top-20 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg">{error}</div>}
    </div>
  )
}
