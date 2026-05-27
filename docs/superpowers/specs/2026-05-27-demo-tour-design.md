# Demo Tour — Design Spec

**Date:** 2026-05-27  
**Status:** Approved

---

## Goal

Add a guided sales demo mode activated by a "Demo" button in the app header. The tour walks a potential client through the app's key features step by step, with a spotlight on each element and commercial copy explaining the business value.

---

## Architecture

Single-page React app — all client-side. No backend changes.

**New files:**
- `src/components/DemoTour.jsx` — renders the spotlight overlay, tooltip, and navigation buttons via a React portal mounted on `document.body`
- `src/utils/demoSteps.js` — exports the array of 10 step definitions (selector, title, body text, tooltip position preference)

**Modified files:**
- `src/App.jsx` — adds `demoStep` state (null = inactive, 0–9 = active step), `handleDemoStart` / `handleDemoNext` / `handleDemoPrev` / `handleDemoClose` handlers, "Demo" button in header, auto-loads Madrid Centro CSV on tour start
- `src/index.css` — styles for overlay, spotlight div, tooltip panel, navigation buttons

---

## Data Model

### Step definition

```js
{
  selector: '.btn-optimize',     // CSS selector for the target element (null for step 0)
  title: 'Un clic, ruta perfecta',
  body: 'La IA analiza todas las combinaciones posibles, respeta las ventanas horarias fijas y minimiza los kilómetros.',
  position: 'top',               // preferred tooltip position: 'top' | 'bottom' | 'left' | 'right'
}
```

### App state addition

```js
const [demoStep, setDemoStep] = useState(null) // null = tour inactive
```

---

## The 10 Steps

| # | selector | Title | Body | Position |
|---|----------|-------|------|----------|
| 0 | `null` | Bienvenido a RouteTech | "Optimización de rutas con IA para equipos de campo. En menos de 30 segundos tendrás la ruta perfecta para todo tu equipo." | center (modal) |
| 1 | `.drop-zone` | Importa tus órdenes | "Carga un Excel o CSV con tus órdenes del día. Sin formación especial — el mismo formato que ya usas." | right |
| 2 | `.ot-list` | Tus órdenes, al detalle | "Cada visita con su duración, cliente y ventana horaria. Puedes editar cualquier dato antes de optimizar." | right |
| 3 | `.origin-row` | Define dónde empieza el día | "El técnico sale desde su casa, almacén o cualquier dirección. También detecta su ubicación GPS." | right |
| 4 | `.btn-optimize` | Un clic, ruta perfecta | "La IA analiza todas las combinaciones posibles, respeta las ventanas horarias fijas y minimiza los kilómetros." | top |
| 5 | `.leaflet-container` | Ruta real con tráfico | "No estimaciones — kilómetros y tiempos reales usando Google Maps con tráfico en tiempo real." | left |
| 6 | `.savings-table` | Lo que ahorras, en números | "Minutos ganados, kilómetros menos y ahorro en combustible calculados automáticamente." | left |
| 7 | `.call-section` | Renegocia antes de salir | "La IA detecta qué clientes conviene llamar para mover su cita y hacer la ruta aún más eficiente." | left |
| 8 | `[data-tour="multi-demo"]` | Para equipos completos | "¿Varios técnicos? Carga todas sus órdenes juntas y la IA las distribuye para que todos terminen a la vez." | top |
| 9 | `.worker-breakdown` | Balanceo automático de carga | "Sin jefes de equipo calculando a mano — la IA reasigna órdenes entre trabajadores para equilibrar la jornada." | left |

Steps 8 and 9 target multi-worker UI elements. If those elements are not present in the DOM at that step (e.g. optimization hasn't been run), the spotlight is skipped and the tooltip renders centered.

---

## UI — DemoTour Component

### Spotlight

A `<div>` is positioned absolutely over the target element using `getBoundingClientRect()`. The spotlight effect is achieved with an oversized `box-shadow`:

```css
.demo-spotlight {
  position: fixed;
  pointer-events: none;
  border-radius: 6px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65);
  transition: all 0.3s ease;
  z-index: 9998;
}
```

The div's `top`, `left`, `width`, `height` are set via inline styles matching the target element's bounding rect (with 8px padding on each side).

### Tooltip panel

A `<div className="demo-tooltip">` positioned adjacent to the spotlight. Contains:

```
[Step counter]  3 / 10
[Title]         Un clic, ruta perfecta
[Body]          La IA analiza todas las combinaciones posibles...
[Buttons]       ← Anterior    Siguiente →    [✕ Saltar]
```

Positioning logic (in order of preference):
1. Use the step's declared `position` preference
2. If the tooltip would overflow the viewport, flip to the opposite side
3. Clamp to viewport edges with 16px margin

### Step 0 — Welcome modal

Step 0 has `selector: null`. Instead of a spotlight, a centered modal appears (no dark overlay around a specific element — full overlay with a white card in the center). Contains the logo, title, body text, and a single "Empezar →" button.

### Navigation

All navigation is manual. The user always advances with the buttons:
- **← Anterior** — disabled on step 0
- **Siguiente →** — on last step, becomes **Finalizar** and closes the tour
- **✕ Saltar** — closes the tour from any step, small text link in corner

---

## Demo Button

In the App.jsx header, a button styled differently from the optimize button:

```jsx
<button className="btn-demo-start" onClick={handleDemoStart}>
  ▶ Demo
</button>
```

The button is always visible regardless of app state.

---

## handleDemoStart

```js
const handleDemoStart = useCallback(() => {
  handleOrders(DEMO_ORDERS_CENTRO)   // pre-parsed array, resets to single-worker mode
  setDemoStep(0)
}, [handleOrders])
```

`DEMO_ORDERS_CENTRO` is exported from `CsvUpload.jsx` as a named export — the already-parsed `Order[]` array derived from `DEMO_CSV`. This avoids duplicating the CSV string or the parse logic.

```js
// In CsvUpload.jsx — add this named export:
export const DEMO_ORDERS_CENTRO = parseCSVText(DEMO_CSV)
```

App.jsx imports it: `import CsvUpload, { DEMO_ORDERS_CENTRO } from './components/CsvUpload'`

Also, add `data-tour="multi-demo"` attribute to the "2 Trabajadores" button in CsvUpload.jsx so the step 8 selector works.

---

## Positioning Algorithm

```js
function getTooltipStyle(spotlightRect, position, tooltipSize) {
  const GAP = 16
  const { top, left, bottom, right, width, height } = spotlightRect

  if (position === 'top')    return { top: top - tooltipSize.height - GAP, left: left + width / 2 - tooltipSize.width / 2 }
  if (position === 'bottom') return { top: bottom + GAP, left: left + width / 2 - tooltipSize.width / 2 }
  if (position === 'left')   return { top: top + height / 2 - tooltipSize.height / 2, left: left - tooltipSize.width - GAP }
  if (position === 'right')  return { top: top + height / 2 - tooltipSize.height / 2, left: right + GAP }
}
// After computing, clamp: Math.max(16, Math.min(pos, viewport - size - 16))
```

---

## CSS Classes

```
.btn-demo-start        — header demo button
.demo-overlay          — full-screen fixed div (pointer-events: none, z-index: 9997)
.demo-spotlight        — positioned spotlight div (z-index: 9998)
.demo-tooltip          — tooltip panel (z-index: 9999, pointer-events: all)
.demo-tooltip-step     — "3 / 10" counter
.demo-tooltip-title    — bold title
.demo-tooltip-body     — descriptive text
.demo-tooltip-actions  — flex row with buttons
.demo-btn-prev         — ← Anterior button
.demo-btn-next         — Siguiente → / Finalizar button
.demo-btn-skip         — ✕ Saltar link
.demo-welcome-modal    — centered card for step 0
```

---

## Backward Compatibility

- Tour only activates on explicit button press — zero impact on normal app usage
- `demoStep === null` → DemoTour not rendered at all (no overhead)
- Loading demo CSV on tour start resets any existing state (same as clicking "Madrid Centro" manually)

---

## Out of Scope

- Auto-advancing steps based on app events (future)
- Persisting tour progress across page reloads (not needed for sales demo)
- Multiple tour scripts / languages (one script, Spanish only)
- Analytics / tracking which steps users reach (future)
