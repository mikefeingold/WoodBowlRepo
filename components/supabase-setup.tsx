"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Database, ExternalLink, Settings } from "lucide-react"

export function SupabaseSetup() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl text-amber-900">Supabase Setup Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-amber-700 text-center">
            To use the Wood Bowl Tracker with cloud storage, you need to set up Supabase. Follow these steps:
          </p>

          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-white/50">
              <h3 className="font-semibold text-amber-900 mb-2 flex items-center">
                <span className="bg-amber-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">
                  1
                </span>
                Create a Supabase Project
              </h3>
              <p className="text-amber-700 text-sm mb-3">
                Sign up at Supabase and create a new project for your bowl tracker.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Go to Supabase
                </a>
              </Button>
            </div>

            <div className="border rounded-lg p-4 bg-white/50">
              <h3 className="font-semibold text-amber-900 mb-2 flex items-center">
                <span className="bg-amber-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">
                  2
                </span>
                Run Database Setup
              </h3>
              <p className="text-amber-700 text-sm">
                Execute the SQL script in your Supabase SQL editor to create the necessary tables.
              </p>
            </div>

            <div className="border rounded-lg p-4 bg-white/50">
              <h3 className="font-semibold text-amber-900 mb-2 flex items-center">
                <span className="bg-amber-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">
                  3
                </span>
                Create Storage Bucket
              </h3>
              <p className="text-amber-700 text-sm">
                Create a public storage bucket named "bowl-images" for storing your bowl photos.
              </p>
            </div>

            <div className="border rounded-lg p-4 bg-white/50">
              <h3 className="font-semibold text-amber-900 mb-2 flex items-center">
                <span className="bg-amber-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">
                  4
                </span>
                Set Environment Variables
              </h3>
              <p className="text-amber-700 text-sm mb-3">
                Add your Supabase URL and anon key to your environment variables:
              </p>
              <div className="bg-gray-100 rounded p-3 text-sm font-mono">
                <div>NEXT_PUBLIC_SUPABASE_URL=your-project-url</div>
                <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</div>
              </div>
            </div>
          </div>

          <div className="text-center pt-4">
            <Button onClick={() => window.location.reload()} className="bg-amber-600 hover:bg-amber-700">
              <Settings className="w-4 h-4 mr-2" />
              Check Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SupabaseSetup
