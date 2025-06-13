"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { RefreshCw, Database, Bug, CheckCircle, XCircle, ArrowRight } from "lucide-react"

export default function DatabaseDebugger() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [testBowlId, setTestBowlId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const runTests = async () => {
    setLoading(true)
    setResults([])
    setError(null)
    setSuccess(null)
    setTestBowlId(null)

    try {
      // Test 1: Check if tables exist
      await logOperation("Checking database tables...", async () => {
        const tables = ["bowls", "bowl_finishes", "bowl_images"]
        for (const table of tables) {
          const { error } = await supabase.from(table).select("*", { count: "exact", head: true }).limit(1)
          if (error) throw new Error(`Table '${table}' error: ${error.message}`)
        }
        return "All tables exist and are accessible"
      })

      // Test 2: Check table structure
      await logOperation("Checking table structure...", async () => {
        // This is a simplified check - just making sure we can query the expected columns
        const { data, error } = await supabase
          .from("bowls")
          .select("id, wood_type, wood_source, date_made, comments, created_at, updated_at")
          .limit(1)

        if (error) throw new Error(`Structure error: ${error.message}`)
        return "Table structure appears correct"
      })

      // Test 3: Insert a test bowl
      await logOperation("Inserting test bowl...", async () => {
        const { data, error } = await supabase
          .from("bowls")
          .insert({
            wood_type: "Test Wood",
            wood_source: "Debug Test",
            date_made: new Date().toISOString().split("T")[0],
            comments: "This is a test bowl created by the debugger",
          })
          .select()
          .single()

        if (error) throw new Error(`Insert error: ${error.message}`)
        if (!data) throw new Error("No data returned from insert")

        setTestBowlId(data.id)
        return `Test bowl created with ID: ${data.id}`
      })

      // Test 4: Insert test finish
      if (testBowlId) {
        await logOperation("Adding test finish...", async () => {
          const { error } = await supabase.from("bowl_finishes").insert({
            bowl_id: testBowlId,
            finish_name: "Test Finish",
          })

          if (error) throw new Error(`Finish insert error: ${error.message}`)
          return "Test finish added successfully"
        })
      }

      // Test 5: Check permissions
      await logOperation("Checking permissions...", async () => {
        if (!testBowlId) throw new Error("No test bowl ID available")

        // Try to update the test bowl
        const { error: updateError } = await supabase
          .from("bowls")
          .update({ comments: "Updated by permission test" })
          .eq("id", testBowlId)

        if (updateError) throw new Error(`Update permission error: ${updateError.message}`)

        return "Update permissions confirmed"
      })

      // Test 6: Clean up test data
      if (testBowlId) {
        await logOperation("Cleaning up test data...", async () => {
          const { error } = await supabase.from("bowls").delete().eq("id", testBowlId)
          if (error) throw new Error(`Cleanup error: ${error.message}`)
          return "Test data cleaned up successfully"
        })
      }

      setSuccess("All database tests passed! Your Supabase database is working correctly.")
    } catch (err) {
      console.error("Database test error:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  const logOperation = async (description: string, operation: () => Promise<string>) => {
    const start = Date.now()
    try {
      const result = await operation()
      const duration = Date.now() - start
      setResults((prev) => [...prev, { description, result, duration, status: "success" }])
      return result
    } catch (error) {
      const duration = Date.now() - start
      const message = error instanceof Error ? error.message : "Unknown error"
      setResults((prev) => [...prev, { description, error: message, duration, status: "error" }])
      throw error
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Database className="w-5 h-5" />
            Database Connection Debugger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            This tool will test your database connection and permissions by performing a series of operations. It will
            help identify why bowls aren't being stored in your database.
          </p>

          <Button onClick={runTests} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Bug className="w-4 h-4 mr-2" />
                Run Database Tests
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-md border ${
                  result.status === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.status === "success" ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.description}</span>
                      <Badge variant={result.status === "success" ? "outline" : "destructive"} className="text-xs">
                        {result.duration}ms
                      </Badge>
                    </div>
                    {result.status === "success" ? (
                      <p className="text-sm text-green-700 mt-1">{result.result}</p>
                    ) : (
                      <p className="text-sm text-red-700 mt-1">{result.error}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
          {error && (
            <CardFooter className="bg-red-50 border-t border-red-200">
              <div className="text-red-700 text-sm">
                <strong>Error:</strong> {error}
              </div>
            </CardFooter>
          )}
          {success && (
            <CardFooter className="bg-green-50 border-t border-green-200">
              <div className="text-green-700 text-sm">
                <strong>Success:</strong> {success}
              </div>
            </CardFooter>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Form Submission Debugger</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            If the database tests pass but you're still having issues, let's check the form submission process. Here's
            what to look for:
          </p>

          <div className="space-y-3">
            <div className="p-3 border rounded-md">
              <h3 className="font-medium flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Check Browser Console
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Open your browser's developer tools (F12) and check the console for any JavaScript errors when
                submitting the form.
              </p>
            </div>

            <div className="p-3 border rounded-md">
              <h3 className="font-medium flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Network Requests
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                In the Network tab of developer tools, look for requests to Supabase when submitting the form. Check if
                they're successful (status 200/201) or failing.
              </p>
            </div>

            <div className="p-3 border rounded-md">
              <h3 className="font-medium flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Form Data
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Verify that all required fields are being filled out correctly in the form.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manual SQL Query</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">You can run a custom SQL query to check your database directly:</p>
          <Textarea placeholder="SELECT * FROM bowls LIMIT 10;" className="font-mono text-sm" rows={3} />
          <Button variant="outline">Run Query</Button>
          <div className="text-xs text-amber-600">
            Note: For security reasons, this feature is disabled in the preview. You can run SQL queries in the Supabase
            dashboard SQL Editor.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
