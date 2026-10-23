import { test } from "node:test"
import assert from "node:assert/strict"
import {
  CITIES,
  EMPTY_FILTERS,
  archiveUrl,
  clean,
  filterAndSort,
  keyOf,
  rangeDays,
  selectedRows,
  transform,
  utcTime,
} from "../lib/etl.ts"
import { executeBatches, freezeBatches } from "../lib/batches.ts"
import { upsertAndVerify, validateBatch } from "../lib/supabase-rest.ts"
import { localAccessError } from "../lib/http-security.ts"

// Fixtures exclusivos de pruebas. Nunca se importan en la aplicación.
const measurement = (i = 0) => ({
  ciudad: "Barcelona",
  fecha_hora: new Date(Date.UTC(2026, 8, 1) + i * 3600000).toISOString(),
  temperatura_c: i - 10,
  humedad_pct: 70,
  precipitacion_mm: i % 3 ? 0 : 1,
})
const original = {
  utc_offset_seconds: 0,
  hourly: {
    time: ["2026-09-01T00:00", "2026-09-01T01:00"],
    temperature_2m: [null, 19],
    relative_humidity_2m: [60, 80],
    precipitation: [0, 0.1],
  },
}

test("la extracción solicita las unidades, variables y zona UTC requeridas", () => {
  const url = new URL(archiveUrl(CITIES[0], "2026-09-01", "2026-09-01"))
  assert.equal(url.origin, "https://archive-api.open-meteo.com")
  assert.equal(url.searchParams.get("timezone"), "UTC")
  assert.equal(url.searchParams.get("temperature_unit"), "celsius")
  assert.equal(url.searchParams.get("precipitation_unit"), "mm")
  assert.equal(
    url.searchParams.get("hourly"),
    "temperature_2m,relative_humidity_2m,precipitation"
  )
})
test("rango inclusivo de hasta 31 días y fechas estrictas", () => {
  assert.equal(rangeDays("2026-09-01", "2026-09-30"), 30)
  assert.equal(rangeDays("2026-08-01", "2026-08-31"), 31)
  assert.throws(() => rangeDays("2026-08-01", "2026-09-01"), /31 días/)
  assert.throws(() => rangeDays("2026-02-30", "2026-03-01"), /válidas/)
  assert.throws(() => rangeDays("2026-09-02", "2026-09-01"), /posterior/)
})
test("transforma arrays sin alterar el original ni convertir null en cero", () => {
  const before = structuredClone(original)
  const rows = transform("Barcelona", original)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].fecha_hora, "2026-09-01T00:00:00.000Z")
  assert.equal(rows[0].temperatura_c, null)
  assert.equal(rows[1].precipitacion_mm, 0.1)
  assert.deepEqual(original, before)
  const result = clean(rows)
  assert.equal(result.valid.length, 1)
  assert.equal(result.rejected.length, 1)
  assert.match(result.rejected[0].motivo, /Temperatura/)
})
test("detecta arrays incoherentes y una zona diferente de UTC", () => {
  assert.throws(
    () =>
      transform("Barcelona", {
        ...original,
        hourly: { ...original.hourly, precipitation: [1] },
      }),
    /longitudes/
  )
  assert.throws(
    () => transform("Barcelona", { ...original, utc_offset_seconds: 3600 }),
    /UTC/
  )
  assert.throws(() => transform("Barcelona", {}), /arrays/)
})
test("fechas UTC explícitas, imposibles y fuera de rango", () => {
  assert.equal(utcTime("2026-09-01T02:00"), "2026-09-01T02:00:00.000Z")
  assert.equal(utcTime("2026-09-01T02:00:00+00:00"), "2026-09-01T02:00:00.000Z")
  for (const value of [
    "2026-02-30T00:00",
    "2026-09-01T24:00",
    "2026-09-01T00:99",
    "",
    null,
  ])
    assert.equal(utcTime(value), null)
})
test("rechaza valores ausentes, cadenas vacías, infinitos y rangos; acepta temperatura extrema finita", () => {
  const invalid = [null, undefined, "", "20", NaN, Infinity].map(
    (value, i) => ({ ...measurement(i), fila: String(i), temperatura_c: value })
  )
  const rows = [
    ...invalid,
    { ...measurement(8), fila: "h", humedad_pct: 101 },
    { ...measurement(9), fila: "p", precipitacion_mm: -1 },
    { ...measurement(10), fila: "x", temperatura_c: -150 },
  ]
  const result = clean(rows)
  assert.equal(result.rejected.length, 8)
  assert.equal(result.valid.length, 1)
  assert.equal(result.valid[0].temperatura_c, -150)
})
test("deduplica por clave y conserva la primera fila válida", () => {
  const row = measurement()
  const result = clean([
    { ...row, fila: "0", temperatura_c: null },
    { ...row, fila: "1" },
    { ...row, fila: "2", temperatura_c: 99 },
  ])
  assert.equal(result.valid.length, 1)
  assert.equal(result.valid[0].temperatura_c, row.temperatura_c)
  assert.equal(result.rejected.length, 2)
  assert.match(result.rejected[1].motivo, /primera fila válida/)
})
test("filtra y ordena antes de paginar; mantiene selección entre páginas y fuera de filtros", () => {
  const rows = Array.from({ length: 70 }, (_, i) => measurement(i))
  const sorted = filterAndSort(
    rows,
    { ...EMPTY_FILTERS, tempMin: "0" },
    "temperatura_c",
    "desc"
  )
  assert.equal(sorted.length, 60)
  assert.equal(sorted[0].temperatura_c, 59)
  assert.equal(sorted.slice(25, 50)[0].temperatura_c, 34)
  const selection = new Set([keyOf(sorted[0]), keyOf(sorted[30])])
  assert.deepEqual(selectedRows(sorted, selection), [sorted[0], sorted[30]])
  const restricted = filterAndSort(
    rows,
    { ...EMPTY_FILTERS, tempMax: "30" },
    "fecha_hora",
    "asc"
  )
  assert.equal(selectedRows(restricted, selection).length, 1)
  assert.equal(selection.size, 2)
  const all = new Set(sorted.map(keyOf))
  assert.equal(selectedRows(sorted, all).length, 60)
  assert.equal(
    filterAndSort(rows, { ...EMPTY_FILTERS, rainy: true }, "fecha_hora", "asc")
      .length,
    24
  )
  assert.equal(
    filterAndSort(
      rows,
      { ...EMPTY_FILTERS, from: rows[1].fecha_hora, to: rows[3].fecha_hora },
      "fecha_hora",
      "asc"
    ).length,
    3
  )
  assert.equal(
    filterAndSort(
      rows,
      { ...EMPTY_FILTERS, tempMin: "50", tempMax: "10" },
      "fecha_hora",
      "asc"
    ).length,
    0
  )
})
test("vista previa igual a payload, lotes <=500 y copia independiente de cambios posteriores", async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => measurement(i))
  const preview = selectedRows(
    filterAndSort(rows, EMPTY_FILTERS, "fecha_hora", "desc"),
    new Set(rows.map(keyOf))
  )
  const frozen = freezeBatches(preview)
  assert.deepEqual(
    frozen.map((b) => b.rows.length),
    [500, 500, 1]
  )
  const expected = structuredClone(preview)
  preview[0].temperatura_c = 999
  const sent = []
  await executeBatches(
    frozen,
    async (rows) => {
      sent.push(...rows)
      return { verified: rows.length }
    },
    () => {}
  )
  assert.deepEqual(sent, expected)
})
test("fallo parcial, progreso real y reintento solo de los fallidos", async () => {
  const frozen = freezeBatches(
    Array.from({ length: 1001 }, (_, i) => measurement(i))
  )
  let calls = 0
  const statuses = []
  const first = await executeBatches(
    frozen,
    async (rows) => {
      if (++calls === 2) throw new Error("Fallo controlado")
      return { verified: rows.length }
    },
    (state) => statuses.push(state.map((b) => b.status))
  )
  assert.deepEqual(
    first.map((b) => b.status),
    ["done", "error", "done"]
  )
  assert.ok(statuses.some((s) => s.includes("running")))
  let retried = 0
  const result = await executeBatches(
    first,
    async (rows) => {
      retried++
      return { verified: rows.length }
    },
    () => {}
  )
  assert.equal(retried, 1)
  assert.ok(result.every((b) => b.status === "done"))
})
test("el servidor valida filas, claves duplicadas, columnas y máximo de lote", () => {
  assert.throws(() => validateBatch({ rows: [] }), /entre 1 y 500/)
  assert.throws(
    () =>
      validateBatch({ rows: Array.from({ length: 501 }, () => measurement()) }),
    /entre 1 y 500/
  )
  assert.throws(
    () => validateBatch({ rows: [{ ...measurement(), humedad_pct: null }] }),
    /número finito/
  )
  assert.throws(
    () => validateBatch({ rows: [measurement(), measurement()] }),
    /duplicada/
  )
  const rows = validateBatch({
    rows: [{ ...measurement(), id: 123, importado_en: "inventado" }],
  })
  assert.deepEqual(rows, [measurement()])
})
test("adaptador REST: segunda carga idempotente y consultas por claves en lotes", async () => {
  const store = new Map(),
    config = { url: "https://example.supabase.co", secret: "sb_secret_fixture" }
  const requests = []
  const fetcher = async (url, init) => {
    const u = new URL(url)
    requests.push({ u, init })
    assert.equal(init.headers.apikey, config.secret)
    assert.equal(init.headers.Authorization, undefined)
    if (init.method === "POST") {
      assert.equal(u.searchParams.get("on_conflict"), "ciudad,fecha_hora")
      assert.match(init.headers.Prefer, /merge-duplicates/)
      for (const r of JSON.parse(init.body)) store.set(keyOf(r), r)
      return new Response(null, { status: 201 })
    }
    const keys = [...store.values()]
      .filter((r) =>
        u.searchParams.get("or").includes(JSON.stringify(r.fecha_hora))
      )
      .map((r) => ({
        ciudad: r.ciudad,
        fecha_hora: r.fecha_hora.replace(".000Z", "+00:00"),
      }))
    return Response.json(keys)
  }
  const rows = Array.from({ length: 51 }, (_, i) => measurement(i))
  assert.equal((await upsertAndVerify(config, rows, fetcher)).verified, 51)
  assert.equal((await upsertAndVerify(config, rows, fetcher)).verified, 51)
  assert.equal(store.size, 51)
  assert.equal(requests.filter((r) => r.init.method !== "POST").length, 6)
})
test("una escritura sin verificación completa nunca se informa como exitosa", async () => {
  const fetcher = async (_url, init) =>
    init.method === "POST"
      ? new Response(null, { status: 201 })
      : Response.json([])
  await assert.rejects(
    upsertAndVerify(
      { url: "https://example.supabase.co", secret: "sb_secret_fixture" },
      [measurement()],
      fetcher
    ),
    /solo se verificaron 0/
  )
})
test("acceso local: bloquea producción, host remoto, cross-origin y POST sin origen", () => {
  const request = (url, method = "GET", origin) =>
    new Request(url, { method, headers: origin ? { origin } : {} })
  assert.equal(
    localAccessError(
      request("http://localhost:3000/api/destination"),
      "development"
    ),
    null
  )
  assert.equal(
    localAccessError(
      request(
        "http://localhost:3000/api/load",
        "POST",
        "http://localhost:3000"
      ),
      "development"
    ),
    null
  )
  assert.match(
    localAccessError(
      request("http://localhost:3000/api/load", "POST"),
      "development"
    ),
    /origen/
  )
  assert.match(
    localAccessError(
      request("http://localhost:3000/api/load", "POST", "https://evil.example"),
      "development"
    ),
    /origen/
  )
  assert.match(
    localAccessError(
      request("https://public.example/api/destination"),
      "development"
    ),
    /localhost/
  )
  assert.match(
    localAccessError(
      request("http://localhost:3000/api/destination"),
      "production"
    ),
    /autenticación/
  )
})
