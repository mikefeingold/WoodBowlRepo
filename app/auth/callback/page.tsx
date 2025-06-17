"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabaseAuth } from "@/lib/auth"

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabaseAuth.auth.getSession()

        if (error) {
          console.error("Auth callback error:", error)
          router.push("/?error=auth_error")
          return
        }

        if (data.session) {
          console.log("Auth callback successful")
          router.push("/")
        } else {
          console.log("No session found")
          router.push("/")
        }
      } catch (error) {
        console.error("Auth callback exception:", error)
        router.push("/?error=auth_error")
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}
