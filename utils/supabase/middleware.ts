import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { getSupabaseConfig } from "@/utils/supabase/config"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const config = getSupabaseConfig()

  if (!config) return supabaseResponse

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
        Object.entries(headers).forEach(([name, value]) =>
          supabaseResponse.headers.set(name, value)
        )
      },
    },
  })

  // Verifying claims also refreshes an expired session and writes its cookies.
  await supabase.auth.getClaims()

  return supabaseResponse
}
