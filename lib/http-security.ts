export function localAccessError(
  request: Request,
  mode: string | undefined
): string | null {
  if (mode !== "development")
    return "Esta práctica no tiene autenticación: los endpoints solo están habilitados en desarrollo local. Añade autenticación antes de publicar."
  const url = new URL(request.url)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    return "Acceso permitido únicamente desde localhost."
  const origin = request.headers.get("origin")
  if (
    (request.method !== "GET" && !origin) ||
    (origin && origin !== url.origin)
  )
    return "El origen de la petición no está permitido."
  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite && !["same-origin", "none"].includes(fetchSite))
    return "Se ha bloqueado una petición desde otro sitio."
  return null
}
