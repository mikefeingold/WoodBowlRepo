import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables")
}

// Create a separate auth client
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)

// Auth helper functions
export const signUp = async (email: string, password: string, fullName: string) => {
  try {
    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      console.error("SignUp error:", error.message)
    } else {
      console.log("SignUp successful")
    }

    return { data, error }
  } catch (err) {
    console.error("SignUp exception:", err)
    return { data: null, error: { message: "An unexpected error occurred" } }
  }
}

export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("SignIn error:", error.message)
    } else {
      console.log("SignIn successful")
    }

    return { data, error }
  } catch (err) {
    console.error("SignIn exception:", err)
    return { data: null, error: { message: "An unexpected error occurred" } }
  }
}

export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabaseAuth.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      console.error("Google SignIn error:", error.message)
    } else {
      console.log("Google SignIn initiated")
    }

    return { data, error }
  } catch (err) {
    console.error("Google SignIn exception:", err)
    return { data: null, error: { message: "An unexpected error occurred" } }
  }
}

export const signOut = async () => {
  try {
    console.log("lib/auth: Initiating sign out")

    // Check if we have a valid session first
    const {
      data: { session },
      error: sessionError,
    } = await supabaseAuth.auth.getSession()

    if (sessionError || !session) {
      console.log("lib/auth: No valid session found, treating as already signed out")
      return { error: null }
    }

    const { error } = await supabaseAuth.auth.signOut()

    if (error) {
      // Check if it's a session missing error - this is actually OK
      if (error.message?.includes("Auth session missing") || error.message?.includes("session_not_found")) {
        console.log("lib/auth: Session already expired/missing, treating as successful sign out")
        return { error: null }
      }
      console.error("lib/auth: Sign out error:", error)
      return { error }
    }

    console.log("lib/auth: Sign out successful")
    return { error: null }
  } catch (err) {
    console.error("lib/auth: Sign out exception:", err)
    return { error: { message: "An unexpected error occurred during sign out" } }
  }
}

export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser()
  return { user, error }
}

export const getSession = async () => {
  const {
    data: { session },
    error,
  } = await supabaseAuth.auth.getSession()
  return { session, error }
}
