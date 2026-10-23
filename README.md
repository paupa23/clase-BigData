# ClimaLab · Primera práctica ETL

Aplicación didáctica en castellano con Next.js 16, React, TypeScript, Tailwind y shadcn/ui. Extrae datos reales, conserva los JSON originales en memoria y permite inspeccionar y seleccionar exactamente qué se carga en Supabase. Los fixtures están aislados en las pruebas.

## Instalación y ejecución

Node.js 22.18 o superior (recomendado 24 LTS) y npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

En PowerShell, usa `Copy-Item .env.example .env.local` solo si no existe. Si la política de scripts bloquea npm, utiliza `npm.cmd`.

Abre [http://localhost:3000](http://localhost:3000). Periodo inicial: 1–30 de septiembre de 2026; cinco ciudades, 3.600 horas previstas. Puedes solicitar entre 1 y 31 días inclusivos. Las fechas más recientes pueden tardar varios días en estar disponibles en el archivo histórico.

## Configuración de Supabase

1. Ejecuta una vez [la migración SQL](supabase/migrations/202610230001_mediciones_meteorologicas.sql) en el SQL Editor de tu proyecto, o con tu flujo habitual de Supabase CLI. Crea la tabla, restricciones, clave única `(ciudad, fecha_hora)` y RLS; no crea políticas públicas ni elimina tablas. Si la tabla ya existe, revisa su esquema antes de aplicar la migración.
2. Configura `NEXT_PUBLIC_SUPABASE_URL` y **`SUPABASE_SECRET_KEY`** en `.env.local`. Usa una clave de servidor `sb_secret_...` desde Settings → API Keys. Como alternativa heredada, configura `SUPABASE_SERVICE_ROLE_KEY` con una clave service_role. Nunca uses `NEXT_PUBLIC_` para secretos. La publishable es opcional y no se utiliza para escribir ni leer este ETL.
3. Reinicia el servidor tras modificar variables. La extracción y las operaciones locales funcionan sin clave secreta; la carga y consulta del destino muestran el error real de configuración.

`.env.local` está excluido de Git. `.env.example` no contiene valores reales. No se imprimen credenciales. La migración requiere acceso administrativo; no puede ejecutarse con una publishable ni mediante el endpoint REST de tablas.

## Pipeline

- **Extracción:** peticiones secuenciales por ciudad a Open-Meteo en UTC, °C y mm; muestra ciudades terminadas, en curso, pendientes y fallidas. Un reintento sustituye únicamente la ciudad fallida. Los JSON originales se conservan durante la sesión, incluso entre extracciones, y pueden descargarse individualmente o juntos. Recargar la pestaña borra esa memoria.
- **Transformación:** verifica la presencia y longitud de los arrays antes de combinarlos por índice. Convierte las fechas explícitamente a UTC. Ante arrays incoherentes, rechaza la respuesta completa de la ciudad con motivo, sin inventar parejas de valores; el JSON sigue disponible.
- **Limpieza:** exige ciudad, fecha válida y tres números finitos; humedad 0–100 y precipitación no negativa. No convierte null, ausencias ni cadenas vacías en cero, ni impone umbrales arbitrarios de temperatura. Conserva la **primera fila válida** por ciudad y hora; registra el motivo de cada rechazo y duplicado.
- **Filtrado y selección:** ciudades, intervalo UTC, rangos de mediciones, lluvia (`> 0`) y orden ascendente/descendente. Se aplican al conjunto completo antes de paginar en 25 filas. La selección cruza páginas y «Seleccionar coincidencias» las incluye todas. Los filtros no seleccionan filas nuevas. Las seleccionadas fuera del filtro se cuentan y no entran en una nueva carga. La vista previa contiene exactamente la intersección filtrada y seleccionada, en el orden elegido.
- **Carga:** congela una copia de las filas y su orden. Envía lotes de hasta 500 desde el servidor con upsert y después verifica las claves exactas en grupos de 25. Un lote solo se completa cuando todas sus claves existen en destino. Los filtros posteriores no modifican esa copia. Conserva los lotes exitosos y reintenta únicamente los fallidos con sus filas originales. Se cuentan procesados/verificados, fallidos o sin verificar, y pendientes; no se inventa la separación entre insertados y actualizados. Si la escritura ocurrió pero falla la verificación, el lote queda como error y puede reintentarse sin duplicar.

Los estados, contadores y tiempos son reales. La extracción comienza con cero filas de entrada; el volumen esperado se muestra aparte. La salida del filtrado y selección es el conjunto preparado para cargar. La limpieza incluye también los descartes estructurales identificados en «Rechazados».

**Datos en Supabase** consulta registros persistidos a través del servidor, con paginación, ciudad, fechas inclusivas, orden y actualización. Los pendientes locales no aparecen ahí. El orden de inserción no determina el orden de consulta: se necesita `ORDER BY`; la lectura del destino especifica el orden y un desempate estable por `id`.

## Seguridad y publicación

Esta práctica no tiene autenticación: **los endpoints solo están habilitados en `next dev` con host localhost**. Las escrituras exigen origen coincidente. Se bloquean peticiones entre sitios, se limita el cuerpo a 160 KB y 500 filas, se validan también en servidor y se admiten únicamente las columnas previstas. El cliente y la instancia del servidor impiden cargas simultáneas. Cada lote es independiente; un fallo no revierte los anteriores.

`npm run build` y `npm start` permiten revisar la interfaz de producción, pero sus APIs devuelven 403. Antes de publicar con acceso a datos, añade autenticación y autorización, límites por usuario y control de concurrencia compartido si hay varias instancias. La clave secreta permanece en el servidor. RLS sigue activo, sin permisos para `anon` o `authenticated` en esta tabla.

## Verificación

```bash
npm test
npm run test:integration
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

- `npm test`: fixtures aislados para arrays, nulos, tipos, UTC, duplicados, filtros/orden antes de paginar, selección entre páginas, copia congelada, payload, fallos parciales y reintentos. El adaptador REST usa transporte controlado y almacenamiento en memoria para comprobar dos upserts sin duplicados; eso no sustituye la integración real.
- `npm run test:integration`: extracción real de Barcelona el 1 de septiembre de 2026, 24 filas en UTC. Si hay clave secreta y la tabla existe, **escribe esas 24 mediciones reales dos veces** y comprueba que siguen siendo 24. No escribe fixtures. Si falta la clave, informa de la prueba de Supabase omitida.
- `npm run test:e2e`: navegador con una extracción real; escenarios controlados separados para selección, vista previa/payload, reintento por ciudad, copia congelada durante carga, fallos parciales, validaciones HTTP y móvil. Las cargas se interceptan y no escriben en Supabase. Reutiliza o inicia un servidor en localhost:3000. Usa Microsoft Edge instalado. En otros entornos: `npx playwright install chromium` y configura `PLAYWRIGHT_CHANNEL=chromium` (PowerShell: `$env:PLAYWRIGHT_CHANNEL='chromium'`). `E2E_BASE_URL` permite elegir otro servidor local ya iniciado.

Verificación inicial: 14 pruebas unitarias, extracción real y 7 pruebas de navegador superadas. Tipos, lint y build correctos. La migración, carga real y segunda carga real sin duplicados quedan pendientes mientras falte la clave secreta de Supabase. No se ha simulado su éxito.

## Documentación consultada

[Open-Meteo](https://open-meteo.com/en/docs/historical-weather-api), [claves de Supabase](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [upsert](https://supabase.com/docs/reference/javascript/upsert) y [PostgREST](https://docs.postgrest.org/en/stable/references/api/tables_views.html). Datos meteorológicos de Open-Meteo bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
