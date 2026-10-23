import "server-only"
import { localAccessError } from "./http-security"
import { MAX_BODY_BYTES, type DatabaseConfig } from "./supabase-rest"

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}
export function localOnly(request: Request) {
  const error = localAccessError(request, process.env.NODE_ENV)
  if (error) throw new HttpError(403, error)
}
export function databaseConfig(): DatabaseConfig {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "")
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret)
    throw new HttpError(
      503,
      "Falta SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY) en .env.local. La clave publishable no habilita esta carga. Configura también la URL y ejecuta la migración SQL."
    )
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))
    throw new HttpError(
      503,
      "La URL de Supabase debe ser la URL HTTPS del proyecto (*.supabase.co)."
    )
  if (!secret.startsWith("sb_secret_") && !secret.startsWith("eyJ"))
    throw new HttpError(
      503,
      "Se requiere una clave secreta de servidor, no una clave publishable."
    )
  return { url, secret }
}
export async function limitedJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Envía JSON con Content-Type application/json.")
  const length = Number(request.headers.get("content-length") ?? 0)
  if (length > MAX_BODY_BYTES)
    throw new HttpError(413, "La petición supera el máximo de 160 KB.")
  if (!request.body) throw new HttpError(400, "La petición no contiene datos.")
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new HttpError(413, "La petición supera el máximo de 160 KB.")
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new HttpError(400, "El JSON recibido no es válido.")
  }
}
export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado."
  return Response.json(
    { error: message },
    {
      status: error instanceof HttpError ? error.status : 502,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
