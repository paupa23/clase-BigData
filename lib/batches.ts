import type { Measurement } from "./etl"

export type Batch = {
  id: number
  rows: Measurement[]
  status: "pending" | "running" | "done" | "error"
  verified: number
  duration: number
  error?: string
}

export function freezeBatches(rows: Measurement[]): Batch[] {
  const result: Batch[] = []
  for (let i = 0; i < rows.length; i += 500)
    result.push({
      id: result.length + 1,
      rows: rows.slice(i, i + 500).map((r) => ({ ...r })),
      status: "pending",
      verified: 0,
      duration: 0,
    })
  return result
}

// Los lotes completados nunca se repiten; un fallo no elimina el resultado anterior.
export async function executeBatches(
  batches: Batch[],
  send: (rows: Measurement[]) => Promise<{ verified: number }>,
  onUpdate: (batches: Batch[]) => void
): Promise<Batch[]> {
  const result = batches.map((b) => ({ ...b }))
  for (let i = 0; i < result.length; i++) {
    if (result[i].status === "done") continue
    const start = performance.now()
    result[i] = { ...result[i], status: "running", error: undefined }
    onUpdate([...result])
    try {
      const response = await send(result[i].rows)
      if (response.verified !== result[i].rows.length)
        throw new Error(
          "No se han verificado todas las claves del lote en destino."
        )
      result[i] = {
        ...result[i],
        status: "done",
        verified: response.verified,
        duration: performance.now() - start,
      }
    } catch (error) {
      result[i] = {
        ...result[i],
        status: "error",
        verified: 0,
        duration: performance.now() - start,
        error:
          error instanceof Error
            ? error.message
            : "No se ha podido procesar el lote.",
      }
    }
    onUpdate([...result])
  }
  return result
}
