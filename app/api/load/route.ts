import {
  databaseConfig,
  failure,
  HttpError,
  limitedJson,
  localOnly,
} from "@/lib/server"
import { upsertAndVerify, validateBatch } from "@/lib/supabase-rest"

// Una única instancia de desarrollo local; evita cargas simultáneas incluso entre pestañas.
const globalLock = globalThis as typeof globalThis & { etlLoading?: boolean }
export async function POST(request: Request) {
  let locked = false
  try {
    localOnly(request)
    if (globalLock.etlLoading)
      throw new HttpError(
        409,
        "Ya hay un lote en curso. Espera a que termine y reintenta."
      )
    globalLock.etlLoading = true
    locked = true
    const body = await limitedJson(request)
    let rows
    try {
      rows = validateBatch(body)
    } catch (error) {
      throw new HttpError(400, (error as Error).message)
    }
    const result = await upsertAndVerify(databaseConfig(), rows)
    return Response.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return failure(error)
  } finally {
    if (locked) globalLock.etlLoading = false
  }
}
