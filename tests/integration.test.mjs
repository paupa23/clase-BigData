import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { CITIES, archiveUrl, clean, transform } from "../lib/etl.ts"
import { databaseRequest, upsertAndVerify } from "../lib/supabase-rest.ts"

const require = createRequire(import.meta.url)
require("@next/env").loadEnvConfig(process.cwd(), true)

test("Open-Meteo real: un día de Barcelona, 24 filas válidas en UTC", async () => {
  const response = await fetch(
    archiveUrl(CITIES[0], "2026-09-01", "2026-09-01"),
    { signal: AbortSignal.timeout(45000) }
  )
  assert.equal(response.status, 200)
  const { valid, rejected } = clean(
    transform("Barcelona", await response.json())
  )
  assert.equal(valid.length, 24)
  assert.equal(rejected.length, 0)
  assert.equal(valid[0].fecha_hora, "2026-09-01T00:00:00.000Z")
  assert.equal(valid[23].fecha_hora, "2026-09-01T23:00:00.000Z")
})

const secret =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
test(
  "Supabase real: dos upserts y verificación sin duplicados (solo datos meteorológicos reales)",
  {
    skip: !secret
      ? "Falta clave secreta de servidor; integración de destino pendiente."
      : false,
  },
  async () => {
    const config = {
      url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      secret,
    }
    const response = await fetch(
      archiveUrl(CITIES[0], "2026-09-01", "2026-09-01")
    )
    assert.ok(response.ok)
    const rows = clean(transform("Barcelona", await response.json())).valid
    assert.equal(rows.length, 24)
    assert.equal((await upsertAndVerify(config, rows)).verified, 24)
    assert.equal((await upsertAndVerify(config, rows)).verified, 24)
    const read = await databaseRequest(
      config,
      new URLSearchParams({
        select: "ciudad,fecha_hora",
        ciudad: "eq.Barcelona",
        fecha_hora: "gte.2026-09-01T00:00:00Z",
        and: "(fecha_hora.lt.2026-09-02T00:00:00Z)",
      })
    )
    const stored = await read.json()
    assert.equal(stored.length, 24)
  }
)
