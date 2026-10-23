"use client"

import { RotateCcw, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CITIES,
  EMPTY_FILTERS,
  SORT_FIELDS,
  type Filters,
  type SortField,
} from "@/lib/etl"

export const SORT_LABELS = [
  "Ciudad",
  "Fecha y hora",
  "Temperatura",
  "Humedad",
  "Precipitación",
]
export function FilterPanel({
  filters,
  onChange,
  sort,
  direction,
  onSort,
  error,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  sort: SortField
  direction: "asc" | "desc"
  onSort: (s: SortField, d: "asc" | "desc") => void
  error: string | null
}) {
  const set = (key: keyof Filters, value: string | boolean | string[]) =>
    onChange({ ...filters, [key]: value })
  return (
    <details className="filter-panel" open>
      <summary>
        <span>
          <SlidersHorizontal size={16} /> Filtrar, ordenar y seleccionar
        </span>
        <span className="muted">Se aplica antes de paginar</span>
      </summary>
      <div className="filter-content">
        <div className="filter-city-row">
          <span className="field-caption">
            Ciudades · ninguna marcada = todas
          </span>
          <div className="city-options">
            {CITIES.map((c) => (
              <label className="filter-chip" key={c.name}>
                <input
                  type="checkbox"
                  checked={filters.cities.includes(c.name)}
                  onChange={(e) =>
                    set(
                      "cities",
                      e.target.checked
                        ? [...filters.cities, c.name]
                        : filters.cities.filter((n) => n !== c.name)
                    )
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
        <div className="filter-grid">
          <label>
            Desde · fecha y hora UTC
            <input
              type="datetime-local"
              value={filters.from}
              onChange={(e) => set("from", e.target.value)}
            />
          </label>
          <label>
            Hasta · fecha y hora UTC
            <input
              type="datetime-local"
              value={filters.to}
              onChange={(e) => set("to", e.target.value)}
            />
          </label>
          {[
            ["Temperatura (°C)", "tempMin", "tempMax"],
            ["Humedad (%)", "humidityMin", "humidityMax"],
            ["Precipitación (mm)", "rainMin", "rainMax"],
          ].map(([label, min, max]) => (
            <fieldset key={min}>
              <legend>{label}</legend>
              <div className="range-inputs">
                <input
                  type="number"
                  step="any"
                  aria-label={`${label} mínima`}
                  placeholder="Mínima"
                  value={filters[min as keyof Filters] as string}
                  onChange={(e) => set(min as keyof Filters, e.target.value)}
                />
                <span>—</span>
                <input
                  type="number"
                  step="any"
                  aria-label={`${label} máxima`}
                  placeholder="Máxima"
                  value={filters[max as keyof Filters] as string}
                  onChange={(e) => set(max as keyof Filters, e.target.value)}
                />
              </div>
            </fieldset>
          ))}
        </div>
        <div className="filter-bottom">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.rainy}
              onChange={(e) => set("rainy", e.target.checked)}
            />
            Solo registros con lluvia <span className="muted">(&gt; 0 mm)</span>
          </label>
          <div className="inline-actions">
            <label className="sr-only" htmlFor="local-sort">
              Ordenar registros
            </label>
            <select
              id="local-sort"
              value={sort}
              onChange={(e) => onSort(e.target.value as SortField, direction)}
            >
              {SORT_FIELDS.map((s, i) => (
                <option key={s} value={s}>
                  {SORT_LABELS[i]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="local-direction">
              Dirección del orden
            </label>
            <select
              id="local-direction"
              value={direction}
              onChange={(e) => onSort(sort, e.target.value as "asc" | "desc")}
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
            <Button
              variant="ghost"
              onClick={() => onChange({ ...EMPTY_FILTERS, cities: [] })}
            >
              <RotateCcw />
              Restablecer filtros
            </Button>
          </div>
        </div>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
      </div>
    </details>
  )
}
