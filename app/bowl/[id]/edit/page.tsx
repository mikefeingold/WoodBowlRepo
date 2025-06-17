"use client"

/**
 * Bowl Edit Page - EDITING INTERFACE
 *
 * This page provides full editing capabilities for bowl data and images.
 * All image management functionality has been moved here from the details page.
 *
 * Features:
 * - Edit bowl metadata (wood type, source, date, finishes, comments)
 * - Upload new images with drag-and-drop support
 * - Reorder images using drag-and-drop
 * - Delete individual images
 * - Image preview with editing controls
 * - Form validation and error handling
 */

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Upload, X, AlertTriangle, Info, GripVertical, Star, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { supabase, mapDatabaseBowlToFrontend, isSupabaseConfigured } from "@/lib/supabase"
import { uploadImage, deleteImage } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"
import { SupabaseSetup } from "@/components/supabase-setup"

// Drag and drop imports for image reordering
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// Type definitions
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

interface SortableImageProps {
  image: ImageData
  index: number
  isSelected: boolean
  onSelect: () => void
  onDeleteClick: () => void
  isDeletable: boolean
}

/**
 * Sortable Image Component
 * Handles drag-and-drop functionality for individual images
 */
function SortableImage({ image, index, isSelected, onSelect, onDeleteClick, isDeletable }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `image-${index}`, // Use index as ID since we don't have stable IDs for new images
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <button
        onClick={onSelect}
        className={`relative rounded-lg overflow-hidden aspect-square group block w-full ${
          isSelected ? "ring-2 ring-amber-500" : "hover:ring-2 hover:ring-amber-300"
        } ${isDragging ? "ring-2 ring-amber-400 shadow-lg" : ""}`}
      >
        <Image
          src={image.url || "/placeholder.svg?height=150&width=200"}
          alt={`Bowl image ${index + 1}`}
          fill
          className="object-cover transition-transform group-hover:scale-105"
        />
        {/* Primary image indicator */}
        {index === 0 && (
          <div className="absolute top-1 left-1 bg-amber-500 rounded-full p-1">
            <Star className="h-3 w-3 text-white" />
          </div>
        )}
        {/* New image indicator */}
        {image.isNew && <Badge className="absolute bottom-1 left-1 text-xs bg-blue-500">New</Badge>}
      </button>

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 right-1 bg-white/70 hover:bg-white/90 rounded-full p-1 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3 text-amber-700" />
      </div>

      {/* Delete button */}
      {isDeletable && (
        <button
          type="button"
          className="absolute bottom-1 right-1 bg-white/70 hover:bg-red-100 rounded-full p-1 transition-colors z-10"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteClick()
          }}
          aria-label="Delete image"
        >
          <X className="h-3 w-3 text-red-600" />
        </button>
      )}
    </div>
  )
}

export default function EditBowlPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  // Form data state
  const [formData, setFormData] = useState({
    woodType: "",
    woodSource: "",
    dateMade: "",
    comments: "",
  })
  const [finishes, setFinishes] = useState<string[]>([])
  const [newFinish, setNewFinish] = useState("")
  const [images, setImages] = useState<ImageData[]>([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [bowl, setBowl] = useState<Bowl | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [supabaseConfigured, setSupabaseConfigured] = useState(false)

  // Image editing state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderChanged, setOrderChanged] = useState(false)
  const [deletingImage, setDeletingImage] = useState(false)
  const [imageToDeleteIndex, setImageToDeleteIndex] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Set up drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Check Supabase configuration
  useEffect(() => {
    setSupabaseConfigured(isSupabaseConfigured())
  }, [])

  // Fetch existing bowl data
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

        // Get image data with IDs and paths for editing
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

  /**
   * Handle form input changes
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  /**
   * Add a new finish to the list
   */
  const addFinish = () => {
    if (newFinish.trim() && !finishes.includes(newFinish.trim())) {
      setFinishes([...finishes, newFinish.trim()])
      setNewFinish("")
    }
  }

  /**
   * Remove a finish from the list
   */
  const removeFinish = (finish: string) => {
    setFinishes(finishes.filter((f) => f !== finish))
  }

  /**
   * Handle new image uploads
   */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setUploadError(null)
      Array.from(files).forEach((file) => {
        // Validate file size (limit to 10MB)
        if (file.size > 10 * 1024 * 1024) {
          setUploadError("Image files must be smaller than 10MB")
          return
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
          setUploadError("Only image files are allowed")
          return
        }

        // Convert file to base64 for preview
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
            setOrderChanged(true) // Mark order as changed when adding images
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  /**
   * Remove an image from the list
   */
  const removeImage = async (index: number) => {
    const imageToRemove = images[index]

    // If it's an existing image, it will be deleted from storage when saving
    if (!imageToRemove.isNew && imageToRemove.id && imageToRemove.path) {
      try {
        setImages(images.filter((_, i) => i !== index))
        setOrderChanged(true)
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
      setOrderChanged(true)
    }

    // Adjust selected image index if needed
    if (selectedImageIndex >= images.length - 1) {
      setSelectedImageIndex(Math.max(0, images.length - 2))
    }
  }

  /**
   * Handle drag end event for image reordering
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    // Extract indices from the drag IDs
    const oldIndex = Number.parseInt(active.id.toString().replace("image-", ""))
    const newIndex = Number.parseInt(over.id.toString().replace("image-", ""))

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      // Reorder the images array
      const newImages = arrayMove(images, oldIndex, newIndex)
      setImages(newImages)

      // Update selected image index if needed
      if (selectedImageIndex === oldIndex) {
        setSelectedImageIndex(newIndex)
      } else if (selectedImageIndex === newIndex) {
        setSelectedImageIndex(oldIndex)
      }

      setOrderChanged(true)

      toast({
        title: "Image Reordered",
        description: "Don't forget to save your changes!",
      })
    }
  }

  /**
   * Move image using arrow buttons (alternative to drag-and-drop)
   */
  const moveImage = (currentIndex: number, direction: "left" | "right") => {
    if (images.length <= 1) return

    const newIndex =
      direction === "left" ? Math.max(0, currentIndex - 1) : Math.min(images.length - 1, currentIndex + 1)

    if (newIndex === currentIndex) return

    // Create a new array with the reordered images
    const newImages = [...images]
    const [movedImage] = newImages.splice(currentIndex, 1)
    newImages.splice(newIndex, 0, movedImage)

    setImages(newImages)

    // Update selected image index
    if (selectedImageIndex === currentIndex) {
      setSelectedImageIndex(newIndex)
    }

    setOrderChanged(true)
  }

  /**
   * Open delete confirmation dialog
   */
  const openDeleteDialog = (index: number) => {
    setImageToDeleteIndex(index)
    setDeleteDialogOpen(true)
  }

  /**
   * Handle image deletion with confirmation
   */
  const handleDeleteImage = async () => {
    if (imageToDeleteIndex === null) {
      setDeleteDialogOpen(false)
      return
    }

    setDeletingImage(true)

    try {
      await removeImage(imageToDeleteIndex)

      toast({
        title: "Image Removed",
        description: "The image will be deleted when you save the form.",
      })
    } catch (error) {
      console.error("Error deleting image:", error)
      toast({
        title: "Error",
        description: "There was a problem removing the image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingImage(false)
      setDeleteDialogOpen(false)
      setImageToDeleteIndex(null)
    }
  }

  /**
   * Handle form submission
   */
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

      // Upload new images with error handling
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

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-lg">Loading bowl details...</div>
      </div>
    )
  }

  // Bowl not found state
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
        {/* Header */}
        <div className="mb-6">
          <Link href={`/bowl/${params.id}`} className="inline-flex items-center text-amber-700 hover:text-amber-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Bowl Details
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Image Management */}
          <div className="lg:col-span-2">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl text-amber-900">Image Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Image Upload */}
                <div>
                  <Label htmlFor="images">Upload Images</Label>
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
                </div>

                {/* Image Grid with Drag and Drop */}
                {images.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <h3 className="text-sm font-medium text-amber-800">Image Gallery</h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1">
                                <Info className="h-4 w-4 text-amber-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                The first image (marked with a star) will be shown on the bowl cards on the home page.
                                Drag and drop to reorder images or use the arrow buttons.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {orderChanged && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Changes will be saved when you submit the form
                        </Badge>
                      )}
                    </div>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext
                        items={images.map((_, index) => `image-${index}`)}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {images.map((image, index) => (
                            <div key={`image-${index}`} className="relative group">
                              <SortableImage
                                image={image}
                                index={index}
                                isSelected={selectedImageIndex === index}
                                onSelect={() => setSelectedImageIndex(index)}
                                onDeleteClick={() => openDeleteDialog(index)}
                                isDeletable={images.length > 1}
                              />

                              {/* Arrow Controls */}
                              <div className="absolute -bottom-2 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-6 w-6 p-0 bg-white/80"
                                  onClick={() => moveImage(index, "left")}
                                  disabled={index === 0}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-6 w-6 p-0 bg-white/80"
                                  onClick={() => moveImage(index, "right")}
                                  disabled={index === images.length - 1}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>

                    <div className="text-xs text-amber-600 mt-2 italic">
                      Tip: Drag the grip handle to reorder images, or use the arrow buttons. Click the X to delete an
                      image.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column - Form */}
          <div>
            <Card className="bg-white/80 backdrop-blur-sm">
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
                        This might be due to storage permissions. Try running the SQL script to fix RLS policies, or
                        check your Supabase storage bucket settings.
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
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

        {/* Delete Image Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Image</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this image? This action cannot be undone.
                {imageToDeleteIndex === 0 && (
                  <p className="mt-2 text-amber-600 font-medium">
                    This is your primary image that appears on the home page.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteImage}
                className="bg-red-600 hover:bg-red-700"
                disabled={deletingImage}
              >
                {deletingImage ? "Removing..." : "Delete Image"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
