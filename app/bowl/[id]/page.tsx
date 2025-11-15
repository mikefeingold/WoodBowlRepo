"use client"

/**
 * Bowl Details Page - READ-ONLY VIEW
 *
 * This page displays bowl information in a read-only format.
 * All editing functionality has been moved to the edit page.
 *
 * Features:
 * - Display bowl images in a gallery format
 * - Show bowl metadata (wood type, source, date, finishes, comments)
 * - Image viewer for full-screen viewing
 * - QR code generation and sharing
 * - Navigation to edit page for modifications (only for bowl owners)
 */

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from 'next/navigation'
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Edit, Trash2, Calendar, MapPin, QrCode, Download, ImageIcon, Star, User } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { supabase, mapDatabaseBowlToFrontend, isSupabaseConfigured } from "@/lib/supabase"
import { SupabaseSetup } from "@/components/supabase-setup"
import { useToast } from "@/hooks/use-toast"
import ImageViewer from "@/components/image-viewer"
import { useAuth } from "@/components/auth/auth-provider"

// Type definitions for bowl data structure
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
  userId?: string | null
  createdBy?: string
}

export default function BowlDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()

  // Core state for bowl data and UI
  const [bowl, setBowl] = useState<Bowl | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [supabaseConfigured, setSupabaseConfigured] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Check if current user can edit this bowl
  const canEdit = user && bowl && bowl.userId === user.id

  // Check Supabase configuration on component mount
  useEffect(() => {
    setSupabaseConfigured(isSupabaseConfigured())
  }, [])

  // Fetch bowl data from database
  useEffect(() => {
    async function fetchBowl() {
      try {
        if (!supabase) {
          throw new Error("Supabase client not initialized")
        }

        // Fetch the bowl from Supabase database
        const { data, error } = await supabase.from("bowls").select("*").eq("id", params.id).single()

        if (error) {
          console.error("Error fetching bowl:", error)
          setLoading(false)
          return
        }

        // Transform database bowl to frontend format
        const mappedBowl = await mapDatabaseBowlToFrontend(data, 'oldest-first')
        setBowl(mappedBowl)
      } catch (error) {
        console.error("Error in fetchBowl:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBowl()

    // Generate QR code URL for sharing
    const currentUrl = typeof window !== "undefined" ? window.location.href : ""
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`)
  }, [params.id])

  /**
   * Handle bowl deletion
   * Removes bowl and all associated images from database and storage
   */
  const handleDelete = useCallback(async () => {
    if (!bowl) {
      console.error("Cannot delete: bowl is null")
      return
    }

    if (!supabase) {
      console.error("Cannot delete: Supabase client not initialized")
      toast({
        title: "Error",
        description: "Database connection not available. Please try again later.",
        variant: "destructive",
      })
      return
    }

    if (!canEdit) {
      toast({
        title: "Error",
        description: "You don't have permission to delete this bowl.",
        variant: "destructive",
      })
      return
    }

    setDeleting(true)

    try {
      console.log("Starting deletion process for bowl:", bowl.id)

      // Delete bowl record first (cascade will delete finishes and image records)
      const { error: deleteError } = await supabase.from("bowls").delete().eq("id", bowl.id)

      if (deleteError) {
        console.error("Error deleting bowl from database:", deleteError)
        throw new Error(`Database error: ${deleteError.message}`)
      }

      console.log("Bowl deleted successfully from database")

      // Show success message
      toast({
        title: "Bowl Deleted",
        description: "The bowl has been successfully removed from your collection.",
      })

      // Navigate back to home page
      setTimeout(() => {
        router.push("/")
      }, 500)
    } catch (error) {
      console.error("Error in handleDelete:", error)
      setDeleting(false)
      toast({
        title: "Error",
        description: "There was a problem deleting the bowl. Please try again.",
        variant: "destructive",
      })
    }
  }, [bowl, router, toast, canEdit])

  /**
   * Download QR code as PNG file
   */
  const downloadQRCode = () => {
    const link = document.createElement("a")
    link.href = qrCodeUrl
    link.download = `bowl-${bowl?.woodType}-qr.png`
    link.click()
  }

  /**
   * Open image viewer at specific index
   */
  const openImageViewer = (index: number) => {
    setSelectedImageIndex(index)
    setImageViewerOpen(true)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-lg">Loading bowl details...</div>
      </div>
    )
  }

  // Supabase not configured state
  if (!supabaseConfigured) {
    return <SupabaseSetup />
  }

  // Bowl not found state
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
        {/* Header with navigation and actions */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center text-amber-700 hover:text-amber-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Collection
          </Link>
          <div className="flex gap-2">
            {/* QR Code button - kept intact */}
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
          {/* Left column - Images */}
          <div className="lg:col-span-2">
            {bowl.images.length > 0 ? (
              <div className="space-y-4">
                {/* Main Image Display */}
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

                {/* Read-only Thumbnail Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-amber-800">Image Gallery</h3>
                    {canEdit && (
                      <Link href={`/bowl/${bowl.id}/edit`}>
                        <Button size="sm" variant="outline" className="text-xs">
                          <Edit className="w-3 h-3 mr-1" />
                          Edit Images
                        </Button>
                      </Link>
                    )}
                  </div>

                  {bowl.images.length > 0 ? (
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                      {bowl.images.map((image, index) => (
                        <button
                          key={image.id}
                          onClick={() => setSelectedImageIndex(index)}
                          onDoubleClick={() => openImageViewer(index)}
                          className={`relative rounded-lg overflow-hidden aspect-square group block w-full ${
                            selectedImageIndex === index ? "ring-2 ring-amber-500" : "hover:ring-2 hover:ring-amber-300"
                          }`}
                        >
                          <Image
                            src={image.thumbnail || "/placeholder.svg?height=75&width=100"}
                            alt={`Thumbnail ${index + 1}`}
                            fill
                            className="object-contain transition-transform group-hover:scale-105"
                          />
                          {/* Primary image indicator */}
                          {index === 0 && (
                            <div className="absolute top-1 left-1 bg-amber-500 rounded-full p-1">
                              <Star className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-white/50 rounded-lg">
                      <p className="text-amber-700">No images available</p>
                    </div>
                  )}

                  <div className="text-xs text-amber-600 mt-2 italic">
                    Click thumbnails to view different images. Double-click for full-screen view.
                  </div>
                </div>
              </div>
            ) : (
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8 text-center">
                  <div className="w-32 h-32 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">🏺</span>
                  </div>
                  <p className="text-amber-700 mb-4">No images uploaded for this bowl</p>
                  {canEdit && (
                    <Link href={`/bowl/${bowl.id}/edit`}>
                      <Button className="bg-amber-600 hover:bg-amber-700">
                        <Edit className="w-4 h-4 mr-2" />
                        Add Images
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - Bowl Information */}
          <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-2xl text-amber-900">{bowl.woodType}</CardTitle>
                {canEdit && (
                  <div className="flex gap-2">
                    <Link href={`/bowl/${bowl.id}/edit`}>
                      <Button size="sm" variant="outline">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Made by */}
                {bowl.createdBy && (
                  <div className="flex items-center text-amber-700">
                    <User className="w-4 h-4 mr-2" />
                    <span className="font-medium">Made by:</span>
                    <span className="ml-2">{bowl.createdBy}</span>
                  </div>
                )}

                {/* Date Made */}
                <div className="flex items-center text-amber-700">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span className="font-medium">Made:</span>
                  <span className="ml-2">{new Date(bowl.dateMade).toLocaleDateString()}</span>
                </div>

                {/* Wood Source */}
                <div className="flex items-center text-amber-700">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span className="font-medium">Source:</span>
                  <span className="ml-2">{bowl.woodSource}</span>
                </div>

                {/* Finishes */}
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

                {/* Comments */}
                {bowl.comments && (
                  <div>
                    <span className="font-medium text-amber-800 block mb-2">Comments:</span>
                    <p className="text-amber-700 leading-relaxed">{bowl.comments}</p>
                  </div>
                )}

                {/* Creation timestamp */}
                <div className="pt-4 border-t text-xs text-amber-600">
                  Created: {new Date(bowl.createdAt).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full-screen Image Viewer */}
        <ImageViewer
          images={bowl.images}
          initialIndex={selectedImageIndex}
          isOpen={imageViewerOpen}
          onClose={() => setImageViewerOpen(false)}
        />

        {/* Custom Delete Dialog - only shown if user can edit */}
        {canEdit && (
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete Bowl</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-gray-700">
                  Are you sure you want to delete this bowl? This action cannot be undone and will remove all associated
                  images and data.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleDelete()
                    setDeleteDialogOpen(false)
                  }}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete Bowl"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
