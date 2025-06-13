"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Upload, X, AlertTriangle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase, mapDatabaseBowlToFrontend, isSupabaseConfigured } from "@/lib/supabase"
import { uploadImage, deleteImage } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"
import { SupabaseSetup } from "@/components/supabase-setup"

interface Bowl {
  id: string
  woodType: string
  woodSource: string
  dateMade: string
  finishes: string[]
  comments: string
  images: string[]
  createdAt: string
}

interface ImageData {
  url: string
  isNew: boolean
  id?: string
  path?: string
}

export default function EditBowlPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    woodType: "",
    woodSource: "",
    dateMade: "",
    comments: "",
  })
  const [finishes, setFinishes] = useState<string[]>([])
  const [newFinish, setNewFinish] = useState("")
  const [images, setImages] = useState<ImageData[]>([])
  const [loading, setLoading] = useState(false)
  const [bowl, setBowl] = useState<Bowl | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [supabaseConfigured, setSupabaseConfigured] = useState(false)

  useEffect(() => {
    setSupabaseConfigured(isSupabaseConfigured())
  }, [])

  useEffect(() => {
    async function fetchBowl() {
      if (!supabaseConfigured) return

      try {
        if (!supabase) {
          throw new Error("Supabase client not available")
        }

        // Fetch the bowl from Supabase
        const { data, error } = await supabase.from("bowls").select("*").eq("id", params.id).single()

        if (error || !data) {
          console.error("Error fetching bowl:", error)
          setInitialLoading(false)
          return
        }

        // Map database bowl to frontend format
        const mappedBowl = await mapDatabaseBowlToFrontend(data)
        setBowl(mappedBowl)

        // Set form data
        setFormData({
          woodType: mappedBowl.woodType,
          woodSource: mappedBowl.woodSource,
          dateMade: mappedBowl.dateMade,
          comments: mappedBowl.comments,
        })

        setFinishes(mappedBowl.finishes)

        // Get image data with IDs and paths
        const { data: imageData } = await supabase
          .from("bowl_images")
          .select("*")
          .eq("bowl_id", params.id)
          .order("display_order", { ascending: true })

        if (imageData) {
          setImages(
            imageData.map((img) => ({
              url: img.image_url,
              isNew: false,
              id: img.id,
              path: img.storage_path,
            })),
          )
        }
      } catch (error) {
        console.error("Error in fetchBowl:", error)
      } finally {
        setInitialLoading(false)
      }
    }

    fetchBowl()
  }, [params.id, supabaseConfigured])

  if (!supabaseConfigured) {
    return <SupabaseSetup />
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setUploadError(null)
      Array.from(files).forEach((file) => {
        // Check file size (limit to 10MB)
        if (file.size > 10 * 1024 * 1024) {
          setUploadError("Image files must be smaller than 10MB")
          return
        }

        // Check file type
        if (!file.type.startsWith("image/")) {
          setUploadError("Only image files are allowed")
          return
        }

        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target?.result) {
            setImages((prev) => [
              ...prev,
              {
                url: event.target!.result as string,
                isNew: true,
              },
            ])
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeImage = async (index: number) => {
    const imageToRemove = images[index]

    // If it's an existing image, mark it for deletion in the database
    if (!imageToRemove.isNew && imageToRemove.id && imageToRemove.path) {
      try {
        // We'll delete from storage when saving the form
        setImages(images.filter((_, i) => i !== index))
      } catch (error) {
        console.error("Error marking image for deletion:", error)
        toast({
          title: "Error",
          description: "Failed to remove image. Please try again.",
          variant: "destructive",
        })
      }
    } else {
      // For new images, just remove from the array
      setImages(images.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bowl || !supabase) return

    setLoading(true)
    setUploadError(null)

    try {
      // 1. Update the bowl record
      const { error: bowlError } = await supabase
        .from("bowls")
        .update({
          wood_type: formData.woodType,
          wood_source: formData.woodSource,
          date_made: formData.dateMade,
          comments: formData.comments || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bowl.id)

      if (bowlError) {
        throw new Error(`Failed to update bowl: ${bowlError.message}`)
      }

      // 2. Update finishes - delete all and re-add
      await supabase.from("bowl_finishes").delete().eq("bowl_id", bowl.id)

      if (finishes.length > 0) {
        const finishesData = finishes.map((finish) => ({
          bowl_id: bowl.id,
          finish_name: finish,
        }))

        const { error: finishesError } = await supabase.from("bowl_finishes").insert(finishesData)
        if (finishesError) {
          console.error("Error updating finishes:", finishesError)
          // Don't fail the whole operation for finishes
        }
      }

      // 3. Handle images
      // First, identify which existing images were removed
      const existingImageIds = images.filter((img) => !img.isNew).map((img) => img.id)

      // Get all image records for this bowl
      const { data: currentImages } = await supabase
        .from("bowl_images")
        .select("id, storage_path")
        .eq("bowl_id", bowl.id)

      if (currentImages) {
        // Find images to delete
        const imagesToDelete = currentImages.filter((img) => !existingImageIds.includes(img.id))

        // Delete from storage and database
        for (const img of imagesToDelete) {
          try {
            await deleteImage(img.storage_path)
            await supabase.from("bowl_images").delete().eq("id", img.id)
          } catch (error) {
            console.error("Error deleting image:", error)
            // Continue with other operations
          }
        }
      }

      // Upload new images with better error handling
      const newImages = images.filter((img) => img.isNew)
      let uploadErrors = 0
      let uploadedCount = 0

      for (let i = 0; i < newImages.length; i++) {
        try {
          console.log(`Uploading image ${i + 1} of ${newImages.length}`)
          const uploadResult = await uploadImage(newImages[i].url, bowl.id)

          if (uploadResult) {
            const { error: imageError } = await supabase.from("bowl_images").insert({
              bowl_id: bowl.id,
              image_url: uploadResult.url,
              storage_path: uploadResult.path,
              display_order: i + (images.length - newImages.length),
            })

            if (imageError) {
              console.error("Error adding image record:", imageError)
              uploadErrors++
            } else {
              uploadedCount++
            }
          } else {
            // Storage failed, but don't fail the whole operation
            console.error(`Failed to upload image ${i + 1}`)
            uploadErrors++
            setUploadError(`Image ${i + 1} failed to upload. This may be due to storage permissions.`)
          }
        } catch (error) {
          console.error("Error uploading image:", error)
          uploadErrors++
          setUploadError(`Failed to upload image ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }

      // Show appropriate success/error messages
      if (uploadErrors > 0 && uploadedCount > 0) {
        toast({
          title: "Partial Success",
          description: `Bowl updated. ${uploadedCount} image(s) uploaded, ${uploadErrors} failed. Check storage permissions.`,
          variant: "destructive",
        })
      } else if (uploadErrors > 0) {
        toast({
          title: "Upload Issues",
          description: `Bowl updated, but ${uploadErrors} image(s) failed to upload. Check storage configuration.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Bowl Updated",
          description: "Your bowl has been successfully updated.",
        })
      }

      // Update display order for all remaining images
      const nonNewImages = images.filter((img) => !img.isNew)
      for (let i = 0; i < nonNewImages.length; i++) {
        if (nonNewImages[i].id) {
          try {
            await supabase.from("bowl_images").update({ display_order: i }).eq("id", nonNewImages[i].id)
          } catch (error) {
            console.error("Error updating image order:", error)
            // Non-critical error, continue
          }
        }
      }

      if (uploadErrors > 0) {
        toast({
          title: "Partial Success",
          description: `Bowl updated, but ${uploadErrors} image(s) failed to upload. Please try uploading them again.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Bowl Updated",
          description: "Your bowl has been successfully updated.",
        })
      }

      router.push(`/bowl/${bowl.id}`)
    } catch (error) {
      console.error("Error updating bowl:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setUploadError(errorMessage)
      toast({
        title: "Error",
        description: "There was a problem updating your bowl. Please try again.",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-lg">Loading bowl details...</div>
      </div>
    )
  }

  if (!bowl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amber-900 mb-4">Bowl Not Found</h2>
          <Link href="/">
            <Button className="bg-amber-600 hover:bg-amber-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Collection
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href={`/bowl/${params.id}`} className="inline-flex items-center text-amber-700 hover:text-amber-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Bowl Details
          </Link>
        </div>

        <Card className="max-w-2xl mx-auto bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-amber-900">Edit Bowl</CardTitle>
          </CardHeader>
          <CardContent>
            {uploadError && (
              <Alert className="mb-6 border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  <strong>Upload Error:</strong> {uploadError}
                  <div className="mt-2 text-sm">
                    This might be due to storage permissions. Try running the SQL script to fix RLS policies, or check
                    your Supabase storage bucket settings.
                  </div>
                </AlertDescription>
              </Alert>
            )}

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
                <Label htmlFor="images">Images</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Upload additional images or replace existing ones</p>
                  <p className="text-xs text-gray-500 mb-3">
                    Maximum file size: 10MB. Supported formats: JPG, PNG, GIF
                  </p>
                  <Input
                    id="images"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" onClick={() => document.getElementById("images")?.click()}>
                    Choose Images
                  </Button>
                </div>
                {images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative">
                        <Image
                          src={image.url || "/placeholder.svg?height=150&width=200"}
                          alt={`Bowl image ${index + 1}`}
                          width={200}
                          height={150}
                          className="w-full h-24 object-cover rounded-md"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 w-6 h-6 p-0"
                          onClick={() => removeImage(index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                        {image.isNew && <Badge className="absolute bottom-1 left-1 text-xs bg-blue-500">New</Badge>}
                      </div>
                    ))}
                  </div>
                )}
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

              <div className="flex gap-4">
                <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700">
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
                <Link href={`/bowl/${params.id}`}>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
