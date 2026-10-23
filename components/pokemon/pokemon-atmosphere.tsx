"use client"

import { useEffect, useRef } from "react"

import "./pokemon-atmosphere.css"

type AtmosphereVariant = "fire" | "ghost" | "water"

type Particle = {
  x: number
  y: number
  radius: number
  phase: number
  speed: number
  orbit: number
  opacity: number
  progress: number
  star: boolean
}

type PokemonAtmosphereProps = {
  variant: AtmosphereVariant
  color: string
  paused: boolean
}

const FRAME_INTERVAL = 1000 / 30
const TAU = Math.PI * 2

export function PokemonAtmosphere({
  variant,
  color,
  paused,
}: PokemonAtmosphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext("2d", { alpha: true })
    if (!context) return

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    )
    let width = 0
    let height = 0
    let particles: Particle[] = []
    let frameId = 0
    let previousFrame = 0
    let elapsed = 0
    let isVisible = false
    let disposed = false

    const random = (min: number, max: number) =>
      min + Math.random() * (max - min)

    const createParticles = (count: number): Particle[] =>
      Array.from({ length: count }, (_, index) => ({
        x: random(0.12, 0.88),
        y: random(0.1, 0.76),
        radius: random(0.7, variant === "ghost" ? 2.1 : 1.65),
        phase: random(0, TAU),
        speed: random(0.6, 1.4),
        orbit: random(0.76, 1.06),
        opacity: random(0.2, 0.55),
        progress: random(0, 1),
        star: variant === "water" && index % 4 === 0,
      }))

    const clear = () => context.clearRect(0, 0, width, height)

    // The illustration occupies the middle; keep most light around its edges.
    const edgeOpacity = (x: number, y: number) => {
      const distance = Math.hypot((x - 0.5) / 0.32, (y - 0.44) / 0.32)
      return Math.min(1, Math.max(0.12, (distance - 0.35) * 1.2))
    }

    const drawGlow = (
      x: number,
      y: number,
      radius: number,
      opacity: number
    ) => {
      const halo = context.createRadialGradient(x, y, 0, x, y, radius * 5)
      halo.addColorStop(0, color)
      halo.addColorStop(1, "transparent")
      context.globalAlpha = opacity * 0.22
      context.fillStyle = halo
      context.beginPath()
      context.arc(x, y, radius * 5, 0, TAU)
      context.fill()
    }

    const drawWaterArcs = () => {
      context.lineWidth = 0.75
      context.strokeStyle = color
      for (let index = 0; index < 2; index++) {
        const angle = elapsed * 0.045 * (index ? -1 : 1) + index * Math.PI
        context.globalAlpha = 0.1
        context.beginPath()
        context.ellipse(
          width * 0.5,
          height * 0.43,
          width * (0.36 + index * 0.05),
          height * (0.28 + index * 0.025),
          -0.28,
          angle,
          angle + 0.48
        )
        context.stroke()
      }
    }

    const draw = (delta: number) => {
      clear()
      if (variant === "water") drawWaterArcs()

      for (const particle of particles) {
        let x: number
        let y: number
        let opacity: number

        if (variant === "fire") {
          particle.progress =
            (particle.progress + delta * 0.045 * particle.speed) % 1
          x =
            particle.x +
            Math.sin(elapsed * 0.8 * particle.speed + particle.phase) * 0.025
          y = 0.78 - particle.progress * 0.67
          opacity = Math.sin(particle.progress * Math.PI) * particle.opacity
        } else {
          const angle =
            particle.phase +
            elapsed * (variant === "ghost" ? 0.11 : 0.085) * particle.speed
          x =
            0.5 +
            Math.cos(angle) * 0.38 * particle.orbit +
            Math.sin(elapsed * 0.45 + particle.phase) * 0.009
          y = 0.44 + Math.sin(angle) * 0.3 * particle.orbit
          opacity =
            particle.opacity *
            (0.58 + Math.sin(elapsed * particle.speed + particle.phase) * 0.27)
        }

        opacity *= edgeOpacity(x, y)
        const pixelX = x * width
        const pixelY = y * height
        const radius = particle.radius
        drawGlow(pixelX, pixelY, radius, opacity)
        context.globalAlpha = opacity
        context.fillStyle = color
        context.strokeStyle = color

        if (variant === "ghost") {
          // A curved, translucent tail gives the motes a soft spectral drift.
          context.lineWidth = radius * 0.65
          context.lineCap = "round"
          context.beginPath()
          context.moveTo(pixelX - radius * 3.5, pixelY + radius * 1.5)
          context.quadraticCurveTo(
            pixelX - radius * 2,
            pixelY - radius,
            pixelX,
            pixelY
          )
          context.stroke()
        }

        context.beginPath()
        if (particle.star) {
          const size = radius * 2.4
          context.moveTo(pixelX, pixelY - size)
          context.quadraticCurveTo(
            pixelX + radius * 0.3,
            pixelY - radius * 0.3,
            pixelX + size,
            pixelY
          )
          context.quadraticCurveTo(
            pixelX + radius * 0.3,
            pixelY + radius * 0.3,
            pixelX,
            pixelY + size
          )
          context.quadraticCurveTo(
            pixelX - radius * 0.3,
            pixelY + radius * 0.3,
            pixelX - size,
            pixelY
          )
          context.quadraticCurveTo(
            pixelX - radius * 0.3,
            pixelY - radius * 0.3,
            pixelX,
            pixelY - size
          )
        } else if (variant === "fire") {
          context.ellipse(
            pixelX,
            pixelY,
            radius * 0.65,
            radius * 1.6,
            0.28,
            0,
            TAU
          )
        } else {
          context.arc(pixelX, pixelY, radius, 0, TAU)
        }
        context.fill()
      }

      context.globalAlpha = 1
    }

    const canAnimate = () =>
      !disposed &&
      !paused &&
      !motionPreference.matches &&
      !document.hidden &&
      isVisible &&
      width > 0 &&
      height > 0

    const frame = (timestamp: number) => {
      if (!canAnimate()) {
        frameId = 0
        return
      }

      const interval = timestamp - previousFrame
      if (previousFrame === 0 || interval >= FRAME_INTERVAL) {
        const delta = previousFrame === 0 ? 0 : Math.min(interval, 64) / 1000
        previousFrame = timestamp
        elapsed += delta
        draw(delta)
      }
      frameId = window.requestAnimationFrame(frame)
    }

    const syncAnimation = () => {
      if (canAnimate()) {
        if (!frameId) {
          previousFrame = 0
          frameId = window.requestAnimationFrame(frame)
        }
      } else {
        window.cancelAnimationFrame(frameId)
        frameId = 0
        previousFrame = 0
        if (paused || motionPreference.matches) clear()
      }
    }

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      const count = window.matchMedia("(max-width: 640px)").matches ? 12 : 24
      if (particles.length !== count) particles = createParticles(count)
      syncAnimation()
    }

    const resizeObserver = new ResizeObserver(resize)
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
        syncAnimation()
      },
      { threshold: 0 }
    )

    resizeObserver.observe(canvas)
    intersectionObserver.observe(canvas)
    motionPreference.addEventListener("change", syncAnimation)
    document.addEventListener("visibilitychange", syncAnimation)
    resize()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      motionPreference.removeEventListener("change", syncAnimation)
      document.removeEventListener("visibilitychange", syncAnimation)
      clear()
    }
  }, [variant, color, paused])

  return (
    <canvas
      ref={canvasRef}
      className="pk-atmosphere-canvas"
      aria-hidden="true"
    />
  )
}
