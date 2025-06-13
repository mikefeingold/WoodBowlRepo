import DatabaseDebugger from "@/components/database-debugger"
import StorageDiagnostics from "@/components/storage-diagnostics"

export default function DebugPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-amber-900 mb-6">Database Debugging</h1>
        <DatabaseDebugger />
        <StorageDiagnostics />
      </div>
    </div>
  )
}
