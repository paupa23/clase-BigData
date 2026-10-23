import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getSupabaseConfig } from "@/utils/supabase/config"

export function createClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const config = getSupabaseConfig()

  if (!config) {
    throw new Error(
      "Falta configurar la URL y la clave pública de Supabase en .env.local."
    )
  }

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Components cannot write cookies. The proxy refreshes them.
        }
      },
    },
  })
}
