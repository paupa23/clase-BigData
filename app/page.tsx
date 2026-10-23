import type { Metadata } from "next"

import { PokemonExperience } from "@/components/pokemon/pokemon-experience"

export const metadata: Metadata = {
  title: "PokéLab — El mundo es tu Pokédex",
  description:
    "Explora Pokémon, descubre sus estadísticas y crea tu equipo. Una nueva forma de vivir tu próxima aventura.",
}

export default function Page() {
  return <PokemonExperience />
}
