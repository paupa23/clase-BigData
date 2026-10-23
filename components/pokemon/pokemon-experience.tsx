"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Image from "next/image"
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Dna,
  Grid2X2,
  Heart,
  List,
  Menu,
  Pause,
  Play,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react"

import { featuredPokemon, pokemonData, type Pokemon } from "@/lib/pokemon-data"
import "./pokemon.css"

const TEAM_KEY = "pokelab-team-v1"
const filters = ["Todos", "Fuego", "Agua", "Planta", "Eléctrico", "Fantasma"]
const statLabels: [keyof Pokemon["stats"], string][] = [
  ["hp", "Vida"],
  ["attack", "Ataque"],
  ["defense", "Defensa"],
  ["specialAttack", "Ataque especial"],
  ["specialDefense", "Defensa especial"],
  ["speed", "Velocidad"],
]
const number = (id: number) => `#${String(id).padStart(3, "0")}`
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

function TypeBadges({ types }: { types: string[] }) {
  return (
    <div className="pk-type-badges">
      {types.map((type) => (
        <span key={type} className="pk-type-badge" data-type={type}>
          {type}
        </span>
      ))}
    </div>
  )
}

export function PokemonExperience() {
  const [mounted, setMounted] = useState(false)
  const [team, setTeam] = useState<number[]>([])
  const [query, setQuery] = useState("")
  const [type, setType] = useState("Todos")
  const [teamOnly, setTeamOnly] = useState(false)
  const [layout, setLayout] = useState<"grid" | "list">("grid")
  const [heroIndex, setHeroIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selected, setSelected] = useState<Pokemon | null>(null)
  const [toast, setToast] = useState("")
  const pageRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDialogElement>(null)
  const collectionRef = useRef<HTMLDialogElement>(null)
  const hero = featuredPokemon[heroIndex]
  const selectedTeam = pokemonData.filter((pokemon) =>
    team.includes(pokemon.id)
  )
  const visiblePokemon = pokemonData.filter((pokemon) => {
    const search = normalize(query.trim()).replace(/^#/, "")
    const matchesSearch =
      normalize(pokemon.name).includes(search) ||
      String(pokemon.id).padStart(3, "0").includes(search)
    return (
      matchesSearch &&
      (type === "Todos" || pokemon.types.includes(type)) &&
      (!teamOnly || team.includes(pokemon.id))
    )
  })

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(TEAM_KEY) ?? "[]")
      if (Array.isArray(saved)) {
        setTeam(
          [
            ...new Set(
              saved.filter(
                (id): id is number =>
                  typeof id === "number" &&
                  pokemonData.some((pokemon) => pokemon.id === id)
              )
            ),
          ].slice(0, 6)
        )
      }
    } catch {
      // An unavailable or outdated storage entry starts a fresh team.
    }
    setMounted(true)
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateMotion = () => {
      setReducedMotion(media.matches)
      if (media.matches) setAutoplay(false)
    }
    updateMotion()
    media.addEventListener("change", updateMotion)
    return () => media.removeEventListener("change", updateMotion)
  }, [])

  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(TEAM_KEY, JSON.stringify(team))
    } catch {
      // The current team remains usable when browser storage is unavailable.
    }
  }, [team, mounted])

  useEffect(() => {
    if (!autoplay || reducedMotion || selected) return
    const timer = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !collectionRef.current?.open
      ) {
        setHeroIndex((index) => (index + 1) % featuredPokemon.length)
      }
    }, 6500)
    return () => window.clearInterval(timer)
  }, [autoplay, reducedMotion, selected])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!mounted || !pageRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "true")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08 }
    )
    pageRef.current
      .querySelectorAll(".pk-reveal:not([data-visible='true'])")
      .forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [mounted, query, type, teamOnly, team, layout])

  function toggleTeam(pokemon: Pokemon) {
    if (team.includes(pokemon.id)) {
      setTeam((current) => current.filter((id) => id !== pokemon.id))
      setToast(`${pokemon.name} sale de tu equipo.`)
    } else if (team.length < 6) {
      setTeam((current) => [...current, pokemon.id])
      setToast(`${pokemon.name} se une a tu equipo.`)
    } else {
      setToast("Tu equipo ya tiene 6 Pokémon. Retira uno para añadir otro.")
    }
  }

  function openPokemon(pokemon: Pokemon) {
    collectionRef.current?.close()
    setSelected(pokemon)
    detailRef.current?.showModal()
  }

  function explore() {
    setMenuOpen(false)
    document
      .getElementById("pokedex")
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" })
  }

  function changeHero(direction: number) {
    setAutoplay(false)
    setHeroIndex(
      (index) =>
        (index + direction + featuredPokemon.length) % featuredPokemon.length
    )
  }

  function resetFilters() {
    setQuery("")
    setType("Todos")
    setTeamOnly(false)
  }

  return (
    <main ref={pageRef} className="pk-page" data-mounted={mounted}>
      <div className="pk-grain" aria-hidden="true" />
      <div className="pk-ambient" aria-hidden="true" />
      <div className="pk-container">
        <header className="pk-nav">
          <a className="pk-brand" href="#inicio" aria-label="PokéLab, inicio">
            <span className="pk-brand-mark" aria-hidden="true" />
            POKÉ<span>LAB</span>
            <sup>™</sup>
          </a>
          <nav className="pk-nav-links" aria-label="Navegación principal">
            <a
              href="#pokedex"
              data-active="true"
              onClick={(event) => {
                event.preventDefault()
                explore()
              }}
            >
              Explorar <span>01</span>
            </a>
            <a href="#universo">
              El universo <span>02</span>
            </a>
            <a
              href="https://www.pokemon.com/es"
              target="_blank"
              rel="noreferrer"
            >
              Pokémon oficial <ArrowUpRight size={13} />
            </a>
          </nav>
          <div className="pk-nav-actions">
            <button
              className="pk-collection-btn"
              type="button"
              onClick={() => collectionRef.current?.showModal()}
              aria-label={`Mi equipo: ${team.length} de 6 Pokémon`}
            >
              <Heart size={15} />
              <span>Mi equipo</span>
              <span className="pk-count">{team.length}</span>
            </button>
            <button
              className="pk-menu-toggle"
              type="button"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
              aria-controls="pokemon-mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </header>
        {menuOpen && (
          <nav
            id="pokemon-mobile-menu"
            className="pk-mobile-menu"
            aria-label="Navegación móvil"
          >
            <button type="button" onClick={explore}>
              Explorar la Pokédex <ArrowUpRight size={16} />
            </button>
            <a href="#universo" onClick={() => setMenuOpen(false)}>
              El universo Pokémon <ArrowUpRight size={16} />
            </a>
          </nav>
        )}

        <section id="inicio" className="pk-hero pk-reveal">
          <div className="pk-hero-copy">
            <p className="pk-eyebrow">
              <span className="pk-status-dot" />
              EL SIGUIENTE CAPÍTULO EMPIEZA CONTIGO
            </p>
            <h1 className="pk-hero-title">
              EL MUNDO
              <br />
              ES TU
              <br />
              <span className="pk-title-accent">POKÉDEX.</span>
            </h1>
            <p className="pk-hero-description">
              Algunos ven criaturas. Tú ves compañeros de aventura.
              <br />
              Descubre, conecta y encuentra tu próximo favorito.
            </p>
            <div className="pk-hero-cta">
              <button
                className="pk-button-primary"
                type="button"
                onClick={explore}
              >
                Explorar la Pokédex <ArrowUpRight size={19} />
              </button>
              <button
                className="pk-button-secondary"
                type="button"
                onClick={() => openPokemon(hero)}
              >
                <span className="pk-play-icon">
                  <Play size={13} fill="currentColor" />
                </span>
                Conoce a {hero.name}
              </button>
            </div>
            <div className="pk-hero-meta">
              <div className="pk-avatar-stack">
                {[25, 1, 7].map((id) => (
                  <Image
                    key={id}
                    src={`/pokemon/${id}.png`}
                    width={42}
                    height={42}
                    alt=""
                  />
                ))}
              </div>
              <p>
                <strong>12 Pokémon. Infinitas historias.</strong>
                <br />
                Elige el equipo con el que quieres vivirlas.
              </p>
            </div>
          </div>

          <div
            ref={stageRef}
            className="pk-hero-stage"
            style={{ "--pokemon-accent": hero.color } as CSSProperties}
            onPointerMove={(event) => {
              if (reducedMotion || event.pointerType !== "mouse") return
              const element = stageRef.current
              if (!element) return
              const bounds = element.getBoundingClientRect()
              element.style.setProperty(
                "--parallax-x",
                `${((event.clientX - bounds.left) / bounds.width - 0.5) * 24}px`
              )
              element.style.setProperty(
                "--parallax-y",
                `${((event.clientY - bounds.top) / bounds.height - 0.5) * 18}px`
              )
            }}
            onPointerLeave={() => {
              stageRef.current?.style.setProperty("--parallax-x", "0px")
              stageRef.current?.style.setProperty("--parallax-y", "0px")
            }}
          >
            <div className="pk-stage-grid" aria-hidden="true" />
            <div className="pk-stage-sun" aria-hidden="true" />
            <div className="pk-orbit pk-orbit-one" aria-hidden="true" />
            <div className="pk-orbit pk-orbit-two" aria-hidden="true" />
            <span className="pk-stage-number" aria-hidden="true">
              {String(hero.id).padStart(3, "0")}
            </span>
            <div className="pk-floating-label pk-label-top">
              <span className="pk-status-dot" />
              POKÉMON EN FOCO <span>↗</span>
            </div>
            <div key={hero.id} className="pk-stage-image-wrap">
              <Image
                className="pk-stage-image"
                src={hero.image}
                width={475}
                height={475}
                alt={hero.name}
                preload={heroIndex === 0}
                sizes="(max-width: 640px) 90vw, (max-width: 1000px) 55vw, 600px"
              />
            </div>
            <Sparkles
              className="pk-stage-spark pk-spark-one"
              size={30}
              strokeWidth={1.2}
              aria-hidden="true"
            />
            <Sparkles
              className="pk-stage-spark pk-spark-two"
              size={17}
              aria-hidden="true"
            />
            <span className="pk-stage-spark pk-spark-three" aria-hidden="true">
              +
            </span>
            <div className="pk-floating-label pk-label-bottom">
              <Compass size={13} />
              REGIÓN {hero.region.toUpperCase()}
            </div>
            <div className="pk-stage-caption">
              <div className="pk-stage-caption-name">
                <small>
                  {number(hero.id)} /{" "}
                  {hero.category.replace("Pokémon ", "").toUpperCase()}
                </small>
                <strong>{hero.name}</strong>
              </div>
              <TypeBadges types={hero.types} />
            </div>
            <div className="pk-stage-controls">
              <button
                className="pk-icon-button"
                type="button"
                onClick={() => changeHero(-1)}
                aria-label="Pokémon destacado anterior"
              >
                <ChevronLeft size={17} />
              </button>
              <span className="pk-slide-count">
                <strong>0{heroIndex + 1}</strong> / 03
              </span>
              <button
                className="pk-icon-button"
                type="button"
                onClick={() => changeHero(1)}
                aria-label="Siguiente Pokémon destacado"
              >
                <ChevronRight size={17} />
              </button>
              <button
                className="pk-autoplay"
                type="button"
                onClick={() => setAutoplay(!autoplay)}
                aria-label={
                  autoplay ? "Pausar presentación" : "Reanudar presentación"
                }
                aria-pressed={autoplay}
              >
                {autoplay ? <Pause size={13} /> : <Play size={13} />}
              </button>
            </div>
          </div>
        </section>
        <div className="pk-scroll-cue">
          <ArrowDown size={12} />
          <span>HAZ SCROLL. HAY MUCHO POR DESCUBRIR.</span>
          <span className="pk-scroll-line" />
        </div>
      </div>

      <div className="pk-marquee" aria-hidden="true">
        <div className="pk-marquee-track">
          {[0, 1].map((iteration) => (
            <div className="pk-marquee-group" key={iteration}>
              NO DEJES DE EXPLORAR <Sparkles /> ENCUENTRA TU EQUIPO <Sparkles />{" "}
              VIVE TU PRÓXIMA AVENTURA <Sparkles />
            </div>
          ))}
        </div>
      </div>

      <div className="pk-container">
        <section id="pokedex" className="pk-dex pk-reveal">
          <div className="pk-section-heading">
            <div>
              <p className="pk-eyebrow">
                <span className="pk-section-index">01 /</span> EL ARCHIVO
                POKÉMON
              </p>
              <h2>
                HAY UN POKÉMON
                <br />
                <span>PARA CADA HISTORIA.</span>
              </h2>
              <p>
                Los de siempre. Los que aún no conoces. Todos tienen algo
                especial.
              </p>
            </div>
            <span className="pk-section-note">
              <Dna size={19} />
              12 ESPECIES
              <br />3 REGIONES
              <br />
              UNA NUEVA AVENTURA
            </span>
          </div>
          <div className="pk-dex-toolbar">
            <div className="pk-search">
              <Search size={17} />
              <label htmlFor="pokemon-search" className="sr-only">
                Buscar por nombre o número
              </label>
              <input
                id="pokemon-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre o número Pokémon..."
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <div
              className="pk-filter-tabs"
              role="group"
              aria-label="Filtrar por tipo"
            >
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  data-active={type === filter}
                  aria-pressed={type === filter}
                  onClick={() => setType(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div
              className="pk-view-toggle"
              role="group"
              aria-label="Vista de la Pokédex"
            >
              <button
                type="button"
                data-active={layout === "grid"}
                aria-pressed={layout === "grid"}
                onClick={() => setLayout("grid")}
                aria-label="Vista de tarjetas"
              >
                <Grid2X2 size={16} />
              </button>
              <button
                type="button"
                data-active={layout === "list"}
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
                aria-label="Vista de lista"
              >
                <List size={17} />
              </button>
            </div>
          </div>
          <div className="pk-dex-summary">
            <p aria-live="polite">
              {String(visiblePokemon.length).padStart(2, "0")} Pokémon{" "}
              {query || type !== "Todos" || teamOnly
                ? "encontrados"
                : "por descubrir"}
            </p>
            <button
              type="button"
              aria-pressed={teamOnly}
              onClick={() => setTeamOnly(!teamOnly)}
            >
              <Heart size={12} fill={teamOnly ? "currentColor" : "none"} />
              {teamOnly ? "Ver todos" : "Solo mi equipo"}
            </button>
          </div>

          {visiblePokemon.length ? (
            <div className="pk-pokemon-grid" data-layout={layout}>
              {visiblePokemon.map((pokemon, index) => (
                <article
                  key={pokemon.id}
                  className="pk-card pk-reveal"
                  style={
                    {
                      "--card-accent": pokemon.color,
                      "--card-delay": `${(index % 4) * 70}ms`,
                    } as CSSProperties
                  }
                >
                  <div className="pk-card-top">
                    <span className="pk-card-number">{number(pokemon.id)}</span>
                    <button
                      className="pk-save-button"
                      type="button"
                      data-saved={team.includes(pokemon.id)}
                      aria-pressed={team.includes(pokemon.id)}
                      aria-label={`${team.includes(pokemon.id) ? "Retirar" : "Añadir"} ${pokemon.name} ${team.includes(pokemon.id) ? "del" : "al"} equipo`}
                      onClick={() => toggleTeam(pokemon)}
                    >
                      {team.includes(pokemon.id) ? (
                        <Check size={15} />
                      ) : (
                        <Heart size={15} />
                      )}
                    </button>
                  </div>
                  <button
                    className="pk-card-open"
                    type="button"
                    onClick={() => openPokemon(pokemon)}
                    aria-label={`Ver ficha de ${pokemon.name}`}
                  >
                    <div className="pk-card-art">
                      <div className="pk-card-orbit" aria-hidden="true" />
                      <Image
                        className="pk-card-image"
                        src={pokemon.image}
                        width={475}
                        height={475}
                        alt=""
                        sizes="(max-width: 640px) 42vw, (max-width: 1000px) 28vw, 280px"
                      />
                    </div>
                    <div className="pk-card-info">
                      <span className="pk-card-region">
                        {pokemon.region.toUpperCase()} /{" "}
                        {pokemon.category.replace("Pokémon ", "")}
                      </span>
                      <h3>{pokemon.name}</h3>
                      <div className="pk-card-bottom">
                        <TypeBadges types={pokemon.types} />
                        <span className="pk-card-arrow">
                          <ArrowUpRight size={20} />
                        </span>
                      </div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="pk-empty-state">
              <Search size={30} />
              <h3>No encontramos ese Pokémon.</h3>
              <p>
                Prueba otro nombre, número o tipo. Tu próximo compañero sigue
                ahí.
              </p>
              <button
                className="pk-button-secondary"
                type="button"
                onClick={resetFilters}
              >
                Mostrar todos <ArrowRight size={17} />
              </button>
            </div>
          )}
        </section>

        <section id="universo" className="pk-universe pk-reveal">
          <div className="pk-universe-copy">
            <p className="pk-eyebrow">
              <span className="pk-status-dot" />
              SIEMPRE HAY ALGO MÁS
            </p>
            <h2>
              LA AVENTURA
              <br />
              NO TIENE
              <br />
              <span>ÚLTIMO NIVEL.</span>
            </h2>
            <p>
              Tu primer Pokémon nunca se olvida. El siguiente puede cambiarlo
              todo. Crea un equipo a tu manera y vuelve a sentir esa emoción.
            </p>
            <button
              className="pk-button-primary pk-universe-cta"
              type="button"
              onClick={() => collectionRef.current?.showModal()}
            >
              Construir mi equipo <ArrowUpRight size={18} />
            </button>
            <div className="pk-universe-tags">
              <span>
                <Compass size={13} />
                Explora
              </span>
              <span>
                <Heart size={13} />
                Conecta
              </span>
              <span>
                <Zap size={13} />
                Evoluciona
              </span>
            </div>
          </div>
          <div className="pk-universe-art">
            <span className="pk-universe-ring" aria-hidden="true" />
            <span className="pk-universe-outline" aria-hidden="true">
              150
            </span>
            <Image
              src="/pokemon/150.png"
              width={475}
              height={475}
              alt="Mewtwo"
              sizes="(max-width: 640px) 85vw, 500px"
            />
            <div className="pk-universe-label">
              <span className="pk-status-dot" />
              #150 MEWTWO<span>PSÍQUICO</span>
            </div>
            <Sparkles
              className="pk-universe-spark"
              size={35}
              strokeWidth={1.2}
              aria-hidden="true"
            />
          </div>
        </section>

        <footer className="pk-footer">
          <a
            className="pk-brand"
            href="#inicio"
            aria-label="PokéLab, volver al inicio"
          >
            <span className="pk-brand-mark" aria-hidden="true" />
            POKÉ<span>LAB</span>
            <sup>™</sup>
          </a>
          <p>
            Para los que nunca dejaron
            <br />
            de querer ser entrenadores.
          </p>
          <div className="pk-footer-links">
            <a
              href="#pokedex"
              onClick={(event) => {
                event.preventDefault()
                explore()
              }}
            >
              La Pokédex <ArrowUpRight size={13} />
            </a>
            <a
              href="https://www.pokemon.com/es"
              target="_blank"
              rel="noreferrer"
            >
              El mundo Pokémon <ArrowUpRight size={13} />
            </a>
          </div>
        </footer>
        <div className="pk-footer-bottom">
          <p>
            UN PROYECTO HECHO POR FANS, PARA FANS. POKÉMON © NINTENDO /
            CREATURES / GAME FREAK.
          </p>
          <a href="https://pokeapi.co" target="_blank" rel="noreferrer">
            Datos e imágenes: PokéAPI <ArrowUpRight size={11} />
          </a>
        </div>
      </div>

      <dialog
        ref={detailRef}
        className="pk-detail-dialog"
        aria-labelledby="pokemon-detail-title"
        aria-describedby="pokemon-detail-description"
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) detailRef.current?.close()
        }}
      >
        {selected && (
          <div
            className="pk-detail-shell"
            style={{ "--card-accent": selected.color } as CSSProperties}
          >
            <div className="pk-modal-toolbar">
              <button
                className="pk-modal-close"
                type="button"
                aria-label="Cerrar ficha"
                onClick={() => detailRef.current?.close()}
                autoFocus
              >
                <X size={20} />
              </button>
            </div>
            <div className="pk-detail-art">
              <span aria-hidden="true">
                {String(selected.id).padStart(3, "0")}
              </span>
              <Image
                src={selected.image}
                width={475}
                height={475}
                alt={selected.name}
                sizes="(max-width: 640px) 70vw, 350px"
              />
            </div>
            <div className="pk-detail-info">
              <p className="pk-eyebrow">
                {number(selected.id)} / {selected.region.toUpperCase()}
              </p>
              <h2 id="pokemon-detail-title">{selected.name}</h2>
              <TypeBadges types={selected.types} />
              <p id="pokemon-detail-description">{selected.description}</p>
              <div className="pk-detail-measures">
                <div>
                  <small>ALTURA</small>
                  <strong>
                    {selected.height.toLocaleString("es-ES")} <span>m</span>
                  </strong>
                </div>
                <div>
                  <small>PESO</small>
                  <strong>
                    {selected.weight.toLocaleString("es-ES")} <span>kg</span>
                  </strong>
                </div>
                <div>
                  <small>CATEGORÍA</small>
                  <strong className="pk-measure-category">
                    {selected.category.replace("Pokémon ", "")}
                  </strong>
                </div>
              </div>
              <div className="pk-detail-stats">
                <p className="pk-eyebrow">ESTADÍSTICAS BASE</p>
                {statLabels.map(([key, label]) => (
                  <div className="pk-stat-row" key={key}>
                    <span>{label}</span>
                    <strong>{selected.stats[key]}</strong>
                    <div className="pk-stat-track">
                      <span
                        style={{
                          width: `${(selected.stats[key] / 255) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="pk-button-primary"
                type="button"
                onClick={() => toggleTeam(selected)}
              >
                {team.includes(selected.id) ? (
                  <>
                    <Check size={17} />
                    En tu equipo · retirar
                  </>
                ) : (
                  <>
                    <Heart size={17} />
                    Añadir a mi equipo
                  </>
                )}
                <span>{team.length}/6</span>
              </button>
              <p className="pk-modal-feedback" role="status" aria-live="polite">
                {toast}
              </p>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={collectionRef}
        className="pk-collection-dialog"
        aria-labelledby="pokemon-team-title"
        onClick={(event) => {
          if (event.target === event.currentTarget)
            collectionRef.current?.close()
        }}
      >
        <button
          className="pk-modal-close"
          type="button"
          aria-label="Cerrar equipo"
          onClick={() => collectionRef.current?.close()}
          autoFocus
        >
          <X size={20} />
        </button>
        <div className="pk-collection-heading">
          <p className="pk-eyebrow">TUS COMPAÑEROS DE AVENTURA</p>
          <h2 id="pokemon-team-title">
            MI EQUIPO<span>{team.length} / 6</span>
          </h2>
          <p>Seis lugares. Un montón de posibilidades. Hazlo tuyo.</p>
        </div>
        {selectedTeam.length ? (
          <div className="pk-collection-list">
            {selectedTeam.map((pokemon) => (
              <div
                className="pk-collection-item"
                key={pokemon.id}
                style={{ "--card-accent": pokemon.color } as CSSProperties}
              >
                <Image src={pokemon.image} width={70} height={70} alt="" />
                <button type="button" onClick={() => openPokemon(pokemon)}>
                  <small>
                    {number(pokemon.id)} / {pokemon.region}
                  </small>
                  <h3>{pokemon.name}</h3>
                </button>
                <button
                  className="pk-icon-button"
                  type="button"
                  aria-label={`Retirar ${pokemon.name} del equipo`}
                  onClick={() => toggleTeam(pokemon)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="pk-collection-empty">
            <span className="pk-brand-mark" aria-hidden="true" />
            <h3>Todo empieza con el primero.</h3>
            <p>
              Explora la Pokédex y toca el corazón para añadir a tu próximo
              compañero.
            </p>
            <button
              className="pk-button-primary"
              type="button"
              onClick={() => {
                collectionRef.current?.close()
                explore()
              }}
            >
              Encontrar mi primer Pokémon <ArrowUpRight size={18} />
            </button>
          </div>
        )}
        <p className="pk-modal-feedback" role="status" aria-live="polite">
          {toast}
        </p>
      </dialog>
      <div
        className="pk-toast"
        role="status"
        aria-live="polite"
        data-visible={Boolean(toast)}
      >
        {toast && (
          <>
            <Check size={17} />
            {toast}
          </>
        )}
      </div>
    </main>
  )
}
