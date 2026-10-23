import Link from "next/link"
import { cookies } from "next/headers"
import { ArrowLeft, CheckCheck, Database, ListTodo } from "lucide-react"

import { createClient } from "@/utils/supabase/server"
import { getSupabaseConfig } from "@/utils/supabase/config"

type Todo = {
  id: string | number
  name: string | null
}

export default async function TodosPage() {
  const cookieStore = await cookies()
  let todos: Todo[] = []
  let errorMessage: string | null = null

  if (!getSupabaseConfig()) {
    errorMessage = "La conexión con Supabase todavía no está configurada."
  } else {
    const supabase = createClient(cookieStore)
    const { data, error } = await supabase
      .from("todos")
      .select("id, name")
      .order("id")

    if (error) {
      console.error(
        "No se pudieron cargar las tareas de Supabase:",
        error.code,
        error.message
      )
      errorMessage =
        "No se han podido cargar las tareas. Inténtalo de nuevo más tarde."
    } else {
      todos = data ?? []
    }
  }

  return (
    <main className="orbit-shell">
      <div className="orbit-ambient" aria-hidden="true" />
      <div className="orbit-container max-w-3xl pb-12">
        <header className="orbit-nav">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-[#afb3be] transition-colors hover:text-[#d5f879]"
          >
            <ArrowLeft size={16} /> Volver al dashboard
          </Link>
          <span className="flex items-center gap-2 text-xs text-[#d5f879]">
            <Database size={14} /> Supabase
          </span>
        </header>

        <section className="orbit-hero orbit-reveal">
          <div>
            <p className="orbit-eyebrow">
              <span /> TU ESPACIO DE TRABAJO
            </p>
            <h1>
              Tus tareas,
              <br />
              <span>en orden.</span>
            </h1>
            <p className="orbit-subtitle">
              Un pequeño paso para ti. Un gran avance para tu día.
            </p>
          </div>
        </section>

        <section
          className="orbit-panel orbit-reveal p-6 sm:p-8"
          aria-labelledby="todos-title"
        >
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 id="todos-title" className="!m-0 flex items-center gap-3">
              <ListTodo size={20} className="text-[#d5f879]" /> Lista de tareas
            </h2>
            {!errorMessage && (
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#a1a6b1]">
                {todos.length} {todos.length === 1 ? "tarea" : "tareas"}
              </span>
            )}
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-xl border border-[#f3a477]/20 bg-[#f3a477]/5 p-4 text-sm text-[#f3a477]"
            >
              {errorMessage}
            </p>
          ) : todos.length ? (
            <ul className="space-y-3">
              {todos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm transition-colors hover:border-[#d5f879]/20 hover:bg-[#d5f879]/5"
                >
                  <span
                    className="size-2 shrink-0 rounded-full bg-[#d5f879]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">
                    {todo.name || "Tarea sin nombre"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCheck size={32} className="text-[#d5f879]" />
              <p className="text-sm text-[#a1a6b1]">
                Todavía no hay tareas para mostrar.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
