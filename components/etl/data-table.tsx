"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { keyOf, type Measurement } from "@/lib/etl"

export type DisplayRow = {
  ciudad: unknown
  fecha_hora: unknown
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
  motivo?: string
  fila?: string
  importado_en?: string
  id?: number
}
export const PAGE_SIZE = 25
export function display(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "Ausente"
  if (typeof value === "number")
    return value.toLocaleString("es-ES", { maximumFractionDigits: 3 })
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}
export function utcLabel(value: unknown): string {
  return typeof value === "string"
    ? value
        .replace("T", " · ")
        .replace(/:00\.000Z$/, "")
        .replace(/Z$/, "")
    : display(value)
}

export function Pager({
  page,
  total,
  onPage,
}: {
  page: number
  total: number
  onPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return (
    <div className="table-footer">
      <span>
        {total
          ? `${((page - 1) * PAGE_SIZE + 1).toLocaleString("es-ES")}–${Math.min(page * PAGE_SIZE, total).toLocaleString("es-ES")} de ${total.toLocaleString("es-ES")} registros`
          : "0 registros"}{" "}
        <span className="muted">· 25 por página</span>
      </span>
      <div className="inline-actions">
        <Button
          variant="outline"
          size="icon"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Página siguiente"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

export function RowsTable({
  rows,
  selected,
  onToggle,
  empty = "Todavía no hay registros en esta fase.",
  persisted = false,
}: {
  rows: DisplayRow[]
  selected?: ReadonlySet<string>
  onToggle?: (key: string) => void
  empty?: string
  persisted?: boolean
}) {
  if (!rows.length)
    return (
      <div className="empty-state">
        <Table2 size={30} strokeWidth={1.4} />
        <strong>Sin registros</strong>
        <p>{empty}</p>
      </div>
    )
  const rejected = rows.some((r) => r.motivo !== undefined)
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {onToggle && <th className="check-cell">Elegir</th>}
            <th>Ciudad</th>
            <th>
              Fecha y hora <small>UTC</small>
            </th>
            <th className="numeric">
              Temperatura <small>°C</small>
            </th>
            <th className="numeric">
              Humedad <small>%</small>
            </th>
            <th className="numeric">
              Precipitación <small>mm</small>
            </th>
            {rejected && <th>Motivo de rechazo</th>}
            {persisted && (
              <th>
                Importado en <small>UTC</small>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const key = keyOf(row as Measurement)
            return (
              <tr
                key={row.fila ?? `${key}:${i}`}
                data-selected={selected?.has(key) || undefined}
              >
                {onToggle && (
                  <td className="check-cell">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${display(row.ciudad)}, ${display(row.fecha_hora)}`}
                      checked={selected?.has(key) ?? false}
                      onChange={() => onToggle(key)}
                    />
                  </td>
                )}
                <td className="city-cell">{display(row.ciudad)}</td>
                <td className="mono">{utcLabel(row.fecha_hora)}</td>
                <td className="numeric">{display(row.temperatura_c)}</td>
                <td className="numeric">{display(row.humedad_pct)}</td>
                <td className="numeric">{display(row.precipitacion_mm)}</td>
                {rejected && <td className="rejection-reason">{row.motivo}</td>}
                {persisted && (
                  <td className="mono">{utcLabel(row.importado_en)}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function DataTable(props: Parameters<typeof RowsTable>[0]) {
  const [page, setPage] = useState(1)
  const current = Math.min(
    page,
    Math.max(1, Math.ceil(props.rows.length / PAGE_SIZE))
  )
  return (
    <>
      <RowsTable
        {...props}
        rows={props.rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)}
      />
      <Pager page={current} total={props.rows.length} onPage={setPage} />
    </>
  )
}
