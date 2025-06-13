"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  QrCode,
  Download,
  Share2,
  ImageIcon,
  Star,
  ChevronLeft,
  ChevronRight,
  Info,
  GripVertical,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { supabase, mapDatabaseBowlToFrontend, isSupabaseConfigured } from "@/lib/supabase"
import { getBowlImagePaths, deleteImageSet } from "@/lib/storage"
import { SupabaseSetup } from "@/components/supabase-setup"
import { useToast } from "@/hooks/use-toast"
import { getDemoBowl } from "@/lib/demo-data"
import ImageViewer from "@/components/image-viewer"
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

interface BowlImage {
  id: string
  thumbnail: string
  medium: string
  full: string
  original: string
  dimensions?: { width: number; height: number }
  fileSize?: number
  thumbnail_path?: string
  medium_path?: string
  full_path?: string
  original_path?: string
  storage_path?: string
}

interface Bowl {
  id: string
  woodType: string
  woodSource: string
  dateMade: string
  finishes: string[]
  comments: string
  images: BowlImage[]
  createdAt: string
}

interface SortableImageProps {
  image: BowlImage
  index: number
  isSelected: boolean
  onSelect: () => void
  onDoubleClick: () => void
  onDeleteClick: () => void
  isDeletable: boolean
}

function SortableImage({
  image,
  index,
  isSelected,
  onSelect,
  onDoubleClick,
  onDeleteClick,
  isDeletable,
}: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
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
        onDoubleClick={onDoubleClick}
        className={`relative rounded-lg overflow-hidden aspect-square group block w-full ${
          isSelected ? "ring-2 ring-amber-500" : "hover:ring-2 hover:ring-amber-300"
        } ${isDragging ? "ring-2 ring-amber-400 shadow-lg" : ""}`}
      >
        <Image
          src={image.thumbnail || "/placeholder.svg?height=75&width=100"}
          alt={`Thumbnail ${index + 1}`}
          fill
          className="object-contain transition-transform group-hover:scale-105"
        />
        {index === 0 && (
          <div className="absolute top-1 left-1 bg-amber-500 rounded-full p-1">
            <Star className="h-3 w-3 text-white" />
          </div>
        )}
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

export default function BowlDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [bowl, setBowl] = useState<Bowl | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderChanged, setOrderChanged] = useState(false)
  const [deletingImage, setDeletingImage] = useState(false)
  const [imageToDeleteIndex, setImageToDeleteIndex] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [supabaseConfigured, setSupabaseConfigured] = useState(true)

  // Set up DnD sensors
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

  useEffect(() => {
    setSupabaseConfigured(isSupabaseConfigured())
  }, [])

  useEffect(() => {
    async function fetchBowl() {
      try {
        if (!supabase) {
          throw new Error("Supabase client not initialized")
        }

        // Fetch the bowl from Supabase
        const { data, error } = await supabase.from("bowls").select("*").eq("id", params.id).single()

        if (error) {
          console.error("Error fetching bowl:", error)

          // Check if this is a demo bowl
          const demoBowl = getDemoBowl(params.id as string)
          if (demoBowl) {
            // Convert demo bowl to new format
            setBowl({
              ...demoBowl,
              images: demoBowl.images.map((url, index) => ({
                id: `demo-${index}`,
                thumbnail: url,
                medium: url,
                full: url,
                original: url,
              })),
            })
          }

          setLoading(false)
          return
        }

        // Map database bowl to frontend format
        const mappedBowl = await mapDatabaseBowlToFrontend(data)
        setBowl(mappedBowl)
      } catch (error) {
        console.error("Error in fetchBowl:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBowl()

    // Generate QR code URL
    const currentUrl = typeof window !== "undefined" ? window.location.href : ""
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`)
  }, [params.id])

  const handleDelete = async () => {
    if (!bowl) return

    setDeleting(true)

    try {
      // 1. Delete images from storage
      const imagePaths = await getBowlImagePaths(bowl.id)
      if (imagePaths.length > 0) {
        await deleteImageSet(imagePaths)
      }

      // 2. Delete bowl record (cascade will delete finishes and image records)
      const { error } = await supabase.from("bowls").delete().eq("id", bowl.id)

      if (error) {
        throw new Error(error.message)
      }

      toast({
        title: "Bowl Deleted",
        description: "The bowl has been successfully removed from your collection.",
      })

      router.push("/")
    } catch (error) {
      console.error("Error deleting bowl:", error)
      toast({
        title: "Error",
        description: "There was a problem deleting the bowl. Please try again.",
        variant: "destructive",
      })
      setDeleting(false)
    }
  }

  const downloadQRCode = () => {
    const link = document.createElement("a")
    link.href = qrCodeUrl
    link.download = `bowl-${bowl?.woodType}-qr.png`
    link.click()
  }

  const shareUrl = () => {
    if (navigator.share) {
      navigator.share({
        title: `${bowl?.woodType} Bowl`,
        text: `Check out this ${bowl?.woodType} bowl I made!`,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast({
        title: "URL Copied",
        description: "Link copied to clipboard!",
      })
    }
  }

  const openImageViewer = (index: number) => {
    setSelectedImageIndex(index)
    setImageViewerOpen(true)
  }

  const moveImage = async (currentIndex: number, direction: "left" | "right") => {
    if (!bowl || !bowl.images || bowl.images.length <= 1) return

    const newIndex =
      direction === "left" ? Math.max(0, currentIndex - 1) : Math.min(bowl.images.length - 1, currentIndex + 1)

    if (newIndex === currentIndex) return

    // Create a new array with the reordered images
    const newImages = [...bowl.images]
    const [movedImage] = newImages.splice(currentIndex, 1)
    newImages.splice(newIndex, 0, movedImage)

    // Update the state
    setBowl({
      ...bowl,
      images: newImages,
    })

    // If the selected image was moved, update the selected index
    if (selectedImageIndex === currentIndex) {
      setSelectedImageIndex(newIndex)
    }

    setOrderChanged(true)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!bowl || !over || active.id === over.id) {
      return
    }

    // Find the indices of the dragged and target items
    const oldIndex = bowl.images.findIndex((img) => img.id === active.id)
    const newIndex = bowl.images.findIndex((img) => img.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      // Create a new array with the reordered images
      const newImages = arrayMove(bowl.images, oldIndex, newIndex)

      // Update the state
      setBowl({
        ...bowl,
        images: newImages,
      })

      // If the selected image was moved, update the selected index
      if (selectedImageIndex === oldIndex) {
        setSelectedImageIndex(newIndex)
      } else if (selectedImageIndex === newIndex) {
        // If the selected image was the target, adjust its index
        setSelectedImageIndex(oldIndex)
      }

      setOrderChanged(true)

      // Show a toast notification
      toast({
        title: "Image Reordered",
        description: "Don't forget to save your changes!",
      })
    }
  }

  const saveImageOrder = async () => {
    if (!bowl || !supabase) return

    setSavingOrder(true)

    try {
      // Get the image IDs in the new order
      const imageIds = bowl.images.map((img) => img.id)

      // Update each image's display_order in the database
      for (let i = 0; i < imageIds.length; i++) {
        const imageId = imageIds[i]

        // Skip demo images (they have IDs like "demo-0")
        if (imageId.startsWith("demo-")) continue

        const { error } = await supabase.from("bowl_images").update({ display_order: i }).eq("id", imageId)

        if (error) {
          console.error(`Error updating image order for ${imageId}:`, error)
          throw new Error(`Failed to update image order: ${error.message}`)
        }
      }

      toast({
        title: "Order Saved",
        description: "The image order has been updated successfully.",
      })

      setOrderChanged(false)
    } catch (error) {
      console.error("Error saving image order:", error)
      toast({
        title: "Error",
        description: "There was a problem saving the image order. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingOrder(false)
    }
  }

  const openDeleteDialog = (index: number) => {
    setImageToDeleteIndex(index)
    setDeleteDialogOpen(true)
  }

  const handleDeleteImage = async () => {
    if (!bowl || !supabase || imageToDeleteIndex === null || !bowl.images[imageToDeleteIndex]) {
      setDeleteDialogOpen(false)
      return
    }

    setDeletingImage(true)

    try {
      const imageToDelete = bowl.images[imageToDeleteIndex]
      console.log("Deleting image:", imageToDelete)

      // Skip deletion for demo images
      if (!imageToDelete.id.startsWith("demo-")) {
        // 1. Delete image files from storage
        const pathsToDelete: string[] = []

        // Collect all paths for this image
        if (imageToDelete.thumbnail_path) pathsToDelete.push(imageToDelete.thumbnail_path)
        if (imageToDelete.medium_path) pathsToDelete.push(imageToDelete.medium_path)
        if (imageToDelete.full_path) pathsToDelete.push(imageToDelete.full_path)
        if (imageToDelete.original_path) pathsToDelete.push(imageToDelete.original_path)
        if (imageToDelete.storage_path) pathsToDelete.push(imageToDelete.storage_path)

        console.log("Paths to delete:", pathsToDelete)

        // Delete from storage if we have paths
        if (pathsToDelete.length > 0) {
          const deleteResult = await deleteImageSet(pathsToDelete)
          console.log("Storage deletion result:", deleteResult)
        }

        // 2. Delete image record from database
        const { error } = await supabase.from("bowl_images").delete().eq("id", imageToDelete.id)

        if (error) {
          console.error("Database deletion error:", error)
          throw new Error(`Failed to delete image record: ${error.message}`)
        }
      }

      // 3. Update local state
      const newImages = [...bowl.images]
      newImages.splice(imageToDeleteIndex, 1)

      // Update the bowl state
      setBowl({
        ...bowl,
        images: newImages,
      })

      // 4. Adjust selected image index if needed
      if (selectedImageIndex >= newImages.length) {
        setSelectedImageIndex(Math.max(0, newImages.length - 1))
      } else if (selectedImageIndex > imageToDeleteIndex) {
        setSelectedImageIndex(selectedImageIndex - 1)
      }

      // 5. Show success message
      toast({
        title: "Image Deleted",
        description: "The image has been removed from this bowl.",
      })

      // 6. If order changed, mark it for saving
      setOrderChanged(true)
    } catch (error) {
      console.error("Error deleting image:", error)
      toast({
        title: "Error",
        description: "There was a problem deleting the image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingImage(false)
      setDeleteDialogOpen(false)
      setImageToDeleteIndex(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-lg">Loading bowl details...</div>
      </div>
    )
  }

  if (!supabaseConfigured) {
    return <SupabaseSetup />
  }

  if (!bowl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amber-900 mb-4">Bowl Not Found</h2>
          <p className="text-amber-700 mb-6">The bowl you're looking for doesn't exist or couldn't be loaded.</p>
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
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center text-amber-700 hover:text-amber-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Collection
          </Link>
          <div className="flex gap-2">
            <Button onClick={shareUrl} variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <QrCode className="w-4 h-4 mr-2" />
                  QR Code
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>QR Code for this Bowl</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center space-y-4">
                  <Image
                    src={qrCodeUrl || "/placeholder.svg?height=200&width=200"}
                    alt="QR Code"
                    width={200}
                    height={200}
                    className="border rounded-lg"
                  />
                  <Button onClick={downloadQRCode} className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download QR Code
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {bowl.images.length > 0 ? (
              <div className="space-y-4">
                {/* Main Image */}
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="relative group cursor-pointer" onClick={() => openImageViewer(selectedImageIndex)}>
                      <Image
                        src={bowl.images[selectedImageIndex]?.medium || "/placeholder.svg?height=600&width=800"}
                        alt={`${bowl.woodType} bowl - Image ${selectedImageIndex + 1}`}
                        width={800}
                        height={600}
                        className="w-full h-96 object-contain bg-white/50 rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-white/90 rounded-full p-3">
                            <ImageIcon className="w-6 h-6 text-gray-700" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Thumbnail Grid with Drag and Drop */}
                <div className="space-y-3">
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
                      <Button
                        size="sm"
                        onClick={saveImageOrder}
                        disabled={savingOrder}
                        className="bg-amber-600 hover:bg-amber-700 text-xs"
                      >
                        {savingOrder ? "Saving..." : "Save Order"}
                      </Button>
                    )}
                  </div>

                  {bowl.images.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={bowl.images.map((img) => img.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                          {bowl.images.map((image, index) => (
                            <div key={image.id} className="relative group">
                              <SortableImage
                                image={image}
                                index={index}
                                isSelected={selectedImageIndex === index}
                                onSelect={() => setSelectedImageIndex(index)}
                                onDoubleClick={() => openImageViewer(index)}
                                onDeleteClick={() => openDeleteDialog(index)}
                                isDeletable={bowl.images.length > 1} // Only allow deletion if there's more than one image
                              />

                              {/* Arrow Controls (for accessibility and as alternative) */}
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
                                  disabled={index === bowl.images.length - 1}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="text-center p-4 bg-white/50 rounded-lg">
                      <p className="text-amber-700">No images available</p>
                    </div>
                  )}

                  <div className="text-xs text-amber-600 mt-2 italic">
                    Tip: Drag the grip handle to reorder images, or use the arrow buttons. Click the X to delete an
                    image.
                  </div>
                </div>
              </div>
            ) : (
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8 text-center">
                  <div className="w-32 h-32 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">🏺</span>
                  </div>
                  <p className="text-amber-700">No images uploaded for this bowl</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-2xl text-amber-900">{bowl.woodType}</CardTitle>
                <div className="flex gap-2">
                  <Link href={`/bowl/${bowl.id}/edit`}>
                    <Button size="sm" variant="outline">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Bowl</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this bowl? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-red-600 hover:bg-red-700"
                          disabled={deleting}
                        >
                          {deleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center text-amber-700">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span className="font-medium">Made:</span>
                  <span className="ml-2">{new Date(bowl.dateMade).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center text-amber-700">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span className="font-medium">Source:</span>
                  <span className="ml-2">{bowl.woodSource}</span>
                </div>

                {bowl.finishes.length > 0 && (
                  <div>
                    <span className="font-medium text-amber-800 block mb-2">Finishes Used:</span>
                    <div className="flex flex-wrap gap-2">
                      {bowl.finishes.map((finish, index) => (
                        <Badge key={index} variant="secondary">
                          {finish}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {bowl.comments && (
                  <div>
                    <span className="font-medium text-amber-800 block mb-2">Comments:</span>
                    <p className="text-amber-700 leading-relaxed">{bowl.comments}</p>
                  </div>
                )}

                <div className="pt-4 border-t text-xs text-amber-600">
                  Created: {new Date(bowl.createdAt).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Image Viewer */}
        <ImageViewer
          images={bowl.images}
          initialIndex={selectedImageIndex}
          isOpen={imageViewerOpen}
          onClose={() => setImageViewerOpen(false)}
        />

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
                {deletingImage ? "Deleting..." : "Delete Image"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
