"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Database, Key } from "lucide-react"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

interface ConfigCheck {
  name: string
  status: "success" | "error" | "warning"
  message: string
  details?: string
}

export default function SupabaseConfigChecker() {
  const [checks, setChecks] = useState<ConfigCheck[]>([])
  const [loading, setLoading] = useState(false)

  const runChecks = async () => {
    setLoading(true)
    const newChecks: ConfigCheck[] = []

    // Check 1: Environment Variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl) {
      newChecks.push({
        name: "Supabase URL",
        status: "error",
        message: "NEXT_PUBLIC_SUPABASE_URL not found",
        details: "Add your Supabase project URL to environment variables",
      })
    } else if (!supabaseUrl.includes("supabase.co")) {
      newChecks.push({
        name: "Supabase URL",
        status: "warning",
        message: "URL format looks incorrect",
        details: `Current: ${supabaseUrl}. Should look like: https://your-project.supabase.co`,
      })
    } else {
      newChecks.push({
        name: "Supabase URL",
        status: "success",
        message: "Environment variable configured",
        details: supabaseUrl,
      })
    }

    if (!supabaseKey) {
      newChecks.push({
        name: "Supabase Anon Key",
        status: "error",
        message: "NEXT_PUBLIC_SUPABASE_ANON_KEY not found",
        details: "Add your Supabase anon key to environment variables",
      })
    } else if (supabaseKey.length < 100) {
      newChecks.push({
        name: "Supabase Anon Key",
        status: "warning",
        message: "Key looks too short",
        details: "Supabase anon keys are typically 100+ characters long",
      })
    } else {
      newChecks.push({
        name: "Supabase Anon Key",
        status: "success",
        message: "Environment variable configured",
        details: `${supabaseKey.substring(0, 20)}...`,
      })
    }

    // Check 2: Client Connection
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from("bowls").select("*") //from page.tsx
        
        if (error) {
          newChecks.push({
            name: "Database Connection",
            status: "error",
            message: "Failed to connect to database",
            details: error.message,
          })
        } else {
          newChecks.push({
            name: "Database Connection",
            status: "success",
            message: "Successfully connected to database",
            details: `Found ${data?.length || 0} bowls`,
          })
        }
      } catch (err) {
        newChecks.push({
          name: "Database Connection",
          status: "error",
          message: "Connection failed",
          details: err instanceof Error ? err.message : "Unknown error",
        })
      }

      // Check 3: Tables Exist
      try {
        const tableChecks = ["bowls", "bowl_finishes", "bowl_images"]
        for (const table of tableChecks) {
          try {
            const { error } = await supabase.from(table).select("*", { count: "exact", head: true }).limit(1)

            if (error) {
              newChecks.push({
                name: `Table: ${table}`,
                status: "error",
                message: "Table not found or inaccessible",
                details: error.message,
              })
            } else {
              newChecks.push({
                name: `Table: ${table}`,
                status: "success",
                message: "Table exists and accessible",
              })
            }
          } catch (err) {
            newChecks.push({
              name: `Table: ${table}`,
              status: "error",
              message: "Failed to check table",
              details: err instanceof Error ? err.message : "Unknown error",
            })
          }
        }
      } catch (err) {
        newChecks.push({
          name: "Database Tables",
          status: "error",
          message: "Failed to check tables",
          details: err instanceof Error ? err.message : "Unknown error",
        })
      }

      // Check 4: Storage Bucket
      try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

        if (bucketsError) {
          newChecks.push({
            name: "Storage Access",
            status: "error",
            message: "Cannot access storage",
            details: bucketsError.message,
          })
        } else {
          const bowlImagesBucket = buckets?.find((bucket) => bucket.name === "bowl-images")

          if (!bowlImagesBucket) {
            newChecks.push({
              name: "Storage Bucket",
              status: "error",
              message: "bowl-images bucket not found",
              details: `Available buckets: ${buckets?.map((b) => b.name).join(", ") || "none"}`,
            })
          } else {
            newChecks.push({
              name: "Storage Bucket",
              status: "success",
              message: "bowl-images bucket found",
              details: `Public: ${bowlImagesBucket.public ? "Yes" : "No"}`,
            })
          }
        }
      } catch (err) {
        newChecks.push({
          name: "Storage Bucket",
          status: "error",
          message: "Failed to check storage",
          details: err instanceof Error ? err.message : "Unknown error",
        })
      }

      // Check 5: Test Upload (small test)
      try {
        const testData =
          "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCAxMCAxMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjRkY2NjAwIi8+Cjwvc3ZnPgo="
        const testPath = `test/config-check-${Date.now()}.svg`

        const { error: uploadError } = await supabase.storage.from("bowl-images").upload(testPath, testData, {
          contentType: "image/svg+xml",
        })

        if (uploadError) {
          newChecks.push({
            name: "Storage Upload Test",
            status: "error",
            message: "Cannot upload to storage",
            details: uploadError.message,
          })
        } else {
          // Clean up test file
          await supabase.storage.from("bowl-images").remove([testPath])

          newChecks.push({
            name: "Storage Upload Test",
            status: "success",
            message: "Storage upload working",
            details: "Test file uploaded and removed successfully",
          })
        }
      } catch (err) {
        newChecks.push({
          name: "Storage Upload Test",
          status: "error",
          message: "Upload test failed",
          details: err instanceof Error ? err.message : "Unknown error",
        })
      }
    } else {
      newChecks.push({
        name: "Database Connection",
        status: "error",
        message: "Cannot test - configuration missing",
        details: "Fix environment variables first",
      })
    }

    setChecks(newChecks)
    setLoading(false)
  }

  useEffect(() => {
    runChecks()
  }, [])

  const getStatusIcon = (status: ConfigCheck["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case "error":
        return <XCircle className="w-5 h-5 text-red-600" />
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
    }
  }

  const getStatusBadge = (status: ConfigCheck["status"]) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800">✓ OK</Badge>
      case "error":
        return <Badge variant="destructive">✗ Error</Badge>
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800">⚠ Warning</Badge>
    }
  }

  const successCount = checks.filter((c) => c.status === "success").length
  const errorCount = checks.filter((c) => c.status === "error").length
  const warningCount = checks.filter((c) => c.status === "warning").length

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-4xl">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-amber-900 flex items-center gap-2">
                  <Database className="w-6 h-6" />
                  Supabase Configuration Check
                </CardTitle>
                <p className="text-amber-700 mt-2">
                  Diagnostic tool to verify your Supabase setup for the Wood Bowl Tracker
                </p>
              </div>
              <Button onClick={runChecks} disabled={loading} variant="outline">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Re-check
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{successCount}</div>
                  <div className="text-sm text-green-600">Passing</div>
                </CardContent>
              </Card>
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-700">{warningCount}</div>
                  <div className="text-sm text-yellow-600">Warnings</div>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-700">{errorCount}</div>
                  <div className="text-sm text-red-600">Errors</div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Results */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-amber-900">Detailed Results</h3>
              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-600 mb-2" />
                  <p className="text-amber-700">Running configuration checks...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {checks.map((check, index) => (
                    <Card key={index} className="border-l-4 border-l-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getStatusIcon(check.status)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900">{check.name}</span>
                                {getStatusBadge(check.status)}
                              </div>
                              <p className="text-sm text-gray-700 mb-1">{check.message}</p>
                              {check.details && (
                                <p className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                                  {check.details}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Fixes */}
            {errorCount > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-lg text-amber-900 flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Quick Fixes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
                    <div className="text-sm">
                      <strong>Missing Supabase URL:</strong>
                      <p>Add this to your environment variables:</p>
                      <code className="block bg-white p-2 rounded mt-1 text-xs">
                        NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
                      </code>
                    </div>
                  )}
                  {!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && (
                    <div className="text-sm">
                      <strong>Missing Supabase Key:</strong>
                      <p>Add this to your environment variables:</p>
                      <code className="block bg-white p-2 rounded mt-1 text-xs">
                        NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
                      </code>
                    </div>
                  )}
                  {checks.some((c) => c.name.includes("Table") && c.status === "error") && (
                    <div className="text-sm">
                      <strong>Missing Database Tables:</strong>
                      <p>Run the SQL setup script in your Supabase SQL Editor</p>
                    </div>
                  )}
                  {checks.some((c) => c.name.includes("Storage") && c.status === "error") && (
                    <div className="text-sm">
                      <strong>Storage Issues:</strong>
                      <p>Create a public bucket named "bowl-images" in your Supabase Storage</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Success Message */}
            {errorCount === 0 && warningCount === 0 && checks.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold text-green-800 mb-1">Configuration Complete!</h3>
                  <p className="text-green-700">
                    Your Supabase setup is working correctly. You can now use the Wood Bowl Tracker with cloud storage.
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
