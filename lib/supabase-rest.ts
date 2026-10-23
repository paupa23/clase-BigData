import { keyOf, utcTime, validationReasons, type Measurement } from "./etl.ts"

export const MAX_BODY_BYTES = 160_000
export function validateBatch(body: unknown): Measurement[] {
  if (
    !body ||
    typeof body !== "object" ||
    !("rows" in body) ||
    !Array.isArray(body.rows) ||
    body.rows.length < 1 ||
    body.rows.length > 500
  ) {
    throw new Error("Envía entre 1 y 500 registros por lote.")
  }
  const seen = new Set<string>()
  return body.rows.map((row: unknown, i: number) => {
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw new Error(`Fila ${i + 1}: formato inválido.`)
    const candidate = row as Record<string, unknown>
    const reasons = validationReasons(candidate)
    if (reasons.length) throw new Error(`Fila ${i + 1}: ${reasons.join("; ")}.`)
    // Lista explícita de columnas: nunca se aceptan id, importado_en ni campos adicionales.
    const normalized: Measurement = {
      ciudad: (candidate.ciudad as string).trim(),
      fecha_hora: utcTime(candidate.fecha_hora)!,
      temperatura_c: candidate.temperatura_c as number,
      humedad_pct: candidate.humedad_pct as number,
      precipitacion_mm: candidate.precipitacion_mm as number,
    }
    if (seen.has(keyOf(normalized)))
      throw new Error(`Fila ${i + 1}: clave duplicada en el lote.`)
    seen.add(keyOf(normalized))
    return normalized
  })
}

export type DatabaseConfig = { url: string; secret: string }
export async function databaseRequest(
  config: DatabaseConfig,
  params: URLSearchParams,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch
) {
  const response = await fetcher(
    `${config.url}/rest/v1/mediciones_meteorologicas?${params}`,
    {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      headers: {
        apikey: config.secret,
        // Las claves sb_secret_ van únicamente en apikey; las service_role JWT también en Authorization.
        ...(config.secret.startsWith("eyJ")
          ? { Authorization: `Bearer ${config.secret}` }
          : {}),
        "Content-Type": "application/json",
        ...init.headers,
      },
    }
  )
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    if (detail.code === "PGRST205" || detail.code === "42P01")
      throw new Error(
        "La tabla no existe o no está disponible. Ejecuta la migración SQL en Supabase."
      )
    if (response.status === 401 || response.status === 403)
      throw new Error(
        "Supabase ha rechazado el acceso. Revisa la clave secreta de servidor y sus permisos."
      )
    throw new Error(
      `Supabase devolvió HTTP ${response.status}${typeof detail.code === "string" ? ` (${detail.code.replace(/[^A-Z0-9]/g, "")})` : ""}. Revisa la tabla y sus restricciones.`
    )
  }
  return response
}

export async function upsertAndVerify(
  config: DatabaseConfig,
  rows: Measurement[],
  fetcher: typeof fetch = fetch
) {
  await databaseRequest(
    config,
    new URLSearchParams({ on_conflict: "ciudad,fecha_hora" }),
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    },
    fetcher
  )
  const found = new Set<string>()
  // Claves exactas por grupos pequeños para evitar URLs excesivas y el límite de 1000 filas.
  for (let i = 0; i < rows.length; i += 25) {
    const group = rows.slice(i, i + 25)
    const clauses = group.map(
      (r) =>
        `and(ciudad.eq.${JSON.stringify(r.ciudad)},fecha_hora.eq.${JSON.stringify(r.fecha_hora)})`
    )
    const response = await databaseRequest(
      config,
      new URLSearchParams({
        select: "ciudad,fecha_hora",
        or: `(${clauses.join(",")})`,
        limit: "25",
      }),
      {},
      fetcher
    )
    const keys: Pick<Measurement, "ciudad" | "fecha_hora">[] =
      await response.json()
    if (!Array.isArray(keys))
      throw new Error("Supabase no devolvió un conjunto de claves válido.")
    for (const key of keys) {
      const time = utcTime(key.fecha_hora)
      if (time) found.add(keyOf({ ciudad: key.ciudad, fecha_hora: time }))
    }
  }
  const verified = rows.filter((r) => found.has(keyOf(r))).length
  if (verified !== rows.length)
    throw new Error(
      `Escritura realizada, pero solo se verificaron ${verified} de ${rows.length} claves. Puedes reintentar el upsert sin duplicar.`
    )
  return { verified }
}
