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
        localStorage.removeItem("supabase.auth.token")
        sessionStorage.clear()
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

      // Clear user state immediately for better UX
      setUser(null)

      // Sign out from Supabase
      const { error } = await supabaseAuth.auth.signOut()

      if (error) {
        console.error("AuthProvider: Sign out error:", error)
        throw error
      }

      console.log("AuthProvider: Sign out successful")

      // Additional cleanup
      localStorage.removeItem("supabase.auth.token")
      sessionStorage.clear()

      // Force reload to clear any cached state
      window.location.reload()
    } catch (error) {
      console.error("AuthProvider: Sign out failed:", error)
      // Restore user state if sign out failed
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession()
      setUser(session?.user ?? null)
      throw error
    } finally {
      setLoading(false)
    }
  }

  console.log("AuthProvider: Rendering with user:", !!user, "loading:", loading)

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>
}
