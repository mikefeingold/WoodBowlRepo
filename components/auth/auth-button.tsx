"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "./auth-provider"
import { signIn, signUp, signInWithGoogle } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { LogIn, LogOut, User, X, AlertCircle } from "lucide-react"

export function AuthButton() {
  const { user, signOut, loading } = useAuth()
  const { toast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [signOutLoading, setSignOutLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin")
  const [error, setError] = useState<string>("")

  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  })

  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    fullName: "",
  })

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Sign in attempt:", { email: signInData.email })
    setAuthLoading(true)
    setError("")

    try {
      const { error } = await signIn(signInData.email, signInData.password)

      if (error) {
        console.error("Sign in error:", error)

        // Provide more helpful error messages
        let errorMessage = error.message
        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "Invalid email or password. Please check your credentials or sign up for a new account."
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Please check your email and click the confirmation link before signing in."
        } else if (error.message.includes("Too many requests")) {
          errorMessage = "Too many sign-in attempts. Please wait a moment before trying again."
        }

        setError(errorMessage)
        toast({
          title: "Sign In Failed",
          description: errorMessage,
          variant: "destructive",
        })
      } else {
        console.log("Sign in successful")
        toast({
          title: "Welcome back!",
          description: "You've been signed in successfully.",
        })
        setShowModal(false)
        setSignInData({ email: "", password: "" })
        setError("")
      }
    } catch (error) {
      console.error("Unexpected sign in error:", error)
      const errorMessage = "An unexpected error occurred. Please try again."
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Sign up attempt:", { email: signUpData.email, fullName: signUpData.fullName })
    setAuthLoading(true)
    setError("")

    // Basic validation
    if (signUpData.password.length < 6) {
      setError("Password must be at least 6 characters long.")
      setAuthLoading(false)
      return
    }

    try {
      const { error } = await signUp(signUpData.email, signUpData.password, signUpData.fullName)

      if (error) {
        console.error("Sign up error:", error)

        // Provide more helpful error messages
        let errorMessage = error.message
        if (error.message.includes("User already registered")) {
          errorMessage = "An account with this email already exists. Please sign in instead."
        } else if (error.message.includes("Password should be at least")) {
          errorMessage = "Password must be at least 6 characters long."
        } else if (error.message.includes("Invalid email")) {
          errorMessage = "Please enter a valid email address."
        }

        setError(errorMessage)
        toast({
          title: "Sign Up Failed",
          description: errorMessage,
          variant: "destructive",
        })
      } else {
        console.log("Sign up successful")
        toast({
          title: "Account Created!",
          description: "Please check your email to verify your account before signing in.",
        })
        setShowModal(false)
        setSignUpData({ email: "", password: "", fullName: "" })
        setError("")
      }
    } catch (error) {
      console.error("Unexpected sign up error:", error)
      const errorMessage = "An unexpected error occurred. Please try again."
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    console.log("Google sign in attempt")
    setGoogleLoading(true)
    setError("")

    try {
      const { error } = await signInWithGoogle()

      if (error) {
        console.error("Google sign in error:", error)
        setError("Failed to sign in with Google. Please try again.")
        toast({
          title: "Google Sign In Failed",
          description: "Failed to sign in with Google. Please try again.",
          variant: "destructive",
        })
        setGoogleLoading(false)
      }
      // Don't set loading to false here - the redirect will handle it
    } catch (error) {
      console.error("Unexpected Google sign in error:", error)
      setError("An unexpected error occurred with Google sign in.")
      toast({
        title: "Error",
        description: "An unexpected error occurred with Google sign in.",
        variant: "destructive",
      })
      setGoogleLoading(false)
    }
  }

  const handleSignOut = async () => {
    console.log("AuthButton: Sign out button clicked")
    setSignOutLoading(true)

    try {
      await signOut()
      toast({
        title: "Signed Out",
        description: "You've been signed out successfully.",
      })
    } catch (error) {
      console.error("AuthButton: Sign out error:", error)
      // Don't show error toast for session missing errors - they're expected
      if (!error?.message?.includes("Auth session missing")) {
        toast({
          title: "Sign Out",
          description: "You've been signed out.",
        })
      } else {
        toast({
          title: "Signed Out",
          description: "You've been signed out successfully.",
        })
      }
    } finally {
      setSignOutLoading(false)
    }
  }

  const openModal = () => {
    console.log("Opening auth modal")
    setShowModal(true)
    setError("")
  }

  const closeModal = () => {
    console.log("Closing auth modal")
    setShowModal(false)
    setError("")
    setSignInData({ email: "", password: "" })
    setSignUpData({ email: "", password: "", fullName: "" })
  }

  const switchToSignUp = () => {
    setActiveTab("signup")
    setError("")
  }

  const switchToSignIn = () => {
    setActiveTab("signin")
    setError("")
  }

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        Loading...
      </Button>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-amber-700">
          <User className="w-4 h-4" />
          <span className="hidden sm:inline">{user.user_metadata?.full_name || user.email}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signOutLoading}>
          <LogOut className="w-4 h-4 mr-2" />
          {signOutLoading ? "Signing Out..." : "Sign Out"}
        </Button>
      </div>
    )
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openModal}>
        <LogIn className="w-4 h-4 mr-2" />
        Sign In
      </Button>

      {/* Custom Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={closeModal} />

          {/* Modal Content */}
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Authentication</h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  {error}
                  {error.includes("Invalid email or password") && (
                    <div className="mt-1">
                      <button onClick={switchToSignUp} className="text-red-600 underline hover:text-red-800">
                        Don't have an account? Sign up here
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading || authLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {googleLoading ? "Signing in..." : "Continue with Google"}
            </button>

            {/* Divider */}
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>

            {/* Tab Buttons */}
            <div className="flex w-full border-b mb-4">
              <button
                className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 ${
                  activeTab === "signin"
                    ? "border-amber-600 text-amber-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={switchToSignIn}
              >
                Sign In
              </button>
              <button
                className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 ${
                  activeTab === "signup"
                    ? "border-amber-600 text-amber-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={switchToSignUp}
              >
                Sign Up
              </button>
            </div>

            {/* Sign In Form */}
            {activeTab === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label htmlFor="signin-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                    disabled={authLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <label htmlFor="signin-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    id="signin-password"
                    type="password"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    required
                    disabled={authLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {authLoading ? "Signing In..." : "Sign In"}
                </button>
                <p className="text-sm text-gray-600 text-center">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={switchToSignUp}
                    className="text-amber-600 hover:text-amber-700 underline"
                  >
                    Sign up here
                  </button>
                </p>
              </form>
            )}

            {/* Sign Up Form */}
            {activeTab === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    value={signUpData.fullName}
                    onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                    required
                    disabled={authLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    required
                    disabled={authLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    required
                    disabled={authLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Create a password (min 6 characters)"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {authLoading ? "Creating Account..." : "Sign Up"}
                </button>
                <p className="text-sm text-gray-600 text-center">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={switchToSignIn}
                    className="text-amber-600 hover:text-amber-700 underline"
                  >
                    Sign in here
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
