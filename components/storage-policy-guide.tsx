"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Database } from "lucide-react"

export function StoragePolicyGuide() {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-lg text-amber-900 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Storage Permission Issue Detected
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-amber-700 text-sm">
          The image upload failed due to Row Level Security policies. Here's how to fix it:
        </p>

        <div className="space-y-3">
          <div className="bg-white p-3 rounded border">
            <h3 className="font-medium text-amber-900 mb-2">1. Fix Database Policies</h3>
            <p className="text-sm text-amber-700 mb-2">Run this SQL script in your Supabase SQL Editor:</p>
            <Button variant="outline" size="sm" asChild>
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                <Database className="w-4 h-4 mr-2" />
                Open Supabase Dashboard
              </a>
            </Button>
          </div>

          <div className="bg-white p-3 rounded border">
            <h3 className="font-medium text-amber-900 mb-2">2. Storage Bucket Policies</h3>
            <p className="text-sm text-amber-700 mb-2">
              Go to Storage → Policies in your Supabase dashboard and create these policies for the "bowl-images"
              bucket:
            </p>
            <ul className="text-xs text-amber-600 space-y-1 ml-4">
              <li>• SELECT: Allow for everyone</li>
              <li>• INSERT: Allow for everyone</li>
              <li>• UPDATE: Allow for everyone</li>
              <li>• DELETE: Allow for everyone</li>
            </ul>
          </div>

          <div className="bg-white p-3 rounded border">
            <h3 className="font-medium text-amber-900 mb-2">3. Alternative: Disable RLS Temporarily</h3>
            <p className="text-sm text-amber-700">
              If you're still having issues, you can temporarily disable RLS on the storage bucket until you set up
              proper authentication.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
