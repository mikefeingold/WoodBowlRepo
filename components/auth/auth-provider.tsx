"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabaseAuth } from "@/lib/auth"

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log("AuthProvider: Setting up auth listener")

    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession()
        console.log("AuthProvider: Initial session", !!session?.user)
        setUser(session?.user ?? null)
      } catch (error) {
        console.error("AuthProvider: Error getting initial session:", error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabaseAuth.auth.onAuthStateChange(async (event, session) => {
      console.log("AuthProvider: Auth state changed:", event, !!session?.user)

      if (event === "SIGNED_OUT") {
        console.log("AuthProvider: User signed out, clearing user state")
        setUser(null)
        // Clear any cached data
        try {
          localStorage.removeItem("supabase.auth.token")
          sessionStorage.clear()
        } catch (e) {
          console.log("AuthProvider: Error clearing storage:", e)
        }
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        console.log("AuthProvider: User signed in or token refreshed")
        setUser(session?.user ?? null)
      } else {
        setUser(session?.user ?? null)
      }

      setLoading(false)
    })

    return () => {
      console.log("AuthProvider: Cleaning up auth listener")
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      console.log("AuthProvider: Initiating sign out")
      setLoading(true)

      // Check if we have a valid session first
      const {
        data: { session },
        error: sessionError,
      } = await supabaseAuth.auth.getSession()

      if (sessionError) {
        console.log("AuthProvider: Session error, treating as already signed out:", sessionError)
        // If there's a session error, treat as already signed out
        setUser(null)
        try {
          localStorage.removeItem("supabase.auth.token")
          sessionStorage.clear()
        } catch (e) {
          console.log("AuthProvider: Error clearing storage:", e)
        }
        return
      }

      if (!session) {
        console.log("AuthProvider: No active session, treating as already signed out")
        // No session exists, just clear local state
        setUser(null)
        try {
          localStorage.removeItem("supabase.auth.token")
          sessionStorage.clear()
        } catch (e) {
          console.log("AuthProvider: Error clearing storage:", e)
        }
        return
      }

      // Clear user state immediately for better UX
      setUser(null)

      // Sign out from Supabase
      const { error } = await supabaseAuth.auth.signOut()

      if (error) {
        console.error("AuthProvider: Sign out error:", error)

        // Check if it's a session missing error - this is actually OK
        if (error.message?.includes("Auth session missing") || error.message?.includes("session_not_found")) {
          console.log("AuthProvider: Session already expired/missing, treating as successful sign out")
          // Don't throw error for missing session - just continue with cleanup
        } else {
          throw error
        }
      }

      console.log("AuthProvider: Sign out successful")

      // Additional cleanup
      try {
        localStorage.removeItem("supabase.auth.token")
        sessionStorage.clear()
      } catch (e) {
        console.log("AuthProvider: Error clearing storage:", e)
      }

      // Force reload to clear any cached state
      setTimeout(() => {
        window.location.reload()
      }, 100)
    } catch (error) {
      console.error("AuthProvider: Sign out failed:", error)

      // Even if sign out fails, clear local state
      setUser(null)
      try {
        localStorage.removeItem("supabase.auth.token")
        sessionStorage.clear()
      } catch (e) {
        console.log("AuthProvider: Error clearing storage:", e)
      }

      // Don't re-throw the error - just log it and continue
      console.log("AuthProvider: Continuing with local cleanup despite error")
    } finally {
      setLoading(false)
    }
  }

  console.log("AuthProvider: Rendering with user:", !!user, "loading:", loading)

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>
}
