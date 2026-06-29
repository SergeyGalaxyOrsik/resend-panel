import { createClient } from "@supabase/supabase-js"

function getSupabaseKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || ""
}

export function getSupabaseUrl() {
  return process.env.SUPABASE_URL || ""
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseKey())
}

export const supabase = createClient(getSupabaseUrl() || "https://placeholder.supabase.co", getSupabaseKey() || "placeholder", {
  auth: { persistSession: false, autoRefreshToken: false },
})
