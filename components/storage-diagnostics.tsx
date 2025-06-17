"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { RefreshCw, Upload, CheckCircle, XCircle, AlertTriangle, Database } from "lucide-react"

export default function StorageDiagnostics() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const runStorageTests = async () => {
    setTesting(true)
    setResults([])

    const testResults = []

    // Test 1: Check if storage is accessible
    try {
      console.log("Testing storage access...")
      const { data: buckets, error } = await supabase.storage.listBuckets()
      if (error) {
        testResults.push({
          test: "Storage Access",
          status: "error",
          message: error.message,
          details: "Cannot access Supabase Storage. Check your API keys and permissions.",
        })
      } else {
        testResults.push({
          test: "Storage Access",
          status: "success",
          message: `Found ${buckets.length} buckets`,
          details: `Available buckets: ${buckets.map((b) => b.name).join(", ") || "none"}`,
        })
      }
    } catch (e) {
      testResults.push({
        test: "Storage Access",
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
        details: "Failed to connect to Supabase Storage",
      })
    }

    // Test 2: Check bowl-images bucket specifically
    try {
      console.log("Testing bowl-images bucket...")
      const { data: files, error } = await supabase.storage.from("bowl-images").list("", { limit: 1 })
      if (error) {
        testResults.push({
          test: "Bowl Images Bucket",
          status: "error",
          message: error.message,
          details: "This usually means missing storage policies. Run the storage policy fix script.",
        })
      } else {
        testResults.push({
          test: "Bowl Images Bucket",
          status: "success",
          message: `Bucket accessible`,
          details: `Can list files in bucket (found ${files.length} items in root)`,
        })
      }
    } catch (e) {
      testResults.push({
        test: "Bowl Images Bucket",
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
        details: "Failed to access bowl-images bucket",
      })
    }

    // Test 3: Check bucket configuration
    try {
      console.log("Checking bucket configuration...")
      const { data: buckets } = await supabase.storage.listBuckets()
      const bowlBucket = buckets?.find((b) => b.name === "bowl-images")

      if (bowlBucket) {
        testResults.push({
          test: "Bucket Configuration",
          status: bowlBucket.public ? "success" : "warning",
          message: bowlBucket.public ? "Bucket is public" : "Bucket is private",
          details: `ID: ${bowlBucket.id}, Public: ${bowlBucket.public}, Created: ${bowlBucket.created_at}`,
        })
      } else {
        testResults.push({
          test: "Bucket Configuration",
          status: "error",
          message: "bowl-images bucket not found in bucket list",
          details: "The bucket may not exist or you don't have permission to see it",
        })
      }
    } catch (e) {
      testResults.push({
        test: "Bucket Configuration",
        status: "error",
        message: "Failed to check bucket configuration",
        details: e instanceof Error ? e.message : "Unknown error",
      })
    }

    // Test 4: Try a small upload
    try {
      console.log("Testing upload capability...")
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
          details: "Upload failed. This usually indicates missing storage policies.",
        })
      } else {
        // Clean up test file
        await supabase.storage.from("bowl-images").remove([testPath])
        testResults.push({
          test: "Upload Test",
          status: "success",
          message: "Upload and cleanup successful",
          details: "Storage upload/delete permissions are working correctly",
        })
      }
    } catch (e) {
      testResults.push({
        test: "Upload Test",
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
        details: "Failed to test upload functionality",
      })
    }

    // Test 5: Check public URL generation
    try {
      console.log("Testing public URL generation...")
      const { data } = supabase.storage.from("bowl-images").getPublicUrl("test.jpg")
      if (data.publicUrl && data.publicUrl.includes("supabase")) {
        testResults.push({
          test: "Public URL Generation",
          status: "success",
          message: "Can generate public URLs",
          details: `Sample URL: ${data.publicUrl}`,
        })
      } else {
        testResults.push({
          test: "Public URL Generation",
          status: "warning",
          message: "Public URL generation may have issues",
          details: data.publicUrl || "No URL generated",
        })
      }
    } catch (e) {
      testResults.push({
        test: "Public URL Generation",
        status: "error",
        message: e instanceof Error ? e.message : "Unknown error",
        details: "Failed to generate public URLs",
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

  const hasErrors = results.some((r) => r.status === "error")

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
                <Database className="w-4 h-4 mr-2" />
                Run Tests
              </>
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="font-medium">{result.test}</div>
                    <div className="text-sm text-gray-600 mb-1">{result.message}</div>
                    {result.details && (
                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded font-mono">{result.details}</div>
                    )}
                  </div>
                </div>
                <div className="ml-2">{getStatusBadge(result.status)}</div>
              </div>
            ))}
          </div>
        )}

        {hasErrors && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-medium text-red-900 mb-2">🚨 Storage Issues Detected</h3>
            <div className="text-sm text-red-700 space-y-2">
              <p>
                <strong>Most common fix:</strong> Run the storage policy script
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to your Supabase Dashboard → SQL Editor</li>
                <li>
                  Run the <code>scripts/06-fix-storage-policies.sql</code> script
                </li>
                <li>Verify your bucket is set to "Public" in Storage settings</li>
                <li>Re-run this diagnostic test</li>
              </ol>
            </div>
          </div>
        )}

        {results.length > 0 && !hasErrors && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">✅ Storage Configuration Looks Good!</h3>
            <p className="text-sm text-green-700">
              Your storage setup appears to be working correctly. You should be able to upload and manage bowl images.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
