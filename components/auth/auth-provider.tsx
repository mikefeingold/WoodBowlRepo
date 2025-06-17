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
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    console.log("AuthProvider: Setting up auth listener")

    // Get initial session
    const getInitialSession = async () => {
      try {
        // Don't restore session if we're in the middle of signing out
        if (isSigningOut) {
          setUser(null)
          setLoading(false)
          return
        }

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
      console.log("AuthProvider: Auth state changed:", event, !!session?.user, "isSigningOut:", isSigningOut)

      // If we're signing out, ignore any sign-in events
      if (isSigningOut && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        console.log("AuthProvider: Ignoring auth event during sign-out process")
        return
      }

      if (event === "SIGNED_OUT") {
        console.log("AuthProvider: User signed out, clearing user state")
        setUser(null)
        setIsSigningOut(false)
        // Clear any cached data
        try {
          // Clear all possible Supabase storage keys
          const keysToRemove = [
            "supabase.auth.token",
            "sb-auth-token",
            `sb-${supabaseAuth.supabaseUrl.split("//")[1]?.split(".")[0]}-auth-token`,
          ]
          keysToRemove.forEach((key) => {
            localStorage.removeItem(key)
            sessionStorage.removeItem(key)
          })

          // Clear all localStorage items that start with 'sb-'
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("sb-")) {
              localStorage.removeItem(key)
            }
          })
        } catch (e) {
          console.log("AuthProvider: Error clearing storage:", e)
        }
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        console.log("AuthProvider: User signed in or token refreshed")
        setUser(session?.user ?? null)
        setIsSigningOut(false)
      } else {
        setUser(session?.user ?? null)
      }

      setLoading(false)
    })

    return () => {
      console.log("AuthProvider: Cleaning up auth listener")
      subscription.unsubscribe()
    }
  }, [isSigningOut])

  const signOut = async () => {
    try {
      console.log("AuthProvider: Initiating sign out")
      setIsSigningOut(true)
      setLoading(true)

      // Immediately clear user state
      setUser(null)

      // Clear all possible storage locations first
      try {
        // Clear localStorage
        const keysToRemove = [
          "supabase.auth.token",
          "sb-auth-token",
          `sb-${supabaseAuth.supabaseUrl.split("//")[1]?.split(".")[0]}-auth-token`,
        ]
        keysToRemove.forEach((key) => {
          localStorage.removeItem(key)
          sessionStorage.removeItem(key)
        })

        // Clear all localStorage items that start with 'sb-'
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("sb-")) {
            localStorage.removeItem(key)
          }
        })

        // Clear sessionStorage completely
        sessionStorage.clear()
      } catch (e) {
        console.log("AuthProvider: Error clearing storage:", e)
      }

      // Check if we have a valid session first
      const {
        data: { session },
        error: sessionError,
      } = await supabaseAuth.auth.getSession()

      if (sessionError || !session) {
        console.log("AuthProvider: No valid session found, treating as already signed out")
        setIsSigningOut(false)
        setLoading(false)
        return
      }

      // Sign out from Supabase
      const { error } = await supabaseAuth.auth.signOut({
        scope: "global", // Sign out from all sessions
      })

      if (error) {
        console.error("AuthProvider: Sign out error:", error)

        // Check if it's a session missing error - this is actually OK
        if (error.message?.includes("Auth session missing") || error.message?.includes("session_not_found")) {
          console.log("AuthProvider: Session already expired/missing, treating as successful sign out")
        } else {
          throw error
        }
      }

      console.log("AuthProvider: Sign out successful")

      // Force a complete page reload to clear any cached state
      setTimeout(() => {
        window.location.href = window.location.origin
      }, 100)
    } catch (error) {
      console.error("AuthProvider: Sign out failed:", error)

      // Even if sign out fails, clear local state
      setUser(null)
      try {
        // Clear all possible storage again
        const keysToRemove = [
          "supabase.auth.token",
          "sb-auth-token",
          `sb-${supabaseAuth.supabaseUrl.split("//")[1]?.split(".")[0]}-auth-token`,
        ]
        keysToRemove.forEach((key) => {
          localStorage.removeItem(key)
          sessionStorage.removeItem(key)
        })

        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("sb-")) {
            localStorage.removeItem(key)
          }
        })
      } catch (e) {
        console.log("AuthProvider: Error clearing storage:", e)
      }

      // Force reload even on error
      setTimeout(() => {
        window.location.href = window.location.origin
      }, 100)
    } finally {
      setIsSigningOut(false)
      setLoading(false)
    }
  }

  console.log("AuthProvider: Rendering with user:", !!user, "loading:", loading, "isSigningOut:", isSigningOut)

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>
}
