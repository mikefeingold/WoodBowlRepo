"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, X, Bug, Camera } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { SupabaseSetup } from "@/components/supabase-setup"
import EnhancedImageUpload, { type ProcessedImageData } from "@/components/enhanced-image-upload"
import { uploadImageSet } from "@/lib/storage"
import { processImage } from "@/lib/image-processing"
import { cameraManager } from "@/lib/pwa-utils"

export default function AddBowlPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    woodType: "",
    woodSource: "",
    dateMade: new Date().toISOString().split("T")[0], // Default to today
    comments: "",
  })
  const [finishes, setFinishes] = useState<string[]>([])
  const [newFinish, setNewFinish] = useState("")
  const [images, setImages] = useState<ProcessedImageData[]>([])
  const [loading, setLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)

  const checkSupabaseConfiguration = () => {
    if (!isSupabaseConfigured()) {
      return <SupabaseSetup />
    }
    return null
  }

  useEffect(() => {
    // Check camera availability
    cameraManager.hasCamera().then(setHasCamera)

    // Load captured images from camera if coming from camera page
    const fromCamera = searchParams.get("from") === "camera"
    if (fromCamera) {
      loadCapturedImages()
    }
  }, [searchParams])

  const loadCapturedImages = async () => {
    try {
      const capturedImagesJson = sessionStorage.getItem("capturedImages")
      if (capturedImagesJson) {
        const capturedImages: string[] = JSON.parse(capturedImagesJson)

        const processedImages: ProcessedImageData[] = []

        for (let i = 0; i < capturedImages.length; i++) {
          const base64 = capturedImages[i]

          // Convert base64 to File object
          const response = await fetch(base64)
          const blob = await response.blob()
          const file = new File([blob], `camera-${i + 1}.jpg`, { type: "image/jpeg" })

          // Process the image
          const processed = await processImage(file)

          processedImages.push({
            id: `camera-${Date.now()}-${i}`,
            file,
            processed,
            dimensions: { width: 1920, height: 1080 }, // Estimate
            fileSize: blob.size,
            isNew: true,
          })
        }

        setImages(processedImages)

        // Clear from session storage
        sessionStorage.removeItem("capturedImages")

        toast({
          title: "Camera Photos Loaded",
          description: `${processedImages.length} photos imported from camera`,
        })
      }
    } catch (error) {
      console.error("Error loading captured images:", error)
      toast({
        title: "Error",
        description: "Failed to load camera photos",
        variant: "destructive",
      })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const addFinish = () => {
    if (newFinish.trim() && !finishes.includes(newFinish.trim())) {
      setFinishes([...finishes, newFinish.trim()])
      setNewFinish("")
    }
  }

  const removeFinish = (finish: string) => {
    setFinishes(finishes.filter((f) => f !== finish))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setDebugInfo(null)

    try {
      if (!supabase) {
        throw new Error("Supabase client not initialized")
      }

      // Log the data we're about to insert
      console.log("Inserting bowl with data:", {
        wood_type: formData.woodType,
        wood_source: formData.woodSource,
        date_made: formData.dateMade,
        comments: formData.comments || null,
      })

      // 1. Insert the bowl record
      const { data: bowlData, error: bowlError } = await supabase
        .from("bowls")
        .insert({
          wood_type: formData.woodType,
          wood_source: formData.woodSource,
          date_made: formData.dateMade,
          comments: formData.comments || null,
        })
        .select()

      if (bowlError) {
        throw new Error(`Failed to create bowl: ${bowlError.message}`)
      }

      if (!bowlData || bowlData.length === 0) {
        throw new Error("No data returned from insert operation")
      }

      const bowlId = bowlData[0].id
      console.log("Bowl created with ID:", bowlId)

      // 2. Insert finishes
      if (finishes.length > 0) {
        const finishesData = finishes.map((finish) => ({
          bowl_id: bowlId,
          finish_name: finish,
        }))

        console.log("Inserting finishes:", finishesData)
        const { error: finishesError } = await supabase.from("bowl_finishes").insert(finishesData)

        if (finishesError) {
          console.error("Error adding finishes:", finishesError)
          setDebugInfo((prev) => `${prev || ""}\nFinish error: ${finishesError.message}`)
        }
      }

      // 3. Upload images and insert image records
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          console.log(`Uploading image ${i + 1} of ${images.length}`)
          const uploadResult = await uploadImageSet(images[i].processed, bowlId)

          if (uploadResult) {
            console.log("Image set uploaded:", uploadResult)

            // Use medium URL and path for the legacy fields to maintain backward compatibility
            const { error: imageError } = await supabase.from("bowl_images").insert({
              bowl_id: bowlId,
              // Add these fields to satisfy the NOT NULL constraint
              image_url: uploadResult.medium.url,
              storage_path: uploadResult.medium.path,
              // New fields
              thumbnail_url: uploadResult.thumbnail.url,
              thumbnail_path: uploadResult.thumbnail.path,
              medium_url: uploadResult.medium.url,
              medium_path: uploadResult.medium.path,
              full_url: uploadResult.full.url,
              full_path: uploadResult.full.path,
              original_url: uploadResult.original.url,
              original_path: uploadResult.original.path,
              file_size: images[i].fileSize,
              original_dimensions: images[i].dimensions,
              display_order: i,
            })

            if (imageError) {
              console.error("Error adding image record:", imageError)
              setDebugInfo((prev) => `${prev || ""}\nImage error: ${imageError.message}`)
            }
          } else {
            console.error("Image upload failed")
            setDebugInfo((prev) => `${prev || ""}\nImage upload failed for image ${i + 1}`)
          }
        }
      }

      toast({
        title: "Bowl Added",
        description: "Your bowl has been successfully added to your collection.",
      })

      router.push(`/bowl/${bowlId}`)
    } catch (error) {
      console.error("Error adding bowl:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setDebugInfo(`Error: ${errorMessage}`)
      toast({
        title: "Error",
        description: "There was a problem adding your bowl. Please try again.",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const supabaseSetupComponent = checkSupabaseConfiguration()

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        {supabaseSetupComponent}
        <div className="mb-6 flex justify-between items-center">
          <Link href="/" className="inline-flex items-center text-amber-700 hover:text-amber-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Collection
          </Link>
          <div className="flex gap-2">
            {hasCamera && (
              <Link href="/camera">
                <Button variant="outline" size="sm">
                  <Camera className="w-4 h-4 mr-2" />
                  Camera
                </Button>
              </Link>
            )}
            <Link href="/debug">
              <Button variant="outline" size="sm">
                <Bug className="w-4 h-4 mr-2" />
                Debug Tools
              </Button>
            </Link>
          </div>
        </div>

        <Card className="max-w-2xl mx-auto bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-amber-900">Add New Bowl</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="woodType">Wood Type *</Label>
                  <Input
                    id="woodType"
                    name="woodType"
                    value={formData.woodType}
                    onChange={handleInputChange}
                    placeholder="e.g., Oak, Maple, Cherry"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="woodSource">Wood Source *</Label>
                  <Input
                    id="woodSource"
                    name="woodSource"
                    value={formData.woodSource}
                    onChange={handleInputChange}
                    placeholder="e.g., Local sawmill, Backyard tree"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="dateMade">Date Made *</Label>
                <Input
                  id="dateMade"
                  name="dateMade"
                  type="date"
                  value={formData.dateMade}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <Label>Finishes Used</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newFinish}
                    onChange={(e) => setNewFinish(e.target.value)}
                    placeholder="e.g., Tung oil, Polyurethane"
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addFinish())}
                  />
                  <Button type="button" onClick={addFinish} variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {finishes.map((finish, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {finish}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => removeFinish(finish)} />
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="comments">Comments</Label>
                <Textarea
                  id="comments"
                  name="comments"
                  value={formData.comments}
                  onChange={handleInputChange}
                  placeholder="Notes about the turning process, challenges, or special features..."
                  rows={4}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Images</Label>
                  {hasCamera && (
                    <Link href="/camera">
                      <Button type="button" variant="outline" size="sm">
                        <Camera className="w-4 h-4 mr-2" />
                        Use Camera
                      </Button>
                    </Link>
                  )}
                </div>
                <EnhancedImageUpload images={images} onImagesChange={setImages} maxImages={10} disabled={loading} />
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700">
                  {loading ? "Saving..." : "Save Bowl"}
                </Button>
                <Link href="/">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="ml-auto"
                  onClick={() => setShowDebug(!showDebug)}
                >
                  <Bug className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </CardContent>
          {debugInfo && showDebug && (
            <CardFooter className="bg-gray-50 border-t">
              <div className="w-full">
                <h3 className="text-sm font-medium mb-2">Debug Information</h3>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">{debugInfo}</pre>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}
