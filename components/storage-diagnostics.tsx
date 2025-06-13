"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { RefreshCw, Upload, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

export default function StorageDiagnostics() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const runStorageTests = async () => {
    setTesting(true)
    setResults([])

    const testResults = []

    // Test 1: Check if storage is accessible
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets()
      if (error) {
        testResults.push({
          test: "Storage Access",
          status: "error",
          message: error.message,
        })
      } else {
        testResults.push({
          test: "Storage Access",
          status: "success",
          message: `Found ${buckets.length} buckets`,
        })
      }
    } catch (e) {
      testResults.push({
        test: "Storage Access",
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      })
    }

    // Test 2: Check bowl-images bucket
    try {
      const { data: files, error } = await supabase.storage.from("bowl-images").list()
      if (error) {
        testResults.push({
          test: "Bowl Images Bucket",
          status: "error",
          message: error.message,
        })
      } else {
        testResults.push({
          test: "Bowl Images Bucket",
          status: "success",
          message: `Bucket accessible, ${files.length} items`,
        })
      }
    } catch (e) {
      testResults.push({
        test: "Bowl Images Bucket",
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      })
    }

    // Test 3: Try a small upload
    try {
      const testData =
        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCAxMCAxMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjRkY2NjAwIi8+Cjwvc3ZnPgo="
      const testPath = `test/diagnostic-${Date.now()}.svg`

      // Convert base64 to bytes
      const [, data] = testData.split(",")
      const binaryString = atob(data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const { error: uploadError } = await supabase.storage.from("bowl-images").upload(testPath, bytes, {
        contentType: "image/svg+xml",
        upsert: true,
      })

      if (uploadError) {
        testResults.push({
          test: "Upload Test",
          status: "error",
          message: uploadError.message,
        })
      } else {
        // Clean up test file
        await supabase.storage.from("bowl-images").remove([testPath])
        testResults.push({
          test: "Upload Test",
          status: "success",
          message: "Upload and cleanup successful",
        })
      }
    } catch (e) {
      testResults.push({
        test: "Upload Test",
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      })
    }

    // Test 4: Check storage policies
    try {
      // This is a indirect test - try to get public URL
      const { data } = supabase.storage.from("bowl-images").getPublicUrl("test.jpg")
      if (data.publicUrl) {
        testResults.push({
          test: "Public URL Generation",
          status: "success",
          message: "Can generate public URLs",
        })
      } else {
        testResults.push({
          test: "Public URL Generation",
          status: "warning",
          message: "Public URL generation may have issues",
        })
      }
    } catch (e) {
      testResults.push({
        test: "Public URL Generation",
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      })
    }

    setResults(testResults)
    setTesting(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "error":
        return <XCircle className="w-4 h-4 text-red-600" />
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800">✓ OK</Badge>
      case "error":
        return <Badge variant="destructive">✗ Error</Badge>
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800">⚠ Warning</Badge>
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Storage Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">Test your Supabase storage configuration and permissions</p>
          <Button onClick={runStorageTests} disabled={testing} variant="outline">
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Run Tests
              </>
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <div className="font-medium">{result.test}</div>
                    <div className="text-sm text-gray-600">{result.message}</div>
                  </div>
                </div>
                {getStatusBadge(result.status)}
              </div>
            ))}
          </div>
        )}

        {results.some((r) => r.status === "error") && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-medium text-red-900 mb-2">Storage Issues Detected</h3>
            <div className="text-sm text-red-700 space-y-2">
              <p>To fix storage upload issues:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Run the comprehensive RLS fix SQL script</li>
                <li>Go to Supabase Dashboard → Storage → Policies</li>
                <li>Create policies for "bowl-images" bucket allowing all operations</li>
                <li>Make sure the bucket is set to "Public"</li>
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
