"use client"

/**
 * Add Bowl Page Component - REQUIRES AUTHENTICATION
 *
 * This page allows authenticated users to create new bowl records.
 * Bowls are automatically associated with the logged-in user.
 */

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, X, Bug, Camera, AlertCircle, CheckCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { SupabaseSetup } from "@/components/supabase-setup"
import EnhancedImageUpload, { type ProcessedImageData } from "@/components/enhanced-image-upload"
import { uploadImageSet } from "@/lib/storage"
import { processImage } from "@/lib/image-processing"
import { cameraManager } from "@/lib/pwa-utils"
import { useAuth } from "@/components/auth/auth-provider"

// Form data interface for type safety
interface FormData {
  woodType: string
  woodSource: string
  dateMade: string
  comments: string
}

// Storage keys for persisting form data
const FORM_DATA_KEY = "addBowlFormData"
const FINISHES_KEY = "addBowlFinishes"

export default function AddBowlPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()

  // Use ref to track initialization state
  const initializedRef = useRef(false)

  // Form state for bowl basic information - now with persistence
  const [formData, setFormData] = useState<FormData>({
    woodType: "",
    woodSource: "",
    dateMade: new Date().toISOString().split("T")[0], // Default to today's date
    comments: "",
  })

  // State for finishes (array of strings) - now with persistence
  const [finishes, setFinishes] = useState<string[]>([])
  const [newFinish, setNewFinish] = useState("") // Temporary state for adding new finish

  // State for images with processing metadata
  const [images, setImages] = useState<ProcessedImageData[]>([])

  // UI state
  const [loading, setLoading] = useState(false) // Form submission state
  const [debugInfo, setDebugInfo] = useState<string | null>(null) // Debug information
  const [showDebug, setShowDebug] = useState(false) // Toggle debug panel
  const [hasCamera, setHasCamera] = useState(false) // Camera availability

  // New state for handling saved data restoration
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const [savedDataToRestore, setSavedDataToRestore] = useState<{
    formData: FormData | null
    finishes: string[]
  } | null>(null)

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add bowls to your collection.",
        variant: "destructive",
      })
      router.push("/")
    }
  }, [user, authLoading, router, toast])

  /**
   * Check if Supabase is configured and show setup screen if not
   */
  const checkSupabaseConfiguration = () => {
    if (!isSupabaseConfigured()) {
      return <SupabaseSetup />
    }
    return null
  }

  /**
   * Save form data to localStorage for persistence
   */
  const saveFormDataToStorage = (data: FormData, finishesData: string[]) => {
    try {
      localStorage.setItem(FORM_DATA_KEY, JSON.stringify(data))
      localStorage.setItem(FINISHES_KEY, JSON.stringify(finishesData))
    } catch (error) {
      console.warn("Failed to save form data to localStorage:", error)
    }
  }

  /**
   * Load form data from localStorage
   */
  const loadFormDataFromStorage = (): { formData: FormData | null; finishes: string[] } => {
    try {
      const savedFormData = localStorage.getItem(FORM_DATA_KEY)
      const savedFinishes = localStorage.getItem(FINISHES_KEY)

      return {
        formData: savedFormData ? JSON.parse(savedFormData) : null,
        finishes: savedFinishes ? JSON.parse(savedFinishes) : [],
      }
    } catch (error) {
      console.warn("Failed to load form data from localStorage:", error)
      return { formData: null, finishes: [] }
    }
  }

  /**
   * Clear form data from localStorage
   */
  const clearFormDataFromStorage = () => {
    try {
      localStorage.removeItem(FORM_DATA_KEY)
      localStorage.removeItem(FINISHES_KEY)
    } catch (error) {
      console.warn("Failed to clear form data from localStorage:", error)
    }
  }

  /**
   * Check if form has any meaningful data
   */
  const hasFormData = (data: FormData, finishesData: string[]) => {
    return Boolean(
      data && (data.woodType.trim() || data.woodSource.trim() || data.comments.trim() || finishesData.length > 0),
    )
  }

  /**
   * Restore saved form data
   */
  const restoreSavedData = () => {
    if (savedDataToRestore?.formData) {
      setFormData(savedDataToRestore.formData)
      setFinishes(savedDataToRestore.finishes)
      setShowRestorePrompt(false)
      setSavedDataToRestore(null)

      toast({
        title: "Form Data Restored",
        description: "Your previously entered information has been restored.",
      })
    }
  }

  /**
   * Dismiss the restore prompt and clear saved data
   */
  const dismissRestorePrompt = () => {
    setShowRestorePrompt(false)
    setSavedDataToRestore(null)
    clearFormDataFromStorage()
  }

  // Effect to initialize component state and handle camera return
  // This runs only once on component mount
  useEffect(() => {
    // Check if device has camera capability
    cameraManager.hasCamera().then(setHasCamera)

    // Only run initialization logic once
    if (!initializedRef.current) {
      initializedRef.current = true

      // Check if returning from camera
      const fromCamera = searchParams.get("from") === "camera"

      // Load any previously saved form data
      const savedData = loadFormDataFromStorage()

      if (fromCamera) {
        // If returning from camera, restore form data and load images
        if (savedData.formData) {
          setFormData(savedData.formData)
          setFinishes(savedData.finishes)
        }
        loadCapturedImages()
      } else if (savedData.formData && hasFormData(savedData.formData, savedData.finishes)) {
        // If there's meaningful saved data but not from camera, show restore prompt
        setSavedDataToRestore(savedData)
        setShowRestorePrompt(true)
      }
    }
  }, [searchParams]) // Only depend on searchParams

  /**
   * Load images captured from the camera page
   * Images are stored in sessionStorage as base64 strings
   */
  const loadCapturedImages = async () => {
    try {
      const capturedImagesJson = sessionStorage.getItem("capturedImages")
      if (capturedImagesJson) {
        const capturedImages: string[] = JSON.parse(capturedImagesJson)
        const processedImages: ProcessedImageData[] = []

        // Process each captured image
        for (let i = 0; i < capturedImages.length; i++) {
          const base64 = capturedImages[i]

          // Convert base64 to File object for processing
          const response = await fetch(base64)
          const blob = await response.blob()
          const file = new File([blob], `camera-${i + 1}.jpg`, { type: "image/jpeg" })

          // Process the image (resize and compress to multiple sizes)
          const processed = await processImage(file)

          processedImages.push({
            id: `camera-${Date.now()}-${i}`,
            file,
            processed,
            dimensions: { width: 1920, height: 1080 }, // Estimate for camera images
            fileSize: blob.size,
            isNew: true,
          })
        }

        setImages(processedImages)

        // Clear from session storage to prevent reloading
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

  /**
   * Handle form input changes with automatic persistence
   * Updates the formData state with new values and saves to localStorage
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const updatedFormData = {
      ...formData,
      [e.target.name]: e.target.value,
    }
    setFormData(updatedFormData)

    // Auto-save form data to localStorage
    saveFormDataToStorage(updatedFormData, finishes)
  }

  /**
   * Add a new finish to the finishes array with persistence
   * Prevents duplicates and trims whitespace
   */
  const addFinish = () => {
    if (newFinish.trim() && !finishes.includes(newFinish.trim())) {
      const updatedFinishes = [...finishes, newFinish.trim()]
      setFinishes(updatedFinishes)
      setNewFinish("")

      // Auto-save finishes to localStorage
      saveFormDataToStorage(formData, updatedFinishes)
    }
  }

  /**
   * Remove a finish from the finishes array with persistence
   */
  const removeFinish = (finish: string) => {
    const updatedFinishes = finishes.filter((f) => f !== finish)
    setFinishes(updatedFinishes)

    // Auto-save finishes to localStorage
    saveFormDataToStorage(formData, updatedFinishes)
  }

  /**
   * Handle camera button click - save current form state before navigating
   */
  const handleCameraClick = () => {
    // Save current form data before going to camera
    saveFormDataToStorage(formData, finishes)

    // Navigate to camera page
    router.push("/camera")
  }

  /**
   * Handle form submission
   *
   * Process:
   * 1. Validate form data
   * 2. Insert bowl record into database with user_id
   * 3. Insert finishes into bowl_finishes table
   * 4. Upload images to storage and insert records
   * 5. Clear saved form data and navigate to bowl detail page on success
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Error",
        description: "You must be signed in to add a bowl.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setDebugInfo(null)

    try {
      if (!supabase) {
        throw new Error("Supabase client not initialized")
      }

      // Log the data we're about to insert for debugging
      console.log("Inserting bowl with data:", {
        wood_type: formData.woodType,
        wood_source: formData.woodSource,
        date_made: formData.dateMade,
        comments: formData.comments || null,
        user_id: user.id,
      })

      // Step 1: Insert the main bowl record with user_id
      const { data: bowlData, error: bowlError } = await supabase
        .from("bowls")
        .insert({
          wood_type: formData.woodType,
          wood_source: formData.woodSource,
          date_made: formData.dateMade,
          comments: formData.comments || null,
          user_id: user.id,
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

      // Step 2: Insert finishes if any were specified
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

      // Step 3: Upload images and create image records
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          console.log(`Uploading image ${i + 1} of ${images.length}`)

          // Upload image set (thumbnail, medium, full, original) to storage
          const uploadResult = await uploadImageSet(images[i].processed, bowlId)

          if (uploadResult) {
            console.log("Image set uploaded:", uploadResult)

            // Insert image record with all size variants
            const { error: imageError } = await supabase.from("bowl_images").insert({
              bowl_id: bowlId,
              // Legacy fields for backward compatibility
              image_url: uploadResult.medium.url,
              storage_path: uploadResult.medium.path,
              // New multi-size fields
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
              display_order: i, // First image (index 0) becomes primary
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

      // Success! Clear saved form data and show toast
      clearFormDataFromStorage()

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

  /**
   * Handle cancel action - clear saved data and navigate back
   */
  const handleCancel = () => {
    const hasUnsavedData =
      formData.woodType || formData.woodSource || formData.comments || finishes.length > 0 || images.length > 0

    if (hasUnsavedData) {
      const shouldDiscard = window.confirm("You have unsaved changes. Are you sure you want to discard them?")
      if (!shouldDiscard) {
        return
      }
    }

    clearFormDataFromStorage()
    router.push("/")
  }

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // Don't render if user is not authenticated
  if (!user) {
    return null
  }

  // Show Supabase setup screen if not configured
  const supabaseSetupComponent = checkSupabaseConfiguration()

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        {supabaseSetupComponent}

        {/* Restore Data Prompt - Custom UI instead of browser dialog */}
        {showRestorePrompt && (
          <Alert className="mb-6 max-w-2xl mx-auto border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-amber-800">
                You have unsaved form data from a previous session. Would you like to restore it?
              </span>
              <div className="flex gap-2 ml-4">
                <Button size="sm" onClick={restoreSavedData} className="bg-amber-600 hover:bg-amber-700">
                  Restore
                </Button>
                <Button size="sm" variant="outline" onClick={dismissRestorePrompt}>
                  Discard
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Header with navigation and action buttons */}
        <div className="mb-6 flex justify-between items-center">
          <Link href="/" className="inline-flex items-center text-amber-700 hover:text-amber-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Collection
          </Link>
          <div className="flex gap-2">
            {/* Debug tools link */}
            <Link href="/debug">
              <Button variant="outline" size="sm">
                <Bug className="w-4 h-4 mr-2" />
                Debug Tools
              </Button>
            </Link>
          </div>
        </div>

        {/* Main form card */}
        <Card className="max-w-2xl mx-auto bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-amber-900">Add New Bowl</CardTitle>
            {/* Show indicator if form data is being auto-saved */}
            {(formData.woodType || formData.woodSource || finishes.length > 0) && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>Form data is automatically saved as you type</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic bowl information - wood type and source */}
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

              {/* Date made */}
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

              {/* Finishes section - dynamic array of finish names */}
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
                {/* Display current finishes as removable badges */}
                <div className="flex flex-wrap gap-2">
                  {finishes.map((finish, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {finish}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => removeFinish(finish)} />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Comments section */}
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

              {/* Image upload section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Images</Label>
                  {/* Camera button - preserves form data */}
                  {hasCamera && (
                    <Button type="button" variant="outline" size="sm" onClick={handleCameraClick}>
                      <Camera className="w-4 h-4 mr-2" />
                      Use Camera
                    </Button>
                  )}
                </div>
                {/* Enhanced image upload component with processing */}
                <EnhancedImageUpload images={images} onImagesChange={setImages} maxImages={10} disabled={loading} />
                {images.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      {images.length} image{images.length !== 1 ? "s" : ""} ready to upload
                    </span>
                  </div>
                )}
              </div>

              {/* Form action buttons */}
              <div className="flex gap-4">
                <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700">
                  {loading ? "Saving..." : "Save Bowl"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                {/* Debug toggle button */}
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

          {/* Debug information panel - only shown when toggled on */}
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
