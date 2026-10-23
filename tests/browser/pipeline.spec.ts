import { expect, test, type Page } from "@playwright/test"

// Respuestas controladas de navegador: solo en pruebas; no se escriben en Supabase.
function fixture(hours: number, defects = false) {
  const time = Array.from({ length: hours }, (_, i) =>
    new Date(Date.UTC(2026, 8, 1) + i * 3600000).toISOString().slice(0, 16)
  )
  const temperature = time.map((_, i) => 10 + (i % 30))
  const humidity = time.map(() => 70),
    rain = time.map((_, i) => (i % 3 === 0 ? 1 : 0))
  if (defects) {
    time.push(time[0], "2026-09-30T23:00")
    temperature.push(20, NaN)
    humidity.push(70, 70)
    rain.push(0, 0)
  }
  return {
    utc_offset_seconds: 0,
    hourly: {
      time,
      temperature_2m: temperature,
      relative_humidity_2m: humidity,
      precipitation: rain,
    },
  }
}
async function chooseCities(page: Page, cities: string[]) {
  for (const name of ["Barcelona", "Madrid", "Sevilla", "Bilbao", "Valencia"])
    await page
      .locator(".config-card")
      .getByRole("checkbox", { name: new RegExp(`^${name}`) })
      .setChecked(cities.includes(name))
}

test("flujo real: una ciudad, un día, 24 filas UTC y descarga del original", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await chooseCities(page, ["Barcelona"])
  await page.getByLabel("Fecha final", { exact: true }).fill("2026-09-01")
  await page.getByRole("button", { name: "Extraer datos", exact: true }).click()
  await expect(
    page
      .locator(".counter")
      .filter({ hasText: "Total extraído" })
      .locator("strong")
  ).toHaveText("24", { timeout: 55000 })
  await expect(page.locator("tbody tr")).toHaveCount(24)
  await expect(page.locator("tbody tr").first()).toContainText(
    "2026-09-01 · 00:00"
  )
  await expect(page.locator(".phase-card").nth(0)).toContainText("Completada")
  await page.getByRole("tab", { name: "JSON original", exact: true }).click()
  const downloaded = page.waitForEvent("download")
  await page.getByRole("button", { name: "Descargar este JSON" }).click()
  expect((await downloaded).suggestedFilename()).toBe(
    "open-meteo-Barcelona-2026-09-01-2026-09-01.json"
  )
  expect(errors).toEqual([])
})

test("selección entre páginas, filtros, nulos y vista previa igual al payload", async ({
  page,
}) => {
  await page.route("**/api/extract?**", (route) =>
    route.fulfill({ json: fixture(72, true) })
  )
  const sent: unknown[][] = []
  await page.route("**/api/load", async (route) => {
    const rows = route.request().postDataJSON().rows
    sent.push(rows)
    await route.fulfill({ json: { verified: rows.length } })
  })
  await page.goto("/")
  await chooseCities(page, ["Barcelona"])
  await page.getByLabel("Fecha final", { exact: true }).fill("2026-09-03")
  await page.getByRole("button", { name: "Extraer datos", exact: true }).click()
  await expect(
    page.locator(".counter").filter({ hasText: "Rechazados" }).locator("strong")
  ).toHaveText("2")
  await page.locator("tbody input[type=checkbox]").first().check()
  await page
    .getByRole("button", { name: "Página siguiente", exact: true })
    .click()
  await page.locator("tbody input[type=checkbox]").first().check()
  await expect(
    page
      .locator(".counter")
      .filter({ hasText: "Seleccionados para cargar" })
      .locator("strong")
  ).toHaveText("2")
  await page
    .getByRole("button", { name: "Seleccionar 72 coincidencias" })
    .click()
  await page.getByLabel("Temperatura (°C) mínima", { exact: true }).fill("30")
  await expect(page.locator(".warning-box")).toContainText(
    "fuera de los filtros"
  )
  await page
    .getByRole("tab", { name: "Vista previa de carga", exact: true })
    .click()
  const count = Number(
    await page
      .locator(".counter")
      .filter({ hasText: "Seleccionados para cargar" })
      .locator("strong")
      .textContent()
  )
  await expect(page.locator("tbody tr")).toHaveCount(count)
  const previewCities = await page.locator("tbody .city-cell").allTextContents()
  const previewTemps = await page
    .locator("tbody tr td:nth-child(3)")
    .allTextContents()
  await page
    .getByRole("button", { name: new RegExp(`^Subir ${count} registros`) })
    .click()
  await expect(page.locator(".load-report")).toContainText(
    `${count} procesados y verificados`
  )
  expect(sent).toHaveLength(1)
  expect(sent[0].map((row) => (row as { ciudad: string }).ciudad)).toEqual(
    previewCities
  )
  expect(
    sent[0].map((row) =>
      String((row as { temperatura_c: number }).temperatura_c)
    )
  ).toEqual(previewTemps)
  await page.getByRole("button", { name: "Vaciar selección" }).click()
  await page.getByRole("button", { name: "Restablecer filtros" }).click()
  await expect(
    page
      .locator(".counter")
      .filter({ hasText: "Seleccionados para cargar" })
      .locator("strong")
  ).toHaveText("0")
})

test("un fallo de descarga permite reintentar solo esa ciudad sin duplicar", async ({
  page,
}) => {
  const calls = { Barcelona: 0, Madrid: 0 }
  await page.route("**/api/extract?**", async (route) => {
    const city = new URL(route.request().url()).searchParams.get(
      "city"
    ) as keyof typeof calls
    calls[city]++
    await route.fulfill(
      city === "Madrid" && calls.Madrid === 1
        ? { status: 502, json: { error: "Fallo de red controlado" } }
        : { json: fixture(24) }
    )
  })
  await page.goto("/")
  await chooseCities(page, ["Barcelona", "Madrid"])
  await page.getByLabel("Fecha final", { exact: true }).fill("2026-09-01")
  await page.getByRole("button", { name: "Extraer datos", exact: true }).click()
  await page
    .getByRole("button", { name: "Reintentar Madrid", exact: true })
    .click()
  await expect(
    page.locator(".counter").filter({ hasText: "Válidos" }).locator("strong")
  ).toHaveText("48")
  expect(calls).toEqual({ Barcelona: 1, Madrid: 2 })
})

test("copia congelada, fallo parcial de carga y reintento únicamente del lote fallido", async ({
  page,
}) => {
  await page.route("**/api/extract?**", (route) =>
    route.fulfill({ json: fixture(720) })
  )
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const payloads: unknown[][] = []
  await page.route("**/api/load", async (route) => {
    const rows = route.request().postDataJSON().rows
    payloads.push(rows)
    if (payloads.length === 1) await gate
    await route.fulfill(
      payloads.length === 2
        ? { status: 502, json: { error: "Fallo controlado del segundo lote" } }
        : { json: { verified: rows.length } }
    )
  })
  await page.goto("/")
  await chooseCities(page, ["Barcelona"])
  await page.getByRole("button", { name: "Extraer datos", exact: true }).click()
  await page
    .getByRole("button", { name: "Seleccionar 720 coincidencias" })
    .click()
  await page
    .getByRole("tab", { name: "Vista previa de carga", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Subir 720 registros a Supabase" })
    .click()
  await expect(page.locator(".batch").first()).toContainText("En curso")
  await page.getByLabel("Temperatura (°C) mínima", { exact: true }).fill("999")
  await expect(
    page
      .locator(".counter")
      .filter({ hasText: "Seleccionados para cargar" })
      .locator("strong")
  ).toHaveText("0")
  release()
  await expect(page.locator(".load-report")).toContainText(
    "220 fallidos o sin verificar"
  )
  await page
    .getByRole("button", { name: "Reintentar solo los fallidos" })
    .click()
  await expect(page.locator(".load-report")).toContainText(
    "720 procesados y verificados"
  )
  expect(payloads.map((rows) => rows.length)).toEqual([500, 220, 220])
  expect(payloads[2]).toEqual(payloads[1])
})

test("validaciones reales de servidor y consulta del destino sin credenciales", async ({
  request,
}) => {
  const bad = await request.get(
    "/api/extract?city=Barcelona&start=2026-08-01&end=2026-09-30"
  )
  expect(bad.status()).toBe(400)
  const missingOrigin = await request.post("/api/load", { data: { rows: [] } })
  expect(missingOrigin.status()).toBe(403)
  const invalid = await request.post("/api/load", {
    headers: { origin: "http://localhost:3000" },
    data: { rows: [] },
  })
  expect(invalid.status()).toBe(400)
  const oversize = await request.post("/api/load", {
    headers: { origin: "http://localhost:3000" },
    data: { padding: "x".repeat(160001) },
  })
  expect(oversize.status()).toBe(413)
})

test("pantalla móvil sin desbordamiento de la página", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Tu primer pipeline ETL." })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
})

test("consulta del destino: paginación, filtros y orden enviados al servidor", async ({
  page,
}) => {
  const queries: URLSearchParams[] = []
  await page.route("**/api/destination?**", async (route) => {
    const query = new URL(route.request().url()).searchParams
    queries.push(query)
    const count = query.get("page") === "2" ? 5 : 25
    await route.fulfill({
      json: {
        rows: Array.from({ length: count }, (_, i) => ({
          id: i + 1,
          ciudad: query.get("city") || "Barcelona",
          fecha_hora: "2026-09-02T00:00:00+00:00",
          temperatura_c: 20,
          humedad_pct: 70,
          precipitacion_mm: 0,
          importado_en: "2026-10-23T09:00:00+00:00",
        })),
        total: 30,
        page: Number(query.get("page")),
      },
    })
  })
  await page.goto("/")
  await page
    .getByRole("tab", { name: "Datos en Supabase", exact: true })
    .click()
  await page.getByRole("button", { name: "Actualizar", exact: true }).click()
  await expect(page.locator("tbody tr")).toHaveCount(25)
  await page
    .getByRole("button", { name: "Página siguiente", exact: true })
    .click()
  await expect(page.locator("tbody tr")).toHaveCount(5)
  await page
    .locator(".destination-filters")
    .getByLabel("Ciudad", { exact: true })
    .selectOption("Madrid")
  await page.getByLabel("Desde (UTC)", { exact: true }).fill("2026-09-02")
  await page
    .getByLabel("Ordenar por", { exact: true })
    .selectOption("temperatura_c")
  await page.getByRole("button", { name: "Actualizar", exact: true }).click()
  await expect(page.locator("tbody tr")).toHaveCount(25)
  expect(queries.map((q) => q.get("page"))).toEqual(["1", "2", "1"])
  expect(queries.at(-1)?.get("city")).toBe("Madrid")
  expect(queries.at(-1)?.get("from")).toBe("2026-09-02")
  expect(queries.at(-1)?.get("sort")).toBe("temperatura_c")
  expect(queries.at(-1)?.get("direction")).toBe("desc")
})
