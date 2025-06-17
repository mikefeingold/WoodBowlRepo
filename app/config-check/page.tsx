import SupabaseConfigChecker from "@/components/supabase-config-checker"

export default function ConfigCheckPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-amber-900 mb-2">Configuration Diagnostics</h1>
          <p className="text-amber-700">Use this page to troubleshoot your Supabase setup and database connection</p>
        </div>
        <SupabaseConfigChecker />
      </div>
    </div>
  )
}
