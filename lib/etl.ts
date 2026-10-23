export const CITIES = [
  { name: "Barcelona", latitude: 41.3874, longitude: 2.1686 },
  { name: "Madrid", latitude: 40.4168, longitude: -3.7038 },
  { name: "Sevilla", latitude: 37.3891, longitude: -5.9845 },
  { name: "Bilbao", latitude: 43.263, longitude: -2.935 },
  { name: "Valencia", latitude: 39.4699, longitude: -0.3763 },
] as const

export type Measurement = {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}
export type Candidate = { [K in keyof Measurement]: unknown } & { fila: string }
export type Rejected = Candidate & { motivo: string }
export type Raw = Record<string, unknown>
export type Filters = {
  cities: string[]
  from: string
  to: string
  tempMin: string
  tempMax: string
  humidityMin: string
  humidityMax: string
  rainMin: string
  rainMax: string
  rainy: boolean
}
export const EMPTY_FILTERS: Filters = {
  cities: [],
  from: "",
  to: "",
  tempMin: "",
  tempMax: "",
  humidityMin: "",
  humidityMax: "",
  rainMin: "",
  rainMax: "",
  rainy: false,
}
export const SORT_FIELDS = [
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
] as const
export type SortField = (typeof SORT_FIELDS)[number]
export const keyOf = (r: Pick<Measurement, "ciudad" | "fecha_hora">) =>
  `${r.ciudad}|${r.fecha_hora}`
export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v)

export function dateOnly(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time
    : NaN
}

export function rangeDays(start: string, end: string): number {
  const a = dateOnly(start),
    b = dateOnly(end)
  if (!Number.isFinite(a) || !Number.isFinite(b))
    throw new Error("Introduce dos fechas válidas.")
  const days = (b - a) / 86400000 + 1
  if (days < 1)
    throw new Error("La fecha final debe ser igual o posterior a la inicial.")
  if (days > 31)
    throw new Error(
      "Cada extracción admite como máximo 31 días, incluidos ambos extremos."
    )
  if (start < "1940-01-01")
    throw new Error("El archivo histórico comienza en 1940.")
  if (b > Date.now())
    throw new Error("La fecha final no puede estar en el futuro.")
  return days
}

// Open-Meteo devuelve ISO sin zona cuando se solicita UTC. Nunca se usa la zona del navegador.
export function utcTime(value: unknown): string | null {
  if (typeof value !== "string") return null
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(?:Z|\+00:00)?$/.exec(
      value
    )
  if (
    !match ||
    !Number.isFinite(dateOnly(match[1])) ||
    +match[2] > 23 ||
    +match[3] > 59 ||
    +(match[4] ?? 0) > 59
  )
    return null
  const explicit = /(?:Z|\+00:00)$/.test(value) ? value : `${value}Z`
  const time = Date.parse(explicit)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

export function transform(city: string, raw: Raw): Candidate[] {
  const h = raw.hourly as Record<string, unknown> | undefined
  const fields = [
    "time",
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
  ]
  if (!h || fields.some((f) => !Array.isArray(h[f])))
    throw new Error(`${city}: faltan arrays horarios en la respuesta.`)
  const arrays = fields.map((f) => h[f] as unknown[])
  if (arrays.some((a) => a.length !== arrays[0].length))
    throw new Error(
      `${city}: los arrays horarios tienen longitudes incoherentes. No se ha combinado esta ciudad.`
    )
  if (raw.utc_offset_seconds !== 0)
    throw new Error(`${city}: la respuesta no está en UTC.`)
  return arrays[0].map((time, i) => ({
    fila: `${city}:${i}`,
    ciudad: city,
    fecha_hora: utcTime(time) ?? time,
    temperatura_c: arrays[1][i],
    humedad_pct: arrays[2][i],
    precipitacion_mm: arrays[3][i],
  }))
}

export function validationReasons(row: Record<string, unknown>): string[] {
  const reasons: string[] = []
  if (
    typeof row.ciudad !== "string" ||
    !row.ciudad.trim() ||
    row.ciudad.length > 80
  )
    reasons.push("Ciudad ausente o inválida")
  if (!utcTime(row.fecha_hora)) reasons.push("Fecha y hora UTC inválidas")
  for (const [field, label] of [
    ["temperatura_c", "Temperatura"],
    ["humedad_pct", "Humedad"],
    ["precipitacion_mm", "Precipitación"],
  ]) {
    if (!isFiniteNumber(row[field]))
      reasons.push(
        `${label}: se requiere un número finito (no se convierte a cero)`
      )
  }
  if (
    isFiniteNumber(row.humedad_pct) &&
    (row.humedad_pct < 0 || row.humedad_pct > 100)
  )
    reasons.push("Humedad fuera de 0–100 %")
  if (isFiniteNumber(row.precipitacion_mm) && row.precipitacion_mm < 0)
    reasons.push("Precipitación negativa")
  return reasons
}

export function clean(rows: Candidate[]): {
  valid: Measurement[]
  rejected: Rejected[]
} {
  const valid: Measurement[] = [],
    rejected: Rejected[] = [],
    seen = new Set<string>()
  for (const row of rows) {
    const reasons = validationReasons(row)
    if (reasons.length) {
      rejected.push({ ...row, motivo: reasons.join("; ") })
      continue
    }
    const normalized: Measurement = {
      ciudad: (row.ciudad as string).trim(),
      fecha_hora: utcTime(row.fecha_hora)!,
      temperatura_c: row.temperatura_c as number,
      humedad_pct: row.humedad_pct as number,
      precipitacion_mm: row.precipitacion_mm as number,
    }
    const key = keyOf(normalized)
    if (seen.has(key)) {
      rejected.push({
        ...row,
        motivo:
          "Duplicado por ciudad y fecha: se conserva la primera fila válida",
      })
      continue
    }
    seen.add(key)
    valid.push(normalized)
  }
  return { valid, rejected }
}

export function filterError(f: Filters): string | null {
  if ((f.from && !utcTime(f.from)) || (f.to && !utcTime(f.to)))
    return "El intervalo debe contener fechas y horas válidas en UTC."
  if (f.from && f.to && utcTime(f.from)! > utcTime(f.to)!)
    return "El inicio del filtro es posterior al final."
  for (const [min, max, label] of [
    [f.tempMin, f.tempMax, "temperatura"],
    [f.humidityMin, f.humidityMax, "humedad"],
    [f.rainMin, f.rainMax, "precipitación"],
  ]) {
    if (
      (min !== "" && !Number.isFinite(Number(min))) ||
      (max !== "" && !Number.isFinite(Number(max)))
    )
      return `El filtro de ${label} debe ser numérico.`
    if (min !== "" && max !== "" && Number(min) > Number(max))
      return `El mínimo de ${label} supera al máximo.`
  }
  return null
}

export function filterAndSort(
  rows: Measurement[],
  f: Filters,
  field: SortField,
  direction: "asc" | "desc"
): Measurement[] {
  if (filterError(f)) return []
  const between = (v: number, min: string, max: string) =>
    (min === "" || v >= Number(min)) && (max === "" || v <= Number(max))
  return rows
    .filter(
      (r) =>
        (!f.cities.length || f.cities.includes(r.ciudad)) &&
        (!f.from || r.fecha_hora >= utcTime(f.from)!) &&
        (!f.to || r.fecha_hora <= utcTime(f.to)!) &&
        between(r.temperatura_c, f.tempMin, f.tempMax) &&
        between(r.humedad_pct, f.humidityMin, f.humidityMax) &&
        between(r.precipitacion_mm, f.rainMin, f.rainMax) &&
        (!f.rainy || r.precipitacion_mm > 0)
    )
    .sort((a, b) => {
      const av = a[field],
        bv = b[field]
      const order =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "es")
      return (
        (direction === "asc" ? 1 : -1) *
        (order || keyOf(a).localeCompare(keyOf(b)))
      )
    })
}

export function selectedRows(
  filtered: Measurement[],
  selected: ReadonlySet<string>
) {
  return filtered.filter((r) => selected.has(keyOf(r)))
}

export function archiveUrl(
  city: (typeof CITIES)[number],
  start: string,
  end: string
) {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive")
  url.search = new URLSearchParams({
    latitude: String(city.latitude),
    longitude: String(city.longitude),
    start_date: start,
    end_date: end,
    hourly: "temperature_2m,relative_humidity_2m,precipitation",
    timezone: "UTC",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  }).toString()
  return url.toString()
}
