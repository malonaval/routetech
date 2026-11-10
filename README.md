# RouteTech

MVP de optimización de rutas para técnicos de campo. Aplicación web con mapa, historial de rutas y autenticación.

**Demo:** https://routetech.vercel.app

## Stack

- React 18 + Vite 5
- React Router 7
- Leaflet / react-leaflet (mapas)
- Supabase (autenticación, base de datos y funciones en `supabase/functions`)
- Despliegue en Vercel

## Estructura

```
src/
  App.jsx          # Pantalla principal y lógica de rutas
  pages/           # LoginPage, HistoryPage
  components/
  utils/
supabase/          # config.toml y edge functions
docs/              # Notas de diseño
```

## Arranque en local

```bash
npm install
cp .env.example .env   # rellena las claves
npm run dev
```

Otros comandos: `npm run build` y `npm run preview`.

## Variables de entorno

| Variable | Uso |
|---|---|
| `VITE_GROQ_KEY` | Clave de Groq |
| `VITE_GOOGLE_KEY` | Clave de Google |

> Ojo: las variables con prefijo `VITE_` se incluyen en el bundle del navegador y quedan visibles para cualquiera. Para claves de pago o sin restricción, mueve las llamadas a una función de Supabase (`supabase/functions`) o restringe la clave por dominio.

## Mejoras previstas

- Trocear `App.jsx` en componentes más pequeños.
- Añadir tests y CI.
- Capturas de pantalla en este README.
