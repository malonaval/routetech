# Route Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second demo route (Madrid Norte), configurable fuel savings, inline time window editing with pending-changes UX, and AI-powered call recommendations for fixed-window clients.

**Architecture:** All features are additive to the existing React + Vite app. State additions go in `App.jsx` (`pendingEdits`, `consumption`, `fuelPrice`). UI changes are isolated to their respective components. The Groq prompt is extended to return two new JSON fields (`call_suggestions`, `savings_breakdown`). No new files are created — all changes are edits to existing files plus CSS additions.

**Tech Stack:** React 18, Vite, lucide-react, localStorage for persistence, Groq API (llama-3.3-70b-versatile)

---

## File Map

| File | Change |
|---|---|
| `src/components/CsvUpload.jsx` | Add `DEMO_CSV_NORTE`, replace single demo button with two buttons |
| `src/App.jsx` | Add `pendingEdits`, `consumption`, `fuelPrice` state; fuel config UI section; merge edits before Groq call; pass new props down |
| `src/utils/groqApi.js` | Extend prompt + JSON schema for `call_suggestions` and `savings_breakdown` |
| `src/components/OrderList.jsx` | Inline editing UI per row, pending change indicators |
| `src/components/ResultsPanel.jsx` | Savings breakdown table + call recommendations section |
| `src/index.css` | Styles for amber pending state, savings table, call suggestion rows, two-button demo layout, fuel config inputs |

---

## Task 1: Second Demo Route (Madrid Norte)

**Files:**
- Modify: `src/components/CsvUpload.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add DEMO_CSV_NORTE constant** in `CsvUpload.jsx`, after the existing `DEMO_CSV` constant:

```jsx
const DEMO_CSV_NORTE = `cliente,direccion,duracion_min,ventana_tipo,ventana_inicio,ventana_fin
Elena Vázquez,Calle de Silvano 12 Madrid,60,fija,09:00,10:00
Roberto Iglesias,Avenida de Manoteras 34 Madrid,45,flexible,,
Sofía Castro,Calle de Arturo Soria 180 Madrid,30,fija,11:00,12:00
Javier Morales,Calle del Mar Egeo 8 Madrid,45,flexible,,
Patricia Núñez,Avenida de San Luis 45 Madrid,60,flexible,,
Andrés Herrero,Calle de Sanchinarro 23 Madrid,30,fija,13:30,14:30
Lucía Domínguez,Calle de las Tablas 67 Madrid,45,flexible,,
Manuel Romero,Avenida de Montecarmelo 15 Madrid,30,flexible,,
Teresa Alonso,Calle del Padre Damián 28 Madrid,60,fija,16:00,17:00
Gonzalo Reyes,Calle de Hortaleza 120 Madrid,45,flexible,,`
```

- [ ] **Step 2: Add `loadDemo` handler for Norte** and rename existing one. Replace the existing `loadDemo` function and button with:

```jsx
const loadDemoCentro = () => {
  const orders = parseCSVText(DEMO_CSV)
  if (orders.length) onOrdersLoaded(orders)
}

const loadDemoNorte = () => {
  const orders = parseCSVText(DEMO_CSV_NORTE)
  if (orders.length) onOrdersLoaded(orders)
}
```

- [ ] **Step 3: Replace single demo button with two buttons** in the JSX return:

```jsx
<div className="demo-btn-row">
  <button className="btn-demo" onClick={loadDemoCentro}>
    <Zap size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
    Madrid Centro
  </button>
  <button className="btn-demo" onClick={loadDemoNorte}>
    <Zap size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
    Madrid Norte
  </button>
</div>
```

- [ ] **Step 4: Add CSS for two-button row** at the end of `src/index.css`:

```css
/* ─── DEMO BUTTONS ROW ───────────────────────────────────────────────────── */
.demo-btn-row {
  display: flex;
  gap: 8px;
}
.demo-btn-row .btn-demo {
  flex: 1;
}
```

- [ ] **Step 5: Verify** — open app, load Madrid Norte, confirm 10 clients appear with correct names and addresses.

- [ ] **Step 6: Commit**
```
git add src/components/CsvUpload.jsx src/index.css
git commit -m "feat: add Madrid Norte demo route with 10 dispersed clients"
```

---

## Task 2: Fuel Config State + UI

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add imports** at the top of `App.jsx`. Add `Fuel` to the lucide-react import:

```jsx
import { Key, AlertTriangle, Map, Circle, LocateFixed, Fuel } from 'lucide-react'
```

- [ ] **Step 2: Add state for consumption and fuel price** in `App.jsx`, after the `googleKey` state line:

```jsx
const [consumption, setConsumption] = useState(() => parseFloat(localStorage.getItem('rt_consumption')) || 9)
const [fuelPrice,   setFuelPrice]   = useState(() => parseFloat(localStorage.getItem('rt_fuel_price'))  || 1.65)
```

- [ ] **Step 3: Add save helpers** for the new fields. Existing `saveKey` works for strings; add numeric savers after the `saveKey` function:

```jsx
const saveNum = (storageKey, value, setter) => {
  const n = parseFloat(value) || 0
  setter(n)
  localStorage.setItem(storageKey, n)
}
```

- [ ] **Step 4: Add fuel config UI section** in the JSX, between the Google Maps API Key section and the CsvUpload component:

```jsx
{/* ── Vehículo / Combustible ── */}
<div className="panel-section">
  <div className="section-label">
    <Fuel size={13} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--muted)' }} />
    Vehículo
  </div>
  <div className="fuel-row">
    <div className="fuel-field">
      <label className="fuel-label">Consumo</label>
      <div className="fuel-input-wrap">
        <input
          type="number"
          className="fuel-input"
          value={consumption}
          min="1" max="30" step="0.5"
          onChange={e => saveNum('rt_consumption', e.target.value, setConsumption)}
        />
        <span className="fuel-unit">l/100km</span>
      </div>
    </div>
    <div className="fuel-field">
      <label className="fuel-label">Precio</label>
      <div className="fuel-input-wrap">
        <input
          type="number"
          className="fuel-input"
          value={fuelPrice}
          min="0.5" max="5" step="0.01"
          onChange={e => saveNum('rt_fuel_price', e.target.value, setFuelPrice)}
        />
        <span className="fuel-unit">€/l</span>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Pass props to ResultsPanel** — update the `RouteMap` section where `ResultsPanel` receives props. Find the `RouteMap` component call and note that `ResultsPanel` is rendered inside `RouteMap.jsx`. We need to pass `consumption` and `fuelPrice` through `RouteMap` to `ResultsPanel`. Update the `RouteMap` call in `App.jsx`:

```jsx
<RouteMap
  originAddress={origin}
  originCoords={originCoords}
  stopCoords={stopCoords}
  routePolyline={routePolyline}
  loading={loading}
  loadingLogs={loadingLogs}
  error={error}
  result={result}
  highlightedId={highlightedId}
  onHighlight={handleHighlight}
  consumption={consumption}
  fuelPrice={fuelPrice}
/>
```

- [ ] **Step 6: Update RouteMap.jsx** to forward `consumption` and `fuelPrice` to `ResultsPanel`. In `RouteMap.jsx`, destructure the new props and pass them to `ResultsPanel`:

```jsx
export default function RouteMap({
  originAddress,
  originCoords,
  stopCoords,
  routePolyline,
  loading,
  loadingLogs,
  error,
  result,
  highlightedId,
  onHighlight,
  consumption,
  fuelPrice,
}) {
```

And update the `ResultsPanel` call at the bottom of `RouteMap.jsx`:

```jsx
<ResultsPanel result={result} hasRealRoute={!!routePolyline} consumption={consumption} fuelPrice={fuelPrice} />
```

- [ ] **Step 7: Add CSS for fuel config** at the end of `src/index.css`:

```css
/* ─── FUEL CONFIG ────────────────────────────────────────────────────────── */
.fuel-row {
  display: flex;
  gap: 12px;
}
.fuel-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fuel-label {
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--muted);
  text-transform: uppercase;
}
.fuel-input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 0;
  overflow: hidden;
}
.fuel-input {
  flex: 1;
  border: none;
  padding: 7px 8px;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  color: var(--text);
  background: var(--bg);
  width: 0;
  outline: none;
}
.fuel-unit {
  font-size: 9px;
  color: var(--muted);
  padding: 0 8px;
  background: var(--surface2);
  border-left: 1px solid var(--border);
  height: 100%;
  display: flex;
  align-items: center;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
```

- [ ] **Step 8: Verify** — fuel inputs appear in sidebar, values persist on reload.

- [ ] **Step 9: Commit**
```
git add src/App.jsx src/components/RouteMap.jsx src/index.css
git commit -m "feat: add configurable fuel consumption and price to sidebar"
```

---

## Task 3: Extend Groq Prompt

**Files:**
- Modify: `src/utils/groqApi.js`

- [ ] **Step 1: Add `call_suggestions` and `savings_breakdown` to the JSON schema** in the prompt string. Find the closing `}` of the prompt template and replace it with:

```js
  "savings_breakdown": {
    "original_estimated_mins": 180,
    "optimised_mins": 120,
    "original_estimated_km": 67,
    "optimised_km": 46
  },
  "call_suggestions": [
    {
      "ot_id": "OT-XXXX",
      "cliente": "nombre",
      "current_window": "09:00–10:00",
      "potential_saving_minutes": 18,
      "reason": "Liberando su ventana se ganaría 18 min agrupando con clientes del mismo barrio"
    }
  ]
}`
```

- [ ] **Step 2: Update system message** to instruct the model on `call_suggestions`. Replace the existing system content string:

```js
content: 'Eres un optimizador de rutas para técnicos de campo en Madrid. El campo "reasoning" debe ser específico: nombra qué clientes tienen ventana fija y por qué condicionan el orden, qué clientes flexibles se agruparon por zona geográfica, y cuánto tiempo se ahorra frente al orden original. Usa los nombres reales de los clientes y sus calles. El campo "call_suggestions" lista SOLO clientes con ventana_tipo "fija", ordenados por potential_saving_minutes descendente — calcula cuántos minutos se ganarían si ese cliente liberase su ventana. El campo "savings_breakdown" usa estimaciones realistas de Madrid. Responde ÚNICAMENTE con JSON válido, sin texto ni markdown adicional.',
```

- [ ] **Step 3: Verify** — after running an optimization, open browser DevTools → Network → find the Groq response → confirm the JSON contains `call_suggestions` and `savings_breakdown` fields.

- [ ] **Step 4: Commit**
```
git add src/utils/groqApi.js
git commit -m "feat: extend Groq prompt to return call_suggestions and savings_breakdown"
```

---

## Task 4: Inline Time Window Editing

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/OrderList.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add `pendingEdits` state** in `App.jsx`, after the `highlightedId` state:

```jsx
const [pendingEdits, setPendingEdits] = useState({}) // { [orderId]: { ventana_tipo, ventana_inicio, ventana_fin } }
```

- [ ] **Step 2: Add `handleEditOrder` callback** in `App.jsx`, after `handleHighlight`:

```jsx
const handleEditOrder = useCallback((id, changes) => {
  setPendingEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...changes } }))
}, [])

const handleClearEdits = useCallback(() => {
  setPendingEdits({})
}, [])
```

- [ ] **Step 3: Merge `pendingEdits` into orders before Groq call** in `App.jsx`. Inside `handleOptimize`, replace the first line after `setLoading(true)` block, change the `callGroqAPI` call to use merged orders:

```jsx
// Merge pending edits into orders before sending to AI
const mergedOrders = orders.map(o =>
  pendingEdits[o.id] ? { ...o, ...pendingEdits[o.id] } : o
)
const aiResult = await callGroqAPI(groqKey, origin.trim(), mergedOrders)
```

Also clear pending edits after successful optimization:
```jsx
setResult(aiResult)
setPendingEdits({})
```

- [ ] **Step 4: Pass new props to `OrderList`** in `App.jsx`:

```jsx
<OrderList
  orders={displayOrders}
  result={result}
  stopCoords={stopCoords}
  highlightedId={highlightedId}
  onFocusStop={handleFocusStop}
  pendingEdits={pendingEdits}
  onEditOrder={handleEditOrder}
/>
```

- [ ] **Step 5: Update the optimize button** in `App.jsx` to reflect pending changes. Replace the existing button:

```jsx
<div className="opt-wrap">
  {Object.keys(pendingEdits).length > 0 && (
    <div className="pending-banner">
      {Object.keys(pendingEdits).length} orden{Object.keys(pendingEdits).length > 1 ? 'es' : ''} modificada{Object.keys(pendingEdits).length > 1 ? 's' : ''}
      <button className="pending-clear" onClick={handleClearEdits}>Deshacer</button>
    </div>
  )}
  <button
    className={`btn-optimize${Object.keys(pendingEdits).length > 0 ? ' btn-recalculate' : ''}`}
    onClick={handleOptimize}
    disabled={!canOptimize}
  >
    {Object.keys(pendingEdits).length > 0 ? 'Recalcular con cambios' : 'Calcular ruta óptima'}
    <span className="btn-sub">
      {!groqKey
        ? 'Configura tu Groq API Key primero'
        : googleKey
        ? 'IA + Google Maps con tráfico real'
        : 'IA · estimación sin tráfico real'}
    </span>
  </button>
</div>
```

- [ ] **Step 6: Add inline editing to `OrderList.jsx`**. Add `pendingEdits` and `onEditOrder` to destructured props. Add `editingId` local state to track which row is being edited:

```jsx
import { Check, Navigation, Map, Cpu, X, Clock } from 'lucide-react'
import { useState } from 'react'

export default function OrderList({ orders, result, stopCoords = [], highlightedId, onFocusStop, pendingEdits = {}, onEditOrder }) {
  const [editingId, setEditingId] = useState(null)
  const legByOrderId = Object.fromEntries(
    stopCoords.filter(s => s.googleLeg).map(s => [s.order.id, s.googleLeg])
  )
```

- [ ] **Step 7: Replace the time column in each row** with an editable version. Inside the `.ot-time` div, replace its content:

```jsx
<div className="ot-time" onClick={e => { e.stopPropagation(); setEditingId(editingId === order.id ? null : order.id) }}>
  {editingId === order.id ? (
    <div className="time-edit" onClick={e => e.stopPropagation()}>
      <input
        className="time-input"
        type="time"
        value={(pendingEdits[order.id]?.ventana_inicio ?? order.ventana_inicio) || ''}
        onChange={e => onEditOrder(order.id, { ventana_inicio: e.target.value, ventana_tipo: 'fija' })}
        placeholder="--:--"
      />
      <span className="time-sep">→</span>
      <input
        className="time-input"
        type="time"
        value={(pendingEdits[order.id]?.ventana_fin ?? order.ventana_fin) || ''}
        onChange={e => onEditOrder(order.id, { ventana_fin: e.target.value, ventana_tipo: 'fija' })}
        placeholder="--:--"
      />
      <button
        className="time-clear-btn"
        title="Convertir a flexible"
        onClick={() => { onEditOrder(order.id, { ventana_tipo: 'flexible', ventana_inicio: '', ventana_fin: '' }); setEditingId(null) }}
      >
        <X size={10} strokeWidth={2} />
      </button>
    </div>
  ) : (
    <>
      {seqStop ? seqStop.arrival_time : ((pendingEdits[order.id]?.ventana_inicio ?? order.ventana_inicio) || '—')}
      {(pendingEdits[order.id]?.ventana_fin ?? order.ventana_fin) && (
        <div className="ot-win">→ {pendingEdits[order.id]?.ventana_fin ?? order.ventana_fin}</div>
      )}
      {googleLeg && (
        <div style={{ fontSize: '9px', color: 'var(--blue)', marginTop: '2px' }}>
          {googleLeg.distanceText}
        </div>
      )}
    </>
  )}
</div>
```

- [ ] **Step 8: Add pending row class** — update the row `className`:

```jsx
className={`ot-row${highlightedId === order.id ? ' highlighted' : ''}${pendingEdits[order.id] ? ' pending' : ''}`}
```

- [ ] **Step 9: Add CSS for editing and pending states** at the end of `src/index.css`:

```css
/* ─── INLINE EDITING ─────────────────────────────────────────────────────── */
.ot-row.pending {
  border-left: 2px solid #d97706;
}

.time-edit {
  display: flex;
  align-items: center;
  gap: 3px;
}

.time-input {
  font-size: 10px;
  font-family: 'Inter', sans-serif;
  border: 1px solid var(--border);
  padding: 2px 4px;
  color: var(--text);
  background: var(--bg);
  width: 58px;
  outline: none;
}
.time-input:focus { border-color: var(--text); }

.time-sep {
  font-size: 9px;
  color: var(--muted);
}

.time-clear-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  display: flex;
  align-items: center;
  padding: 2px;
}
.time-clear-btn:hover { color: #c0392b; }

/* ─── PENDING BANNER ─────────────────────────────────────────────────────── */
.pending-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #fef3c7;
  border: 1px solid #d97706;
  font-size: 10px;
  color: #92400e;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.pending-clear {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 9px;
  color: #92400e;
  text-decoration: underline;
  letter-spacing: 0.5px;
}

.btn-optimize.btn-recalculate {
  background: #d97706;
  border-color: #d97706;
}
.btn-optimize.btn-recalculate:hover:not(:disabled) {
  background: #b45309;
}
```

- [ ] **Step 10: Verify** — click a time in any order row → inputs appear; change a value → row gets amber border; pending banner appears with count; "Recalcular con cambios" button turns amber; × button converts to flexible.

- [ ] **Step 11: Commit**
```
git add src/App.jsx src/components/OrderList.jsx src/index.css
git commit -m "feat: inline time window editing with pending changes UX"
```

---

## Task 5: ResultsPanel — Savings Breakdown + Call Recommendations

**Files:**
- Modify: `src/components/ResultsPanel.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Rewrite `ResultsPanel.jsx`** to consume the new fields and accept `consumption`/`fuelPrice` props:

```jsx
import { Map, Cpu, Phone, ChevronRight } from 'lucide-react'

export default function ResultsPanel({ result, hasRealRoute, consumption = 9, fuelPrice = 1.65, onFocusStop }) {
  if (!result) return null

  const sb = result.savings_breakdown
  const savedKm = sb ? (sb.original_estimated_km - sb.optimised_km) : null
  const savedMins = result.saving_minutes ?? (sb ? sb.original_estimated_mins - sb.optimised_mins : null)
  const fuelSaved = savedKm != null
    ? ((savedKm * consumption / 100) * fuelPrice).toFixed(2)
    : null

  return (
    <div className="reasoning-card">
      {/* ── Savings breakdown ── */}
      {(savedMins != null || savedKm != null) && (
        <div className="savings-table">
          {savedMins != null && (
            <div className="savings-row">
              <span className="savings-label">Tiempo ahorrado</span>
              <span className="savings-val">{savedMins} min</span>
            </div>
          )}
          {savedKm != null && (
            <div className="savings-row">
              <span className="savings-label">Kilómetros menos</span>
              <span className="savings-val">{savedKm} km</span>
            </div>
          )}
          {fuelSaved != null && (
            <div className="savings-row savings-row--fuel">
              <span className="savings-label">Ahorro combustible</span>
              <span className="savings-val savings-val--fuel">{fuelSaved} €</span>
            </div>
          )}
        </div>
      )}

      {/* ── Reasoning ── */}
      <div className="reasoning-title">
        {hasRealRoute
          ? <><Map size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />Ruta real · Google Maps</>
          : <><Cpu size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />Razonamiento IA</>
        }
      </div>
      <div className="reasoning-text">{result.reasoning}</div>
      {hasRealRoute && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.5px' }}>
          Tiempos calculados con tráfico en tiempo real
        </div>
      )}

      {/* ── Call recommendations ── */}
      {result.call_suggestions?.length > 0 && (
        <div className="call-section">
          <div className="call-title">
            <Phone size={11} strokeWidth={1.5} />
            Llamadas recomendadas
          </div>
          {result.call_suggestions.map(s => (
            <div
              key={s.ot_id}
              className="call-row"
              onClick={() => onFocusStop?.(s.ot_id)}
            >
              <div className="call-info">
                <div className="call-client">{s.cliente}</div>
                <div className="call-window">{s.current_window}</div>
                <div className="call-reason">{s.reason}</div>
              </div>
              <div className="call-saving">
                <span className="call-saving-val">+{s.potential_saving_minutes} min</span>
                <ChevronRight size={12} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Pass `onFocusStop` from `RouteMap` to `ResultsPanel`**. In `RouteMap.jsx`, add `onFocusStop` to props and forward it:

```jsx
export default function RouteMap({
  // ... existing props ...
  consumption,
  fuelPrice,
  onFocusStop,
}) {
```

And update the `ResultsPanel` call:
```jsx
<ResultsPanel result={result} hasRealRoute={!!routePolyline} consumption={consumption} fuelPrice={fuelPrice} onFocusStop={onFocusStop} />
```

- [ ] **Step 3: Pass `onFocusStop` from `App.jsx` to `RouteMap`**. In `App.jsx`, add to the `RouteMap` call:

```jsx
<RouteMap
  {/* ...existing props... */}
  consumption={consumption}
  fuelPrice={fuelPrice}
  onFocusStop={handleFocusStop}
/>
```

- [ ] **Step 4: Add CSS for savings table and call recommendations** at the end of `src/index.css`:

```css
/* ─── SAVINGS TABLE ──────────────────────────────────────────────────────── */
.savings-table {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.savings-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.savings-label {
  font-size: 10px;
  color: var(--muted2);
  letter-spacing: 0.3px;
}

.savings-val {
  font-family: 'Cormorant Garamond', serif;
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}

.savings-row--fuel .savings-label {
  color: var(--text);
  font-weight: 500;
}

.savings-val--fuel {
  color: #16a34a;
}

/* ─── CALL RECOMMENDATIONS ───────────────────────────────────────────────── */
.call-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.call-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 8px;
}

.call-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  gap: 8px;
}
.call-row:last-child { border-bottom: none; }
.call-row:hover { background: var(--accent-dim); margin: 0 -12px; padding: 8px 12px; }

.call-info { flex: 1; min-width: 0; }

.call-client {
  font-size: 11px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.call-window {
  font-size: 10px;
  color: var(--muted2);
  margin-top: 1px;
}

.call-reason {
  font-size: 9px;
  color: var(--muted);
  margin-top: 3px;
  line-height: 1.4;
}

.call-saving {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.call-saving-val {
  font-family: 'Cormorant Garamond', serif;
  font-size: 15px;
  color: #16a34a;
  font-weight: 500;
}
```

- [ ] **Step 5: Verify** — run an optimization → savings table shows time, km and fuel saving → call recommendations appear below reasoning → clicking a recommendation highlights that order in the list.

- [ ] **Step 6: Commit**
```
git add src/components/ResultsPanel.jsx src/components/RouteMap.jsx src/App.jsx src/index.css
git commit -m "feat: savings breakdown table, fuel cost saving, and call recommendations panel"
```

---

## Task 6: Final Push + PR Update

- [ ] **Step 1: Build to confirm no errors**
```
npm run build
```
Expected: `✓ built in Xs` with no errors.

- [ ] **Step 2: Push branch**
```
git push origin feature/route-enhancements
```

- [ ] **Step 3: Verify PR** at https://github.com/malonaval/routetech/pull/1 — all commits should appear.

---

## Self-Review

**Spec coverage:**
- [x] Second demo route (Madrid Norte) → Task 1
- [x] Two demo buttons → Task 1 Step 3
- [x] Fuel config (consumption + price, localStorage) → Task 2
- [x] Savings breakdown (time, km, fuel €) → Task 5
- [x] `call_suggestions` in Groq response → Task 3
- [x] Inline time window editing → Task 4
- [x] Pending changes indicator (amber border + banner) → Task 4 Steps 8–9
- [x] "Recalcular con cambios" button → Task 4 Step 5
- [x] Edits merged before Groq call → Task 4 Step 3
- [x] Call recommendations panel → Task 5 Step 1
- [x] Clicking recommendation focuses order → Task 5 Steps 2–3

**Type consistency:** `pendingEdits` defined in Task 4 Step 1, consumed in Task 4 Steps 4–8 and Task 5 Step 1 (`onFocusStop`). `savings_breakdown` defined in Task 3, consumed in Task 5. `call_suggestions` defined in Task 3, consumed in Task 5. All consistent.

**Placeholder scan:** No TBDs, no "similar to Task N" references, all code blocks are complete.
