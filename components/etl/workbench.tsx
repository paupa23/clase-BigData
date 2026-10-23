"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  Circle,
  CloudSun,
  Database,
  Download,
  FlaskConical,
  LoaderCircle,
  Play,
  RotateCcw,
  Upload,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CITIES,
  EMPTY_FILTERS,
  clean,
  filterAndSort,
  filterError,
  keyOf,
  rangeDays,
  selectedRows,
  transform,
  type Candidate,
  type Filters,
  type Raw,
  type Rejected,
  type SortField,
} from "@/lib/etl"
import { executeBatches, freezeBatches, type Batch } from "@/lib/batches"
import { DataTable } from "./data-table"
import { Destination } from "./destination"
import { FilterPanel } from "./filter-panel"

type Status = "pending" | "running" | "done" | "error"
type Source = {
  city: string
  status: Status
  raw?: Raw
  error?: string
  duration?: number
}
type History = {
  id: number
  city: string
  start: string
  end: string
  raw: Raw
}
type Tab =
  "raw" | "transformed" | "valid" | "rejected" | "preview" | "destination"
type Phase = {
  name: string
  description: string
  status: Status
  input: number
  output: number
  duration: number
  tab: Tab
}
const STATUS = {
  pending: "Pendiente",
  running: "En curso",
  done: "Completada",
  error: "Con errores",
}
const TABS: { id: Tab; label: string }[] = [
  { id: "raw", label: "JSON original" },
  { id: "transformed", label: "Transformados" },
  { id: "valid", label: "Válidos y selección" },
  { id: "rejected", label: "Rechazados" },
  { id: "preview", label: "Vista previa de carga" },
  { id: "destination", label: "Datos en Supabase" },
]
const number = (value: number) => value.toLocaleString("es-ES")
const elapsed = (ms: number) =>
  ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`
function StatusIcon({ status }: { status: Status }) {
  return status === "running" ? (
    <LoaderCircle size={14} className="spin" />
  ) : status === "done" ? (
    <Check size={14} />
  ) : status === "error" ? (
    <XCircle size={14} />
  ) : (
    <Circle size={12} />
  )
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function originalCount(raw: Raw) {
  const h = raw.hourly as Record<string, unknown> | undefined
  return h
    ? Math.max(
        0,
        ...[
          "time",
          "temperature_2m",
          "relative_humidity_2m",
          "precipitation",
        ].map((k) => (Array.isArray(h[k]) ? h[k].length : 0))
      )
    : 0
}

function JsonInspector({ history }: { history: History[] }) {
  const [id, setId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const entry = history.find((h) => h.id === id) ?? history.at(-1)
  if (!entry)
    return (
      <div className="empty-state">
        <Download size={28} />
        <strong>La fuente, sin modificar</strong>
        <p>
          Extrae datos para explorar los JSON originales de Open-Meteo por
          ciudad.
        </p>
      </div>
    )
  const lines = JSON.stringify(entry.raw, null, 2).split("\n")
  const current = Math.min(page, Math.max(0, Math.ceil(lines.length / 80) - 1))
  return (
    <div className="json-inspector">
      <div className="json-toolbar">
        <label>
          Respuesta original
          <select
            aria-label="JSON por ciudad y extracción"
            value={entry.id}
            onChange={(e) => {
              setId(Number(e.target.value))
              setPage(0)
            }}
          >
            {history.map((h) => (
              <option value={h.id} key={h.id}>
                {h.city} · {h.start} → {h.end} · descarga {h.id}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          onClick={() =>
            download(
              `open-meteo-${entry.city}-${entry.start}-${entry.end}.json`,
              entry.raw
            )
          }
        >
          <Download />
          Descargar este JSON
        </Button>
        <Button
          variant="ghost"
          onClick={() => download("open-meteo-originales-sesion.json", history)}
        >
          <Download />
          Todos los originales
        </Button>
      </div>
      <p className="table-note">
        Originales conservados en memoria durante esta sesión, también al
        iniciar otra extracción. Se muestran 80 líneas por página.
      </p>
      <pre tabIndex={0} aria-label={`JSON original de ${entry.city}`}>
        {lines.slice(current * 80, (current + 1) * 80).join("\n")}
      </pre>
      <div className="table-footer">
        <span>
          Líneas {current * 80 + 1}–{Math.min((current + 1) * 80, lines.length)}{" "}
          de {number(lines.length)}
        </span>
        <div className="inline-actions">
          <Button
            variant="outline"
            disabled={!current}
            onClick={() => setPage(current - 1)}
          >
            Anterior
          </Button>
          <span>
            {current + 1} / {Math.ceil(lines.length / 80)}
          </span>
          <Button
            variant="outline"
            disabled={(current + 1) * 80 >= lines.length}
            onClick={() => setPage(current + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}

export function Workbench() {
  const [cities, setCities] = useState<string[]>(CITIES.map((c) => c.name))
  const [start, setStart] = useState("2026-09-01")
  const [end, setEnd] = useState("2026-09-30")
  const [sources, setSources] = useState<Source[]>([])
  const [history, setHistory] = useState<History[]>([])
  const historyId = useRef(0)
  const [period, setPeriod] = useState({ start: "", end: "" })
  const [extracting, setExtracting] = useState(false)
  const extractLock = useRef(false)
  const [extractionDuration, setExtractionDuration] = useState(0)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [quality, setQuality] = useState<ReturnType<typeof clean>>({
    valid: [],
    rejected: [],
  })
  const [structuralErrors, setStructuralErrors] = useState<string[]>([])
  const [timings, setTimings] = useState({ transform: 0, clean: 0 })
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    cities: [],
  })
  const [sort, setSort] = useState<SortField>("fecha_hora")
  const [direction, setDirection] = useState<"asc" | "desc">("asc")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<Tab>("valid")
  const [error, setError] = useState("")
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)
  const loadLock = useRef(false)
  const [loadDuration, setLoadDuration] = useState(0)
  const [completedRun, setCompletedRun] = useState(false)
  const [filterDuration, setFilterDuration] = useState(0)

  let configError = "",
    expected = 0
  try {
    expected = rangeDays(start, end) * 24 * cities.length
    if (!cities.length) configError = "Selecciona al menos una ciudad."
  } catch (e) {
    configError = (e as Error).message
  }
  const filtered = useMemo(
    () => filterAndSort(quality.valid, filters, sort, direction),
    [quality.valid, filters, sort, direction]
  )
  const preview = useMemo(
    () => selectedRows(filtered, selected),
    [filtered, selected]
  )
  const outside = selected.size - preview.length
  const fError = filterError(filters)
  const extracted = sources.reduce(
    (n, s) => n + (s.raw ? originalCount(s.raw) : 0),
    0
  )
  const verified = batches
    .filter((b) => b.status === "done")
    .reduce((n, b) => n + b.verified, 0)
  const failed = batches
    .filter((b) => b.status === "error")
    .reduce((n, b) => n + b.rows.length, 0)
  const frozenRows = batches.flatMap((b) => b.rows)

  function updateFilters(
    next: Filters,
    nextSort = sort,
    nextDirection = direction
  ) {
    const begin = performance.now()
    filterAndSort(quality.valid, next, nextSort, nextDirection)
    setFilterDuration(performance.now() - begin)
    setFilters(next)
    setSort(nextSort)
    setDirection(nextDirection)
  }

  function rebuild(next: Source[]) {
    const begin = performance.now(),
      rows: Candidate[] = [],
      bad: Rejected[] = [],
      errors: string[] = []
    for (const source of next) {
      if (!source.raw) continue
      try {
        rows.push(...transform(source.city, source.raw))
      } catch (e) {
        const reason = (e as Error).message
        errors.push(reason)
        const h = source.raw.hourly as { time?: unknown[] } | undefined
        // No se emparejan arrays incoherentes: se rechaza toda esa respuesta con motivo.
        for (let i = 0; i < originalCount(source.raw); i++)
          bad.push({
            fila: `${source.city}:estructura:${i}`,
            ciudad: source.city,
            fecha_hora: h?.time?.[i],
            temperatura_c: undefined,
            humedad_pct: undefined,
            precipitacion_mm: undefined,
            motivo: reason,
          })
      }
    }
    const transformedAt = performance.now(),
      result = clean(rows)
    setTimings({
      transform: transformedAt - begin,
      clean: performance.now() - transformedAt,
    })
    setCandidates(rows)
    setQuality({ valid: result.valid, rejected: [...result.rejected, ...bad] })
    setStructuralErrors(errors)
    const filteringAt = performance.now()
    filterAndSort(result.valid, filters, sort, direction)
    setFilterDuration(performance.now() - filteringAt)
    const validKeys = new Set(result.valid.map(keyOf))
    setSelected((old) => new Set([...old].filter((key) => validKeys.has(key))))
  }

  async function extract(retry?: string) {
    if (extractLock.current || loadLock.current) return
    if (!retry && configError) {
      setError(configError)
      return
    }
    extractLock.current = true
    setExtracting(true)
    setError("")
    const begin = performance.now()
    const dates = retry ? period : { start, end }
    let next: Source[] = retry
      ? sources.map((s) =>
          s.city === retry ? { city: s.city, status: "pending" } : s
        )
      : cities.map((city) => ({ city, status: "pending" }))
    if (!retry) {
      setPeriod(dates)
      setCandidates([])
      setQuality({ valid: [], rejected: [] })
      setSelected(new Set())
      setStructuralErrors([])
      setCompletedRun(false)
      setTimings({ transform: 0, clean: 0 })
      setExtractionDuration(0)
    }
    setSources(next)
    try {
      for (const source of next.filter((s) => !retry || s.city === retry)) {
        const cityStart = performance.now()
        next = next.map((s) =>
          s.city === source.city ? { ...s, status: "running" } : s
        )
        setSources(next)
        try {
          const response = await fetch(
            `/api/extract?${new URLSearchParams({ city: source.city, start: dates.start, end: dates.end })}`,
            { cache: "no-store" }
          )
          const raw = await response.json()
          if (!response.ok)
            throw new Error(raw.error ?? "La extracción ha fallado.")
          const item = {
            id: ++historyId.current,
            city: source.city,
            ...dates,
            raw,
          }
          setHistory((old) => [...old, item])
          next = next.map((s) =>
            s.city === source.city
              ? {
                  city: s.city,
                  status: "done",
                  raw,
                  duration: performance.now() - cityStart,
                }
              : s
          )
        } catch (e) {
          next = next.map((s) =>
            s.city === source.city
              ? {
                  city: s.city,
                  status: "error",
                  error:
                    e instanceof Error
                      ? e.message
                      : "No se ha podido descargar esta ciudad.",
                  duration: performance.now() - cityStart,
                }
              : s
          )
        }
        setSources(next)
      }
      setExtractionDuration(
        (old) => (retry ? old : 0) + performance.now() - begin
      )
      rebuild(next)
      setCompletedRun(true)
    } finally {
      extractLock.current = false
      setExtracting(false)
    }
  }

  async function load(retry = false) {
    if (
      loadLock.current ||
      extractLock.current ||
      (!retry && (!preview.length || !!fError))
    )
      return
    loadLock.current = true
    setLoading(true)
    setError("")
    const snapshot = retry ? batches : freezeBatches(preview)
    setBatches(snapshot)
    if (!retry) setLoadDuration(0)
    const begin = performance.now()
    try {
      await executeBatches(
        snapshot,
        async (rows) => {
          const response = await fetch("/api/load", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows }),
          })
          const data = await response.json()
          if (!response.ok)
            throw new Error(data.error ?? "La carga del lote ha fallado.")
          return data
        },
        setBatches
      )
    } finally {
      setLoadDuration((old) => (retry ? old : 0) + performance.now() - begin)
      loadLock.current = false
      setLoading(false)
    }
  }

  const phases: Phase[] = [
    {
      name: "Extracción",
      description: "JSON horario por ciudad desde Open-Meteo.",
      status: extracting
        ? "running"
        : !completedRun
          ? "pending"
          : sources.some((s) => s.status === "error")
            ? "error"
            : "done",
      input: 0,
      output: extracted,
      duration: extractionDuration,
      tab: "raw",
    },
    {
      name: "Transformación",
      description: "Arrays paralelos → una fila por ciudad y hora UTC.",
      status:
        !completedRun || extracting
          ? "pending"
          : structuralErrors.length
            ? "error"
            : "done",
      input: extracted,
      output: candidates.length,
      duration: timings.transform,
      tab: "transformed",
    },
    {
      name: "Limpieza",
      description: "Tipos, campos, rangos y claves duplicadas.",
      status: !completedRun || extracting ? "pending" : "done",
      input: extracted,
      output: quality.valid.length,
      duration: timings.clean,
      tab: "rejected",
    },
    {
      name: "Filtrado y selección",
      description: "Filtros → orden → selección entre páginas.",
      status:
        !completedRun || extracting ? "pending" : fError ? "error" : "done",
      input: quality.valid.length,
      output: preview.length,
      duration: filterDuration,
      tab: "valid",
    },
    {
      name: "Carga",
      description: "Upsert de hasta 500 filas y verificación en destino.",
      status: loading
        ? "running"
        : !batches.length
          ? "pending"
          : failed
            ? "error"
            : "done",
      input: frozenRows.length,
      output: verified,
      duration: loadDuration,
      tab: "preview",
    },
  ]

  return (
    <div className="etl-app">
      <header className="app-header">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <CloudSun size={24} />
          </span>
          <span>
            Clima<span className="brand-light">Lab</span>
            <small>LABORATORIO DE DATOS</small>
          </span>
        </Link>
        <div className="header-context">
          <span className="pill">
            <FlaskConical size={13} />
            Práctica 01
          </span>
          <span className="header-divider" />
          <span>Especialización en Big Data</span>
        </div>
        <span className="local-badge">
          <span />
          Entorno local
        </span>
      </header>
      <main className="app-main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">APRENDE CON DATOS REALES</div>
            <h1>
              Tu primer pipeline ETL<span>.</span>
            </h1>
            <p>
              Del dato en bruto a una tabla lista para analizar. Explora cada
              paso del proceso.
            </p>
          </div>
          <a
            className="source-link"
            href="https://open-meteo.com/en/docs/historical-weather-api"
            target="_blank"
            rel="noreferrer"
          >
            Fuente: Open-Meteo <ArrowRight size={14} />
          </a>
        </div>
        <div className="work-layout">
          <aside className="config-card panel">
            <div className="section-heading">
              <span className="step-index">01</span>
              <div>
                <h2>Define la extracción</h2>
                <p>Elige el origen de tus datos</p>
              </div>
            </div>
            <fieldset disabled={extracting || loading}>
              <legend>
                Ciudades <span className="muted">· selección múltiple</span>
              </legend>
              <div className="city-list">
                {CITIES.map((city) => (
                  <label
                    key={city.name}
                    className={`city-option ${cities.includes(city.name) ? "is-checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={cities.includes(city.name)}
                      onChange={(e) =>
                        setCities(
                          e.target.checked
                            ? [...cities, city.name]
                            : cities.filter((c) => c !== city.name)
                        )
                      }
                    />
                    <span>
                      {city.name}
                      <small>
                        {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
                      </small>
                    </span>
                    <span className="city-dot" />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="config-dates">
              <label>
                Fecha inicial
                <input
                  type="date"
                  value={start}
                  disabled={extracting || loading}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Fecha final
                <input
                  type="date"
                  value={end}
                  disabled={extracting || loading}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <span className="field-help">
                Máximo 31 días · ambos extremos incluidos
              </span>
            </div>
            <div className="volume-estimate">
              <span>Volumen previsto</span>
              <strong>
                {number(expected)} <small>registros</small>
              </strong>
              <p>
                {cities.length} ciudades ×{" "}
                {expected && cities.length ? expected / cities.length / 24 : 0}{" "}
                días × 24 horas
              </p>
            </div>
            {configError && (
              <p className="field-error" role="alert">
                {configError}
              </p>
            )}
            <Button
              className="extract-button"
              disabled={!!configError || extracting || loading}
              onClick={() => extract()}
            >
              {extracting ? (
                <LoaderCircle className="spin" />
              ) : (
                <Play size={15} />
              )}
              {extracting ? "Extrayendo datos…" : "Extraer datos"}
            </Button>
            <div className="source-spec">
              <span>RESOLUCIÓN HORARIA</span>
              <p>
                Temperatura <b>°C</b>
                <br />
                Humedad relativa <b>%</b>
                <br />
                Precipitación <b>mm</b>
              </p>
              <div className="utc-badge">Todas las fechas en UTC</div>
            </div>
            {sources.length > 0 && (
              <div className="city-progress" aria-live="polite">
                <strong>
                  {sources.filter((s) => s.status === "done").length} de{" "}
                  {sources.length} ciudades descargadas
                </strong>
                {sources.map((s) => (
                  <div key={s.city}>
                    <div className={`city-progress-line status-${s.status}`}>
                      <StatusIcon status={s.status} />
                      <span>{s.city}</span>
                      <small>
                        {s.status === "done"
                          ? `${number(s.raw ? originalCount(s.raw) : 0)} filas`
                          : STATUS[s.status]}
                      </small>
                    </div>
                    {s.error && (
                      <>
                        <p className="field-error">{s.error}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={extracting || loading}
                          onClick={() => extract(s.city)}
                        >
                          <RotateCcw />
                          Reintentar {s.city}
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
          <div className="workspace">
            <section
              className="pipeline-section"
              aria-labelledby="pipeline-title"
            >
              <div className="section-title-line">
                <div>
                  <h2 id="pipeline-title">El recorrido de tus datos</h2>
                  <p>Cinco fases. Un proceso que puedes inspeccionar.</p>
                </div>
                <span className="small-caption">
                  PULSA UNA FASE PARA EXPLORARLA
                </span>
              </div>
              <div className="pipeline">
                {phases.map((phase, i) => (
                  <button
                    className={`phase-card status-${phase.status}`}
                    key={phase.name}
                    onClick={() => setTab(phase.tab)}
                  >
                    <div className="phase-top">
                      <span className="phase-number">0{i + 1}</span>
                      <span className={`status-label status-${phase.status}`}>
                        <StatusIcon status={phase.status} />
                        {STATUS[phase.status]}
                      </span>
                    </div>
                    <h3>{phase.name}</h3>
                    <p>{phase.description}</p>
                    <div className="phase-counts">
                      <span>
                        <b>{number(phase.input)}</b> entrada
                      </span>
                      <ArrowRight size={13} />
                      <span>
                        <b>{number(phase.output)}</b> salida
                      </span>
                    </div>
                    <div className="phase-duration">
                      {phase.status === "pending"
                        ? "Sin ejecutar"
                        : phase.status === "running"
                          ? "Midiendo duración…"
                          : elapsed(phase.duration)}
                      <span>Inspeccionar ↗</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
            <div className="counter-grid" aria-live="polite">
              {[
                ["Total extraído", extracted, ""],
                ["Válidos", quality.valid.length, "green"],
                ["Rechazados", quality.rejected.length, "red"],
                ["Coinciden con filtros", filtered.length, ""],
                ["Seleccionados para cargar", preview.length, "blue"],
              ].map(([label, count, color]) => (
                <div className={`counter ${color}`} key={label}>
                  <span>{label}</span>
                  <strong>{number(count as number)}</strong>
                </div>
              ))}
            </div>
            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
            {structuralErrors.length > 0 && (
              <div className="error-box" role="alert">
                {structuralErrors.map((message) => (
                  <p key={message}>
                    {message} Las filas afectadas figuran en «Rechazados».
                  </p>
                ))}
              </div>
            )}
            <section
              className="inspection panel"
              aria-labelledby="inspection-title"
            >
              <div className="inspection-heading">
                <div className="section-heading">
                  <span className="step-index">02</span>
                  <div>
                    <h2 id="inspection-title">
                      Inspecciona y prepara la carga
                    </h2>
                    <p>Revisa los datos antes de enviarlos al destino</p>
                  </div>
                </div>
                <span className="pill subtle">
                  <Database size={13} />
                  Supabase
                </span>
              </div>
              <div
                className="tabs"
                role="tablist"
                aria-label="Resultados del pipeline"
              >
                {TABS.map((t) => (
                  <button
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls={`panel-${t.id}`}
                    tabIndex={tab === t.id ? 0 : -1}
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    onKeyDown={(e) => {
                      if (
                        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          e.key
                        )
                      ) {
                        e.preventDefault()
                        const index = TABS.findIndex((v) => v.id === tab)
                        const next =
                          e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? TABS.length - 1
                              : (index +
                                  (e.key === "ArrowRight" ? 1 : -1) +
                                  TABS.length) %
                                TABS.length
                        setTab(TABS[next].id)
                        document.getElementById(`tab-${TABS[next].id}`)?.focus()
                      }
                    }}
                  >
                    {t.label}
                    {t.id === "rejected" && quality.rejected.length > 0 && (
                      <span>{number(quality.rejected.length)}</span>
                    )}
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
              >
                {(tab === "valid" || tab === "preview") && (
                  <>
                    <FilterPanel
                      filters={filters}
                      onChange={updateFilters}
                      sort={sort}
                      direction={direction}
                      onSort={(s, d) => updateFilters(filters, s, d)}
                      error={fError}
                    />
                    <div className="selection-toolbar">
                      <div className="inline-actions">
                        <Button
                          variant="outline"
                          disabled={!filtered.length || extracting}
                          onClick={() =>
                            setSelected(
                              (old) => new Set([...old, ...filtered.map(keyOf)])
                            )
                          }
                        >
                          <CheckCheck />
                          Seleccionar {number(filtered.length)} coincidencias
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={!selected.size}
                          onClick={() => setSelected(new Set())}
                        >
                          Vaciar selección
                        </Button>
                      </div>
                      <span>
                        <strong>{number(preview.length)}</strong> para cargar{" "}
                        <span className="muted">
                          · {number(quality.valid.length - filtered.length)}{" "}
                          excluidos por filtros
                        </span>
                      </span>
                    </div>
                    {outside > 0 && (
                      <p className="warning-box">
                        {number(outside)} filas seleccionadas quedan fuera de
                        los filtros actuales y no se enviarán. La selección no
                        incorpora filas nuevas automáticamente.
                      </p>
                    )}
                  </>
                )}
                {tab === "raw" && <JsonInspector history={history} />}
                {tab === "transformed" && (
                  <>
                    <p className="table-note">
                      Arrays paralelos convertidos en filas. Se conserva null y
                      los valores ausentes; todavía no se ha aplicado la
                      limpieza.
                    </p>
                    <DataTable key="transformed" rows={candidates} />
                  </>
                )}
                {tab === "valid" && (
                  <>
                    <p className="table-note">
                      Registros válidos tras los filtros y la ordenación. La
                      selección se conserva entre páginas. Los descartes por
                      calidad están en «Rechazados».
                    </p>
                    <DataTable
                      key="valid"
                      rows={filtered}
                      selected={selected}
                      onToggle={(key) =>
                        setSelected((old) => {
                          const next = new Set(old)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          return next
                        })
                      }
                      empty={
                        completedRun
                          ? "No hay registros válidos que cumplan los filtros actuales."
                          : "Configura las ciudades y pulsa «Extraer datos» para comenzar."
                      }
                    />
                  </>
                )}
                {tab === "rejected" && (
                  <>
                    <p className="table-note">
                      Descartes por calidad, separados de los filtros. Ante
                      duplicados se conserva la primera fila válida de cada
                      ciudad y hora. No se imponen límites arbitrarios a la
                      temperatura.
                    </p>
                    <DataTable
                      key="rejected"
                      rows={quality.rejected}
                      empty="No se han rechazado registros por calidad."
                    />
                  </>
                )}
                {tab === "preview" && (
                  <>
                    <p className="table-note">
                      <strong>
                        {number(preview.length)} filas en el orden exacto que se
                        enviará al iniciar una nueva carga.
                      </strong>{" "}
                      Válidos → filtros → ordenación → selección → carga. La
                      base de datos no conserva el orden de inserción: las
                      consultas posteriores necesitan ORDER BY.
                    </p>
                    <DataTable
                      key="preview"
                      rows={preview}
                      empty="Selecciona filas válidas para preparar la carga."
                    />
                  </>
                )}
                {tab === "destination" && <Destination />}
              </div>
              {tab !== "destination" && (
                <div className="load-bar">
                  <div>
                    <strong>
                      {number(preview.length)} registros preparados
                    </strong>
                    <p>
                      Solo se enviarán las filas seleccionadas que cumplen los
                      filtros actuales.
                    </p>
                  </div>
                  {tab !== "preview" ? (
                    <Button variant="outline" onClick={() => setTab("preview")}>
                      <ArrowRight />
                      Revisar vista previa
                    </Button>
                  ) : (
                    <Button
                      disabled={
                        !preview.length || !!fError || loading || extracting
                      }
                      onClick={() => load()}
                    >
                      <Upload />
                      {loading
                        ? "Carga en curso…"
                        : `Subir ${number(preview.length)} registros a Supabase`}
                    </Button>
                  )}
                </div>
              )}
            </section>
            {batches.length > 0 && (
              <section className="load-report panel" aria-live="polite">
                <div className="section-title-line">
                  <div>
                    <h2>
                      {loading
                        ? "Carga y verificación en curso"
                        : "Informe de la última carga"}
                    </h2>
                    <p>
                      Copia congelada de {number(frozenRows.length)} filas. Los
                      filtros posteriores no modifican estos lotes.
                    </p>
                  </div>
                  {failed > 0 && (
                    <Button
                      variant="outline"
                      disabled={loading || extracting}
                      onClick={() => load(true)}
                    >
                      <RotateCcw />
                      Reintentar solo los fallidos
                    </Button>
                  )}
                </div>
                <div className="report-totals">
                  <span>
                    <strong>{number(verified)}</strong> procesados y verificados
                  </span>
                  <span>
                    <strong>{number(failed)}</strong> fallidos o sin verificar
                  </span>
                  <span>
                    <strong>
                      {number(frozenRows.length - verified - failed)}
                    </strong>{" "}
                    pendientes / en curso
                  </span>
                </div>
                <p className="table-note">
                  El upsert no distingue cuántos registros se insertaron o
                  actualizaron. Si la escritura se completó pero falló su
                  verificación, se muestra como fallo y se puede reintentar sin
                  duplicar.
                </p>
                <div className="batch-list">
                  {batches.map((b) => (
                    <div className={`batch status-${b.status}`} key={b.id}>
                      <span>
                        <StatusIcon status={b.status} />
                        <strong>Lote {b.id}</strong> · {number(b.rows.length)}{" "}
                        filas · {STATUS[b.status]}{" "}
                        {b.duration > 0 && `· ${elapsed(b.duration)}`}
                      </span>
                      {b.error && <p role="alert">{b.error}</p>}
                    </div>
                  ))}
                </div>
                <details>
                  <summary>Inspeccionar la copia congelada enviada</summary>
                  <DataTable
                    key={
                      batches[0]?.rows[0]
                        ? keyOf(batches[0].rows[0])
                        : "snapshot"
                    }
                    rows={frozenRows}
                  />
                </details>
              </section>
            )}
            <div className="learning-note">
              <span>
                <ArrowDownToLine size={18} />
              </span>
              <p>
                <strong>Un pipeline, paso a paso.</strong> Extraer obtiene el
                origen; transformar cambia su estructura; limpiar valida su
                calidad. Tú decides qué se carga.
              </p>
            </div>
          </div>
        </div>
        <footer className="app-footer">
          <span>ClimaLab · Primera práctica de Big Data</span>
          <span>
            Datos:{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>{" "}
            · Reanálisis meteorológico ·{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0
            </a>
          </span>
        </footer>
      </main>
    </div>
  )
}
