"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleDot,
  Compass,
  Flame,
  Globe2,
  Layers3,
  Orbit,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  Sector,
  type RadialBarSectorProps,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  {
    browser: "chrome",
    label: "Chrome",
    visitors: 275,
    color: "#d5f879",
    icon: CircleDot,
  },
  {
    browser: "safari",
    label: "Safari",
    visitors: 200,
    color: "#98a8ff",
    icon: Compass,
  },
  {
    browser: "firefox",
    label: "Firefox",
    visitors: 187,
    color: "#f3a477",
    icon: Flame,
  },
  {
    browser: "edge",
    label: "Edge",
    visitors: 173,
    color: "#74d6cd",
    icon: Globe2,
  },
  {
    browser: "other",
    label: "Otros",
    visitors: 90,
    color: "#db9bd4",
    icon: Layers3,
  },
]
const totalVisitors = chartData.reduce(
  (total, item) => total + item.visitors,
  0
)
const radialData = [...chartData].reverse().map((item) => ({
  ...item,
  fill: `var(--color-${item.browser})`,
}))
const chartConfig = Object.fromEntries([
  ["visitors", { label: "Visitantes" }],
  ...chartData.map((item) => [
    item.browser,
    { label: item.label, color: item.color },
  ]),
]) satisfies ChartConfig
const percent = (value: number) =>
  `${((value / totalVisitors) * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)
  const previous = useRef(0)

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const from = previous.current
    const start = performance.now()
    let frame: number
    function tick(now: number) {
      const progress = reducedMotion ? 1 : Math.min((now - start) / 1000, 1)
      const next = Math.round(from + (value - from) * (1 - (1 - progress) ** 3))
      previous.current = next
      setDisplay(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <>{display.toLocaleString("es-ES")}</>
}

export function ChartRadialLabel() {
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [replay, setReplay] = useState(0)
  const panelRef = useRef<HTMLElement>(null)
  const active = hovered ?? selected
  const activeBrowser = chartData.find((item) => item.browser === active)

  function renderSector(props: RadialBarSectorProps) {
    const browser = radialData[props.index]?.browser
    return (
      <Sector
        {...props}
        className="orbit-sector"
        opacity={!active || active === browser ? 1 : 0.18}
        cornerRadius={12}
      />
    )
  }

  return (
    <main className="orbit-shell">
      <div className="orbit-ambient" aria-hidden="true" />
      <div className="orbit-container">
        <header className="orbit-nav">
          <a href="/dashboard" className="orbit-brand" aria-label="Orbit, inicio">
            <span className="orbit-brand-icon">
              <Orbit size={24} strokeWidth={1.6} />
            </span>
            orbit
            <span className="orbit-brand-divider" />
            <span className="orbit-brand-caption">analytics</span>
          </a>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/todos"
              className="flex items-center gap-1 text-[11px] text-[#afb3be] transition-colors hover:text-[#d5f879]"
            >
              Mis tareas <ArrowUpRight size={13} />
            </Link>
            <span className="orbit-demo">
              <span /> Datos de ejemplo
            </span>
          </div>
        </header>

        <section className="orbit-hero orbit-reveal">
          <div>
            <p className="orbit-eyebrow">
              <span /> UNA NUEVA PERSPECTIVA
            </p>
            <h1>
              Tu audiencia,
              <br />
              <span>en otra órbita.</span>
            </h1>
            <p className="orbit-subtitle">
              Cada visita cuenta. Descubre quién está al otro lado.
            </p>
          </div>
          <div className="orbit-period">
            <CalendarDays size={17} />
            <div>
              <span>PERIODO DEL INFORME</span>
              <p>Enero — Junio 2024</p>
            </div>
          </div>
        </section>

        <section
          className="orbit-stats orbit-reveal"
          aria-label="Resumen de visitas"
        >
          <article className="orbit-stat">
            <div className="orbit-stat-label">
              <Users size={16} /> Visitantes totales
            </div>
            <div className="orbit-stat-bottom">
              <strong>
                <AnimatedNumber value={totalVisitors} />
              </strong>
              <span className="orbit-stat-note">en 6 meses</span>
            </div>
          </article>
          <article className="orbit-stat">
            <div className="orbit-stat-label">
              <TrendingUp size={16} /> Crecimiento mensual
            </div>
            <div className="orbit-stat-bottom">
              <strong>
                +5,2<span>%</span>
              </strong>
              <span className="orbit-trend">
                <ArrowUpRight size={16} /> En ascenso
              </span>
            </div>
          </article>
          <article className="orbit-stat">
            <div className="orbit-stat-label">
              <CircleDot size={16} /> Navegador favorito
            </div>
            <div className="orbit-stat-bottom">
              <strong className="orbit-stat-browser">Chrome</strong>
              <span className="orbit-stat-note">{percent(275)} del total</span>
            </div>
          </article>
        </section>

        <section
          ref={panelRef}
          className="orbit-panel orbit-reveal"
          aria-labelledby="audience-title"
          onPointerMove={(event) => {
            if (event.pointerType !== "mouse") return
            const panel = panelRef.current
            if (!panel) return
            const bounds = panel.getBoundingClientRect()
            panel.style.setProperty(
              "--spot-x",
              `${event.clientX - bounds.left}px`
            )
            panel.style.setProperty(
              "--spot-y",
              `${event.clientY - bounds.top}px`
            )
          }}
        >
          <div className="orbit-panel-top">
            <div>
              <p className="orbit-eyebrow">EXPLORA TUS DATOS</p>
              <h2 id="audience-title">Un universo de visitantes</h2>
            </div>
            <button
              type="button"
              className="orbit-replay"
              onClick={() => {
                setReplay((value) => value + 1)
                setSelected(null)
                setHovered(null)
              }}
              aria-label="Repetir la animación del gráfico"
              title="Repetir animación"
            >
              <RotateCcw size={16} />
              <span>Repetir</span>
            </button>
          </div>

          <div className="orbit-panel-grid">
            <div className="orbit-chart-column">
              <div className="orbit-chart-wrap">
                <div className="orbit-chart-halo" aria-hidden="true" />
                <ChartContainer
                  config={chartConfig}
                  className="orbit-chart"
                  initialDimension={{ width: 400, height: 400 }}
                >
                  <RadialBarChart
                    key={replay}
                    data={radialData}
                    startAngle={90}
                    endAngle={-270}
                    innerRadius="43%"
                    outerRadius="94%"
                    barSize={15}
                  >
                    <PolarAngleAxis
                      type="number"
                      domain={[0, 300]}
                      tick={false}
                      axisLine={false}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          hideLabel
                          nameKey="browser"
                          className="border-white/10 bg-[#191d24] text-white shadow-xl"
                        />
                      }
                    />
                    <RadialBar
                      dataKey="visitors"
                      background={{ fill: "#252932" }}
                      cornerRadius={12}
                      shape={renderSector}
                      activeShape={renderSector}
                      animationDuration={1500}
                      animationEasing="ease-out"
                      onMouseEnter={(_, index) =>
                        setHovered(radialData[index].browser)
                      }
                      onMouseLeave={() => setHovered(null)}
                    />
                  </RadialBarChart>
                </ChartContainer>
                <div className="orbit-chart-center" aria-hidden="true">
                  <span
                    className="orbit-center-dot"
                    style={{ background: activeBrowser?.color ?? "#d5f879" }}
                  />
                  <strong style={{ color: activeBrowser?.color }}>
                    <AnimatedNumber
                      value={activeBrowser?.visitors ?? totalVisitors}
                    />
                  </strong>
                  <span>{activeBrowser?.label ?? "visitantes"}</span>
                  <small>
                    {activeBrowser
                      ? percent(activeBrowser.visitors) + " del total"
                      : "EN TOTAL"}
                  </small>
                </div>
              </div>
              <p className="orbit-chart-hint">
                <span /> Cinco navegadores. Una visión completa.
              </p>
            </div>

            <div className="orbit-breakdown">
              <div className="orbit-list-heading">
                <span>NAVEGADOR</span>
                <span>VISITAS / CUOTA</span>
              </div>
              <div className="orbit-browser-list">
                {chartData.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.browser}
                      type="button"
                      className="orbit-browser-row"
                      data-active={active === item.browser}
                      data-muted={Boolean(active && active !== item.browser)}
                      aria-pressed={selected === item.browser}
                      aria-label={`${item.label}: ${item.visitors} visitas, ${percent(item.visitors)}. Resaltar navegador.`}
                      onClick={() =>
                        setSelected(
                          selected === item.browser ? null : item.browser
                        )
                      }
                      onMouseEnter={() => setHovered(item.browser)}
                      onMouseLeave={() => setHovered(null)}
                      style={
                        {
                          "--browser-color": item.color,
                          "--row-delay": `${index * 90 + 350}ms`,
                        } as CSSProperties
                      }
                    >
                      <span className="orbit-browser-icon">
                        <Icon size={19} strokeWidth={1.7} />
                      </span>
                      <span className="orbit-browser-info">
                        <span>
                          {item.label}
                          {index === 0 && <small>TOP</small>}
                        </span>
                        <span className="orbit-bar-track">
                          <span
                            style={{
                              width: `${(item.visitors / totalVisitors) * 100}%`,
                            }}
                          />
                        </span>
                      </span>
                      <span className="orbit-browser-values">
                        <strong>{item.visitors}</strong>
                        <small>{percent(item.visitors)}</small>
                      </span>
                      <ArrowUpRight className="orbit-row-arrow" size={15} />
                    </button>
                  )
                })}
              </div>
              <p className="orbit-list-hint">
                Selecciona un navegador para verlo en detalle.
              </p>
            </div>
          </div>

          <div className="orbit-insight">
            <span className="orbit-insight-icon">
              <Sparkles size={18} />
            </span>
            <p>
              <strong>Chrome marca el ritmo.</strong> Casi 1 de cada 3 visitas
              llega desde este navegador.
            </p>
            <ArrowDownRight size={20} aria-hidden="true" />
          </div>
        </section>

        <footer className="orbit-footer">
          <span>Diseñado para ver más allá de los números.</span>
          <span>
            ORBIT <span className="orbit-footer-star">✳</span> 2024
          </span>
        </footer>
      </div>
    </main>
  )
}
