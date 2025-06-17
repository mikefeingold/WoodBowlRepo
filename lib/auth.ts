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
  const { error } = await supabaseAuth.auth.signOut()
  return { error }
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
