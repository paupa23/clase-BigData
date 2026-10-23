import { createBrowserClient } from "@supabase/ssr"

import { getSupabaseConfig } from "@/utils/supabase/config"

export function createClient() {
  const config = getSupabaseConfig()

  if (!config) {
    throw new Error(
      "Falta configurar la URL y la clave pública de Supabase en .env.local."
    )
  }

  return createBrowserClient(config.url, config.key)
}
