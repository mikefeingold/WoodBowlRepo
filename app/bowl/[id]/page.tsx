"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Edit, Trash2, Calendar, MapPin, QrCode, Download, Share2, ImageIcon } from "lucide-react"
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
import { supabase, mapDatabaseBowlToFrontend, isSupabaseConfigured } from "@/lib/supabase"
import { getBowlImagePaths, deleteImageSet } from "@/lib/storage"
import { SupabaseSetup } from "@/components/supabase-setup"
import { useToast } from "@/hooks/use-toast"
import { getDemoBowl } from "@/lib/demo-data"
import ImageViewer from "@/components/image-viewer"

interface BowlImage {
  id: string
  thumbnail: string
  medium: string
  full: string
  original: string
  dimensions?: { width: number; height: number }
  fileSize?: number
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

  const [supabaseConfigured, setSupabaseConfigured] = useState(true)

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
                        className="w-full h-96 object-cover rounded-lg"
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

                {/* Thumbnail Grid */}
                {bowl.images.length > 1 && (
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {bowl.images.map((image, index) => (
                      <button
                        key={image.id}
                        onClick={() => setSelectedImageIndex(index)}
                        onDoubleClick={() => openImageViewer(index)}
                        className={`relative rounded-lg overflow-hidden aspect-square group ${
                          selectedImageIndex === index ? "ring-2 ring-amber-500" : "hover:ring-2 hover:ring-amber-300"
                        }`}
                      >
                        <Image
                          src={image.thumbnail || "/placeholder.svg?height=75&width=100"}
                          alt={`Thumbnail ${index + 1}`}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      </button>
                    ))}
                  </div>
                )}
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
      </div>
    </div>
  )
}
