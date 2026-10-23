"use client"

import { useRef, useState } from "react"
import { Database, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CITIES, SORT_FIELDS } from "@/lib/etl"
import { Pager, RowsTable, type DisplayRow } from "./data-table"

const labels = [
  "Ciudad",
  "Fecha y hora",
  "Temperatura",
  "Humedad",
  "Precipitación",
]
export function Destination() {
  const [city, setCity] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [sort, setSort] = useState("fecha_hora")
  const [direction, setDirection] = useState("desc")
  const [result, setResult] = useState<{
    rows: DisplayRow[]
    total: number
    page: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [queried, setQueried] = useState(false)
  const lock = useRef(false)
  async function query(page = 1) {
    if (lock.current) return
    lock.current = true
    setLoading(true)
    setError("")
    try {
      const response = await fetch(
        `/api/destination?${new URLSearchParams({ city, from, to, sort, direction, page: String(page) })}`,
        { cache: "no-store" }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setResult(data)
      setQueried(true)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo consultar Supabase."
      )
      setResult(null)
    } finally {
      lock.current = false
      setLoading(false)
    }
  }
  function change(action: () => void) {
    action()
    setResult(null)
    setQueried(false)
    setError("")
  }
  return (
    <div>
      <div className="destination-note">
        <Database size={18} />
        <span>
          <strong>Datos persistidos</strong> · Consulta real a Supabase. Los
          registros locales pendientes no aparecen aquí.
        </span>
      </div>
      <div className="destination-filters">
        <label htmlFor="destination-city">
          Ciudad
          <select
            id="destination-city"
            aria-label="Ciudad"
            value={city}
            disabled={loading}
            onChange={(e) => change(() => setCity(e.target.value))}
          >
            <option value="">Todas las ciudades</option>
            {CITIES.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <label htmlFor="destination-from">
          Desde (UTC)
          <input
            id="destination-from"
            type="date"
            value={from}
            disabled={loading}
            onChange={(e) => change(() => setFrom(e.target.value))}
          />
        </label>
        <label htmlFor="destination-to">
          Hasta (UTC)
          <input
            id="destination-to"
            type="date"
            value={to}
            disabled={loading}
            onChange={(e) => change(() => setTo(e.target.value))}
          />
        </label>
        <label htmlFor="destination-sort">
          Ordenar por
          <select
            id="destination-sort"
            aria-label="Ordenar por"
            value={sort}
            disabled={loading}
            onChange={(e) => change(() => setSort(e.target.value))}
          >
            {SORT_FIELDS.map((s, i) => (
              <option key={s} value={s}>
                {labels[i]}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="destination-direction">
          Dirección
          <select
            id="destination-direction"
            aria-label="Dirección"
            value={direction}
            disabled={loading}
            onChange={(e) => change(() => setDirection(e.target.value))}
          >
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
        </label>
        <Button disabled={loading} onClick={() => query()}>
          <RefreshCw className={loading ? "spin" : ""} />
          {loading ? "Consultando…" : "Actualizar"}
        </Button>
      </div>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {!queried && !error && (
        <p className="info-box">
          Pulsa «Actualizar» para consultar el destino con los filtros
          indicados.
        </p>
      )}
      {result && (
        <>
          <RowsTable
            rows={result.rows}
            persisted
            empty="No hay datos persistidos que cumplan estos filtros."
          />
          <Pager page={result.page} total={result.total} onPage={query} />
        </>
      )}
    </div>
  )
}
