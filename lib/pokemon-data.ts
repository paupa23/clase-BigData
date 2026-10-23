export type Pokemon = {
  id: number
  name: string
  types: string[]
  region: string
  category: string
  description: string
  height: number
  weight: number
  stats: {
    hp: number
    attack: number
    defense: number
    specialAttack: number
    specialDefense: number
    speed: number
  }
  color: string
  image: string
}

// Cached from PokeAPI: base-form statistics, dimensions in metres / kilograms,
// and the Spanish names, genera, types and latest available species description.
export const pokemonSources = {
  data: "https://pokeapi.co/docs/v2/",
  pokemon: "https://pokeapi.co/api/v2/pokemon/",
  species: "https://pokeapi.co/api/v2/pokemon-species/",
  artwork: "https://github.com/PokeAPI/sprites",
} as const

export const pokemonData: Pokemon[] = [
  {
    id: 6,
    name: "Charizard",
    types: ["Fuego", "Volador"],
    region: "Kanto",
    category: "Pokémon Llama",
    description:
      "Sus potentes alas le permiten volar a una altura de 1400 m. Escupe llamaradas que llegan a alcanzar temperaturas elevadísimas.",
    height: 1.7,
    weight: 90.5,
    stats: {
      hp: 78,
      attack: 84,
      defense: 78,
      specialAttack: 109,
      specialDefense: 85,
      speed: 100,
    },
    color: "#ef8d4f",
    image: "/pokemon/6.png",
  },
  {
    id: 94,
    name: "Gengar",
    types: ["Fantasma", "Veneno"],
    region: "Kanto",
    category: "Pokémon Sombra",
    description:
      "Dicen que sale de la oscuridad para robarles el alma a los que se pierden por las montañas.",
    height: 1.5,
    weight: 40.5,
    stats: {
      hp: 60,
      attack: 65,
      defense: 60,
      specialAttack: 130,
      specialDefense: 75,
      speed: 110,
    },
    color: "#9f8acb",
    image: "/pokemon/94.png",
  },
  {
    id: 658,
    name: "Greninja",
    types: ["Agua", "Siniestro"],
    region: "Kalos",
    category: "Pokémon Ninja",
    description:
      "Aparece y desaparece de improvisto, cual ninja. Marea al oponente con su soberbia agilidad y lo hace trizas con sus Shuriken de Agua.",
    height: 1.5,
    weight: 40,
    stats: {
      hp: 72,
      attack: 95,
      defense: 67,
      specialAttack: 103,
      specialDefense: 71,
      speed: 122,
    },
    color: "#70aabd",
    image: "/pokemon/658.png",
  },
  {
    id: 25,
    name: "Pikachu",
    types: ["Eléctrico"],
    region: "Kanto",
    category: "Pokémon Ratón",
    description:
      "Los miembros de esta especie se saludan entre sí uniendo sus colas y transmitiéndose corriente eléctrica.",
    height: 0.4,
    weight: 6,
    stats: {
      hp: 35,
      attack: 55,
      defense: 40,
      specialAttack: 50,
      specialDefense: 50,
      speed: 90,
    },
    color: "#f4ce58",
    image: "/pokemon/25.png",
  },
  {
    id: 1,
    name: "Bulbasaur",
    types: ["Planta", "Veneno"],
    region: "Kanto",
    category: "Pokémon Semilla",
    description:
      "Desde que nace, crece alimentándose de los nutrientes que contiene la semilla de su lomo.",
    height: 0.7,
    weight: 6.9,
    stats: {
      hp: 45,
      attack: 49,
      defense: 49,
      specialAttack: 65,
      specialDefense: 65,
      speed: 45,
    },
    color: "#88b982",
    image: "/pokemon/1.png",
  },
  {
    id: 4,
    name: "Charmander",
    types: ["Fuego"],
    region: "Kanto",
    category: "Pokémon Lagartija",
    description:
      "Este Pokémon nace con una llama en la punta de la cola. Si se le apagara, fallecería.",
    height: 0.6,
    weight: 8.5,
    stats: {
      hp: 39,
      attack: 52,
      defense: 43,
      specialAttack: 60,
      specialDefense: 50,
      speed: 65,
    },
    color: "#ef9871",
    image: "/pokemon/4.png",
  },
  {
    id: 7,
    name: "Squirtle",
    types: ["Agua"],
    region: "Kanto",
    category: "Pokémon Tortuguita",
    description:
      "Cuando se siente en peligro, se esconde en su caparazón y escupe chorros de agua por la boca.",
    height: 0.5,
    weight: 9,
    stats: {
      hp: 44,
      attack: 48,
      defense: 65,
      specialAttack: 50,
      specialDefense: 64,
      speed: 43,
    },
    color: "#82bcd4",
    image: "/pokemon/7.png",
  },
  {
    id: 133,
    name: "Eevee",
    types: ["Normal"],
    region: "Kanto",
    category: "Pokémon Evolución",
    description:
      "Su irregular estructura genética alberga el secreto de la capacidad que posee este Pokémon tan especial para adoptar evoluciones muy variadas.",
    height: 0.3,
    weight: 6.5,
    stats: {
      hp: 55,
      attack: 55,
      defense: 50,
      specialAttack: 45,
      specialDefense: 65,
      speed: 55,
    },
    color: "#bc986f",
    image: "/pokemon/133.png",
  },
  {
    id: 149,
    name: "Dragonite",
    types: ["Dragón", "Volador"],
    region: "Kanto",
    category: "Pokémon Dragón",
    description:
      "Se lo conoce como el Avatar de la Mar. Muchos barcos lucen una talla de Dragonite como mascarón de proa.",
    height: 2.2,
    weight: 210,
    stats: {
      hp: 91,
      attack: 134,
      defense: 95,
      specialAttack: 100,
      specialDefense: 100,
      speed: 80,
    },
    color: "#e5ac72",
    image: "/pokemon/149.png",
  },
  {
    id: 150,
    name: "Mewtwo",
    types: ["Psíquico"],
    region: "Kanto",
    category: "Pokémon Genético",
    description:
      "Su ADN es casi el mismo que el de Mew. Sin embargo, su tamaño y carácter son muy diferentes.",
    height: 2,
    weight: 122,
    stats: {
      hp: 106,
      attack: 110,
      defense: 90,
      specialAttack: 154,
      specialDefense: 90,
      speed: 130,
    },
    color: "#ba9acd",
    image: "/pokemon/150.png",
  },
  {
    id: 448,
    name: "Lucario",
    types: ["Lucha", "Acero"],
    region: "Sinnoh",
    category: "Pokémon Aura",
    description:
      "Puede leer los pensamientos de la gente, por lo que establece lazos afectivos únicamente con Entrenadores de corazón noble.",
    height: 1.2,
    weight: 54,
    stats: {
      hp: 70,
      attack: 110,
      defense: 70,
      specialAttack: 115,
      specialDefense: 70,
      speed: 90,
    },
    color: "#74aac9",
    image: "/pokemon/448.png",
  },
  {
    id: 700,
    name: "Sylveon",
    types: ["Hada"],
    region: "Kalos",
    category: "Pokémon Vínculo",
    description:
      "En un cuento infantil de Galar se narra la victoria de un Sylveon de extraordinaria belleza sobre un temible Pokémon de tipo Dragón.",
    height: 1,
    weight: 23.5,
    stats: {
      hp: 95,
      attack: 65,
      defense: 65,
      specialAttack: 110,
      specialDefense: 130,
      speed: 60,
    },
    color: "#e7a5bc",
    image: "/pokemon/700.png",
  },
]

export const featuredPokemon: Pokemon[] = pokemonData.slice(0, 3)
