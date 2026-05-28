# Auth + Base de Datos Implementation Design

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Añadir login con Google y persistencia de rutas en Supabase, con cifrado AES-256-GCM de todos los campos PII (nombre, dirección, teléfono de clientes) antes de escribir en la base de datos.

**Architecture:** Supabase gestiona Auth (Google OAuth), PostgreSQL y Edge Functions. El frontend añade `@supabase/supabase-js` y `react-router-dom`. Los componentes existentes no se modifican. Las Edge Functions actúan como capa de cifrado — el cliente nunca escribe PII en claro ni recibe ciphertext.

**Tech Stack:** React 18 + Vite, Supabase JS v2, react-router-dom v6, Supabase Edge Functions (Deno), PostgreSQL (Supabase), AES-256-GCM (Web Crypto API en Edge Functions)

---

## Decisiones de diseño

### PII — qué se cifra
- `client_name`, `client_address`, `client_phone` en `route_stops`
- `origin` en `routes` (puede ser domicilio del técnico)
- `groq_api_key`, `google_maps_key` en `user_settings`
- Todo lo demás (métricas, tiempos, distancias) se guarda en claro

### Clave de cifrado
- Variable de entorno `ENCRYPTION_KEY` (32 bytes hex) en las Edge Functions de Supabase
- Nunca sale del runtime de la Edge Function
- Un atacante con acceso a la BD solo ve bytes cifrados

### Row Level Security (RLS)
- Activado en todas las tablas
- Política: `user_id = auth.uid()` — cada usuario solo accede a sus propias filas

### Historial
- Página separada en `/historial` via `react-router-dom`
- Nuevo componente `HistoryPage.jsx`
- El componente `App.jsx` existente pasa a ser la ruta `/`

---

## Base de datos (4 tablas)

```sql
-- user_settings: una fila por usuario
CREATE TABLE user_settings (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  groq_api_key   TEXT,          -- cifrado AES-256-GCM (base64)
  google_maps_key TEXT,         -- cifrado AES-256-GCM (base64)
  consumption    NUMERIC(5,2),  -- l/100km, en claro
  fuel_price     NUMERIC(5,3),  -- €/l, en claro
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- routes: una fila por optimización guardada
CREATE TABLE routes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  origin         TEXT,          -- cifrado (dirección de salida)
  total_km       NUMERIC(6,1),
  saving_minutes INTEGER,
  end_time       TEXT,
  worker_count   INTEGER DEFAULT 1
);

-- route_stops: paradas de cada ruta
CREATE TABLE route_stops (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id       UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,
  client_name    TEXT,          -- CIFRADO
  client_address TEXT,          -- CIFRADO
  client_phone   TEXT,          -- CIFRADO
  duration_min   INTEGER,
  window_type    TEXT,          -- 'fija' | 'flexible' en claro
  window_start   TEXT,
  window_end     TEXT,
  arrival_time   TEXT,
  travel_minutes INTEGER
);
```

### Políticas RLS

```sql
-- Aplicar a las 3 tablas:
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops   ENABLE ROW LEVEL SECURITY;

-- user_settings: acceso propio
CREATE POLICY "own settings" ON user_settings
  USING (user_id = auth.uid());

-- routes: acceso propio
CREATE POLICY "own routes" ON routes
  USING (user_id = auth.uid());

-- route_stops: acceso via route propia
CREATE POLICY "own stops" ON route_stops
  USING (route_id IN (SELECT id FROM routes WHERE user_id = auth.uid()));
```

---

## Edge Functions (2 funciones Deno)

### `save-route` — POST
Recibe la ruta completa con PII en claro, cifra los campos sensibles, escribe en DB.

**Input:**
```json
{
  "origin": "Calle Mayor 1, Madrid",
  "total_km": 32.4,
  "saving_minutes": 47,
  "end_time": "17:52",
  "worker_count": 1,
  "stops": [
    {
      "position": 1,
      "client_name": "María García",
      "client_address": "Calle de Alcalá 120 Madrid",
      "client_phone": "+34 612 345 678",
      "duration_min": 60,
      "window_type": "fija",
      "window_start": "09:00",
      "window_end": "10:00",
      "arrival_time": "09:15",
      "travel_minutes": 8
    }
  ]
}
```

**Proceso:** cifra `origin`, `client_name`, `client_address`, `client_phone` con AES-256-GCM → inserta en `routes` + `route_stops`.

**Output:** `{ "route_id": "uuid" }`

### `get-routes` — GET
Lee el historial del usuario autenticado, descifra PII, devuelve JSON.

**Output:**
```json
[
  {
    "id": "uuid",
    "created_at": "2026-05-27T10:00:00Z",
    "origin": "Calle Mayor 1, Madrid",
    "total_km": 32.4,
    "saving_minutes": 47,
    "end_time": "17:52",
    "worker_count": 1,
    "stops": [{ "position": 1, "client_name": "María García", ... }]
  }
]
```

### `save-settings` — POST
Cifra `groq_api_key` y `google_maps_key`, hace upsert en `user_settings`.

### `get-settings` — GET
Lee `user_settings` del usuario, descifra las keys, devuelve en claro.

---

## Flujo de autenticación

```
1. Usuario abre app → supabase.auth.getSession()
2. Sin sesión → <LoginPage> con botón "Continuar con Google"
3. Click → supabase.auth.signInWithOAuth({ provider: 'google' })
4. Callback → Supabase redirige a /?code=...
5. Supabase JS intercambia el code → sesión activa
6. App carga: llama a get-settings → rellena API keys y config vehículo
7. Usuario ya puede optimizar rutas
```

---

## Cambios en el frontend

### Archivos nuevos
- `src/utils/supabaseClient.js` — init del cliente Supabase
- `src/pages/LoginPage.jsx` — pantalla de login (botón Google)
- `src/pages/HistoryPage.jsx` — lista de rutas guardadas + detalle
- `supabase/functions/save-route/index.ts`
- `supabase/functions/get-routes/index.ts`
- `supabase/functions/save-settings/index.ts`
- `supabase/functions/get-settings/index.ts`

### Archivos modificados
- `src/main.jsx` — añadir `BrowserRouter` de react-router-dom
- `src/App.jsx` — envolver en `<Routes>`, añadir ruta `/historial`, comprobar sesión al iniciar, guardar ruta tras optimización, cargar settings al login

### Variables de entorno (`.env`)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Dependencias a añadir
```
@supabase/supabase-js
react-router-dom
```

---

## Pantalla de historial (`/historial`)

- Lista de rutas ordenadas por fecha descendente
- Cada fila: fecha, nº paradas, km totales, minutos ahorrados, nº trabajadores
- Click en una fila → expande detalle con la secuencia completa (nombre, dirección, teléfono descifrados)
- Botón "← Volver" regresa a la app principal
- Botón "Cerrar sesión" en la cabecera (visible en ambas páginas)

---

## Lo que NO cambia

- Todos los componentes existentes: `RouteMap`, `OrderList`, `ResultsPanel`, `WorkerPanel`, `CsvUpload`, `DemoTour`
- La lógica de optimización (Groq API)
- La lógica de rutas reales (Google Directions)
- El CSS existente (solo se añaden estilos para login e historial)
