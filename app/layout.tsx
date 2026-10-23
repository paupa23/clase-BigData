import type { Metadata } from "next"
import { Geist_Mono, IBM_Plex_Sans } from "next/font/google"

import "./globals.css"
import "./etl.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "ClimaLab · Tu primer pipeline ETL",
  description:
    "Aprende a extraer, transformar, limpiar y cargar datos meteorológicos reales de Open-Meteo en Supabase.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        ibmPlexSans.variable
      )}
    >
      <body>
        <ThemeProvider forcedTheme="light">{children}</ThemeProvider>
      </body>
    </html>
  )
}
