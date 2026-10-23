import { CITIES, archiveUrl, rangeDays } from "@/lib/etl"
import { HttpError, failure, localOnly } from "@/lib/server"

export async function GET(request: Request) {
  try {
    localOnly(request)
    const params = new URL(request.url).searchParams
    const city = CITIES.find((c) => c.name === params.get("city"))
    if (!city)
      throw new HttpError(
        400,
        "Selecciona una de las cinco ciudades disponibles."
      )
    const start = params.get("start") ?? "",
      end = params.get("end") ?? ""
    try {
      rangeDays(start, end)
    } catch (error) {
      throw new HttpError(400, (error as Error).message)
    }
    const response = await fetch(archiveUrl(city, start, end), {
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    })
    const raw = await response.json()
    if (!response.ok || raw.error)
      throw new HttpError(
        502,
        `Open-Meteo: ${typeof raw.reason === "string" ? raw.reason : `HTTP ${response.status}`}`
      )
    return Response.json(raw, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return failure(error)
  }
}
