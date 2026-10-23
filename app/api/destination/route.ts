import { CITIES, SORT_FIELDS, dateOnly } from "@/lib/etl"
import { databaseConfig, failure, HttpError, localOnly } from "@/lib/server"
import { databaseRequest } from "@/lib/supabase-rest"

export async function GET(request: Request) {
  try {
    localOnly(request)
    const p = new URL(request.url).searchParams
    const page = Number(p.get("page") ?? 1),
      city = p.get("city") ?? ""
    const from = p.get("from") ?? "",
      to = p.get("to") ?? ""
    const sort = p.get("sort") ?? "fecha_hora",
      direction = p.get("direction") ?? "desc"
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000 ||
      (city && !CITIES.some((c) => c.name === city)) ||
      !SORT_FIELDS.includes(sort as (typeof SORT_FIELDS)[number]) ||
      !["asc", "desc"].includes(direction) ||
      (from && !Number.isFinite(dateOnly(from))) ||
      (to && !Number.isFinite(dateOnly(to))) ||
      (from && to && from > to)
    ) {
      throw new HttpError(
        400,
        "Revisa la ciudad, el intervalo de fechas, el orden y la página."
      )
    }
    const query = new URLSearchParams({
      select:
        "id,ciudad,fecha_hora,temperatura_c,humedad_pct,precipitacion_mm,importado_en",
      order: `${sort}.${direction},id.asc`,
      limit: "25",
      offset: String((page - 1) * 25),
    })
    if (city) query.set("ciudad", `eq.${city}`)
    if (from) query.append("fecha_hora", `gte.${from}T00:00:00Z`)
    if (to) query.append("fecha_hora", `lte.${to}T23:59:59.999Z`)
    const response = await databaseRequest(databaseConfig(), query, {
      headers: { Prefer: "count=exact" },
    })
    const total = Number(
      response.headers.get("content-range")?.split("/")[1] ?? 0
    )
    return Response.json(
      { rows: await response.json(), total, page },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    return failure(error)
  }
}
