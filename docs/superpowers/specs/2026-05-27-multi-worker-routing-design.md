# Multi-Worker Route Optimization — Design Spec

**Date:** 2026-05-27  
**Status:** Approved

---

## Goal

Allow loading OTs for multiple field workers in a single CSV and let the AI optimize all routes simultaneously, reassigning OTs between workers to minimize total time and balance workload.

## Architecture

Single-page React app (no backend). All logic runs client-side: CSV parsing, AI call (Groq), geocoding (Google or Nominatim), per-leg Google Directions calls. State is lifted into App.jsx as today, extended for multiple workers.

---

## Data Model

### CSV Format

Two new optional columns added to the existing format:

```
cliente, direccion, duracion_min, ventana_tipo, ventana_inicio, ventana_fin, telefono, trabajador, horario
```

- `trabajador` — worker name/ID (e.g. "Carlos", "Ana"). Groups rows by worker.
- `horario` — worker's shift in `HH:MM-HH:MM` format (e.g. `09:00-18:00`). One value per worker; repeated on every row of that worker (parser takes first occurrence).

If `trabajador` column is absent the app falls back to single-worker mode (current behaviour).

### Worker object (internal)

```js
{
  id: 'Carlos',          // from CSV
  horario: '09:00-18:00',
  origin: '',            // filled in by user in UI
  originCoords: null,    // geocoded
  color: '#1d4e7a',      // assigned from palette
  orders: [...],         // OTs initially assigned to this worker
}
```

### App state additions

```js
const [workers, setWorkers] = useState([])           // WorkerObject[]
const [activeWorkerId, setActiveWorkerId] = useState(null)
const [workerResults, setWorkerResults] = useState({}) // { [workerId]: { sequence, stopCoords, routePolyline, ... } }
```

---

## UI

### Left Panel — Worker List (replaces single origin input when multi-worker)

After CSV load with `trabajador` column detected:

1. **Worker cards** — one per detected worker, showing:
   - Color dot + worker name
   - Horario label (e.g. `09:00–18:00`)
   - Origin input field (address, with geolocation button)
   - OT count badge

2. **Worker selector tabs** — clicking a worker card:
   - Filters the OT list below to that worker's assigned OTs (post-optimization: reasigned OTs)
   - Highlights that worker's route on the map, dims others

3. **OT list** — same as today, filtered by `activeWorkerId`

4. **Optimize button** — "Optimizar todas las rutas · IA + tráfico real"

### Map

- Each worker gets a color from a fixed palette (blue, red, green, orange, purple...)
- Pins: same color as their worker
- Polylines: same color, slightly transparent for non-active worker
- Clicking a pin focuses its worker in the left panel

### Results Panel (right sidebar)

- **Global summary:** total km, total saving minutes, total fuel cost
- **Per-worker breakdown:** name, end time, km, saving minutes, fuel cost
- **Reasoning:** AI explanation of reassignments
- **Call suggestions:** grouped by worker

---

## AI Prompt

Single Groq call. Prompt includes:

```
TRABAJADORES:
1. Carlos | Inicio: Calle X | Horario: 09:00-18:00
2. Ana    | Inicio: Calle Y | Horario: 08:00-17:00

ÓRDENES (asignación inicial orientativa, puedes reasignar):
1. ID:OT-2841 | Cliente:María García | Dir:... | Dur:60min | Ventana:fija(09:00-10:00) | Trabajador inicial: Carlos
...
```

System message instructs the AI to:
- Reassign OTs freely to balance workload
- Respect fixed time windows
- Minimize total time across all workers
- Keep each worker within their shift hours
- Explain reassignments in `reasoning`

### Response schema

```json
{
  "workers": [
    {
      "trabajador": "Carlos",
      "sequence": [
        { "position": 1, "ot_id": "OT-2841", "cliente": "...", "arrival_time": "09:15",
          "travel_minutes": 15, "transport": "coche", "window_type": "fija", "window_status": "en hora" }
      ],
      "total_km": 24,
      "total_mins_estimated": 180,
      "end_time": "17:30",
      "saving_minutes": 35
    }
  ],
  "global_saving_minutes": 63,
  "global_km": 45,
  "reasoning": "Se reasignó OT-2843 de Carlos a Ana porque...",
  "call_suggestions": [
    { "ot_id": "OT-2841", "trabajador": "Carlos", "cliente": "...",
      "current_window": "09:00-10:00", "suggested_time": "10:30",
      "potential_saving_minutes": 20, "reason": "..." }
  ],
  "savings_breakdown": {
    "original_estimated_mins": 420,
    "optimised_mins": 357,
    "original_estimated_km": 88,
    "optimised_km": 45
  }
}
```

---

## Google Routes

After AI responds, geocode all worker origins and all OT addresses in parallel. Then fire per-leg Directions API calls (as today) for each worker's route simultaneously using `Promise.all` across workers.

---

## Backward Compatibility

- CSV without `trabajador` column → single-worker mode, existing UI unchanged
- All current features (inline editing, pending edits, delete OT, call recommendations) work within the active worker's OT list

---

## Color Palette

```js
const WORKER_COLORS = ['#1d4e7a', '#8b2e2e', '#2e6b3e', '#7a5c1d', '#4a2e6b', '#1d6b6b']
```

---

## Out of Scope

- Worker skill/speciality matching (future)
- Login / per-user persistence (separate feature)
- More than 6 workers in demo (palette covers 6; extensible)
