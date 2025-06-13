"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Plus, Search, Calendar, TreesIcon as Wood, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase, mapDatabaseBowlToFrontend, isSupabaseConfigured } from "@/lib/supabase"
import { getDemoBowls } from "@/lib/demo-data"
import { SupabaseSetup } from "@/components/supabase-setup"

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

export default function HomePage() {
  const [bowls, setBowls] = useState<Bowl[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBowls() {
      try {
        if (!isSupabaseConfigured()) {
          // Use demo data when Supabase is not configured
          const demoBowls = getDemoBowls().map((bowl) => ({
            ...bowl,
            images: bowl.images.map((url, index) => ({
              id: `demo-${index}`,
              thumbnail: url,
              medium: url,
              full: url,
              original: url,
            })),
          }))
          // Sort demo bowls by date in descending order (newest first)
          demoBowls.sort((a, b) => new Date(b.dateMade).getTime() - new Date(a.dateMade).getTime())
          setBowls(demoBowls)
          setLoading(false)
          return
        }

        if (!supabase) {
          setLoading(false)
          return
        }

        console.log("Fetching bowls from Supabase...")

        // Fetch all bowls from Supabase, ordered by date_made in descending order (newest first)
        const { data, error } = await supabase.from("bowls").select("*").order("date_made", { ascending: false })

        if (error) {
          console.error("Error fetching bowls:", error)
          setError(`Failed to fetch bowls: ${error.message}`)
          return
        }

        console.log(`Found ${data.length} bowls in database`)

        if (data.length === 0) {
          setBowls([])
          setLoading(false)
          return
        }

        // Map database bowls to frontend format
        const mappedBowls = await Promise.all(data.map((bowl) => mapDatabaseBowlToFrontend(bowl)))
        console.log("Mapped bowls:", mappedBowls)

        setBowls(mappedBowls)
      } catch (error) {
        console.error("Error in fetchBowls:", error)
        setError(`Exception: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setLoading(false)
      }
    }

    fetchBowls()
  }, [])

  // Show setup screen if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return <SupabaseSetup />
  }

  const filteredBowls = bowls.filter(
    (bowl) =>
      bowl.woodType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bowl.woodSource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bowl.comments.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-lg">Loading your bowl collection...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div className="mb-4 md:mb-0">
            <h1 className="text-4xl font-bold text-amber-900 mb-2">Wood Bowl Tracker</h1>
            <p className="text-amber-700">Track your handcrafted wooden bowls</p>
          </div>
          <div className="flex gap-2">
            <Link href="/add">
              <Button className="bg-amber-600 hover:bg-amber-700">
                <Plus className="w-4 h-4 mr-2" />
                Add New Bowl
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 text-red-700 text-sm">
            <strong>Error loading bowls:</strong> {error}
            <div className="mt-2">
              <Link href="/debug">
                <Button size="sm" variant="outline" className="text-red-600 border-red-300">
                  <Bug className="w-3 h-3 mr-1" />
                  Debug Database
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search bowls by wood type, source, or comments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredBowls.length === 0 ? (
          <div className="text-center py-12">
            <Wood className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-amber-900 mb-2">
              {bowls.length === 0 ? "No bowls yet" : "No bowls match your search"}
            </h3>
            <p className="text-amber-700 mb-4">
              {bowls.length === 0 ? "Start tracking your wooden bowl creations!" : "Try adjusting your search terms"}
            </p>
            {bowls.length === 0 && (
              <Link href="/add">
                <Button className="bg-amber-600 hover:bg-amber-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Bowl
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBowls.map((bowl) => (
              <Link key={bowl.id} href={`/bowl/${bowl.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-white/80 backdrop-blur-sm group overflow-hidden">
                  <CardHeader className="pb-0 p-4">
                    <CardTitle className="text-lg text-amber-900">{bowl.woodType}</CardTitle>
                    <div className="flex items-center text-sm text-amber-700">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(bowl.dateMade).toLocaleDateString()}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {bowl.images.length > 0 ? (
                      <div className="relative w-full">
                        <div className="w-full aspect-[4/3] relative">
                          <Image
                            src={bowl.images[0]?.medium || "/placeholder.svg?height=300&width=400"}
                            alt={`${bowl.woodType} bowl`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover"
                            priority
                          />
                          {bowl.images.length > 1 && (
                            <Badge className="absolute top-2 right-2 bg-black/50 text-white text-xs">
                              +{bowl.images.length - 1}
                            </Badge>
                          )}
                        </div>
                        <div className="p-4 space-y-2">
                          <div className="text-sm">
                            <span className="font-medium text-amber-800">Source:</span>{" "}
                            <span className="text-amber-700">{bowl.woodSource}</span>
                          </div>
                          {bowl.finishes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {bowl.finishes.slice(0, 3).map((finish, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {finish}
                                </Badge>
                              ))}
                              {bowl.finishes.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{bowl.finishes.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                          {bowl.comments && <p className="text-sm text-amber-700 line-clamp-2">{bowl.comments}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 space-y-2">
                        <div className="text-sm">
                          <span className="font-medium text-amber-800">Source:</span>{" "}
                          <span className="text-amber-700">{bowl.woodSource}</span>
                        </div>
                        {bowl.finishes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {bowl.finishes.slice(0, 3).map((finish, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {finish}
                              </Badge>
                            ))}
                            {bowl.finishes.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{bowl.finishes.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                        {bowl.comments && <p className="text-sm text-amber-700 line-clamp-2">{bowl.comments}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
