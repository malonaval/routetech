# RouteTech — Route Enhancements Design
**Date:** 2026-05-26

## Overview
Four coordinated features to make the app more useful during an active workday: a second demo route, a visible savings breakdown with fuel cost, inline editing of time windows, and AI-powered call recommendations for fixed-window clients.

---

## 1. Second Demo Route — Madrid Norte

**10 residential clients** in Hortaleza, Sanchinarro, Las Tablas and Montecarmelo. Dispersed geography, ~55–65 km total. Mix: 4 fixed windows (morning and afternoon), 6 flexible — enough fixed clients to make the call recommendations feature visible.

**UI change:** `CsvUpload.jsx` shows two buttons instead of one:
- "Madrid Centro" — existing route
- "Madrid Norte" — new route

---

## 2. Savings Breakdown Panel

`ResultsPanel.jsx` gains a structured breakdown above the reasoning text:

| | Original order | Optimised route | Saving |
|---|---|---|---|
| Time | estimated total | `end_time` based | `saving_minutes` |
| Distance | estimated | `total_km` real | delta km |
| Fuel cost | — | — | delta km × consumption × price |

**Fuel configuration** — new panel section in the left sidebar (between API keys and CSV upload):
- "Consumo vehículo" input → default `9 l/100km`, saved to `localStorage` as `rt_consumption`
- "Precio combustible" input → default `1.65 €/l`, saved to `localStorage` as `rt_fuel_price`

Fuel saving is calculated client-side: `savedKm × (consumption/100) × fuelPrice`. Displayed as `€X.XX ahorrados en combustible`.

---

## 3. Inline Time Window Editing

**Interaction:** clicking the time area of any order row in `OrderList` makes `ventana_inicio` and `ventana_fin` editable inline. An "×" button removes the fixed window, converting the order to flexible.

**Pending changes state** managed in `App.jsx` as `pendingEdits: { [orderId]: { ventana_tipo, ventana_inicio, ventana_fin } }`.

**Visual feedback:**
- Edited rows get a left border in amber
- A small counter above the list: "X órdenes modificadas"
- The main CTA button changes text to **"Recalcular con cambios"** (amber accent) when `pendingEdits` is non-empty

**Scope:** edits apply only to the current session — the original CSV is never modified. On recalculate, `orders` state is merged with `pendingEdits` before sending to Groq.

---

## 4. Call Recommendations

**Groq prompt** updated to return a new field `call_suggestions`:
```json
"call_suggestions": [
  {
    "ot_id": "OT-2841",
    "cliente": "María García",
    "current_window": "09:00–10:00",
    "potential_saving_minutes": 18,
    "reason": "Liberando su ventana se ganaría 18 min al agrupar con clientes del mismo barrio"
  }
]
```
Ordered by `potential_saving_minutes` descending.

**UI:** new section in `ResultsPanel` below the reasoning, titled "Llamadas recomendadas". Each entry shows:
- Client name + current window
- Potential saving in minutes
- One-line reason

Clicking an entry scrolls the order list to that client and highlights it (reuses existing `onFocusStop` / `highlightedId` mechanism), opening its inline edit so the technician can immediately update the window.

---

## Component Changes Summary

| File | Change |
|---|---|
| `CsvUpload.jsx` | Add `DEMO_CSV_NORTE`, two demo buttons |
| `App.jsx` | Add `pendingEdits`, `consumption`, `fuelPrice` state; merge edits before API call; pass new props |
| `OrderList.jsx` | Inline editing UI, pending change indicators |
| `ResultsPanel.jsx` | Savings breakdown table + call recommendations section |
| `groqApi.js` | Extend prompt + JSON schema for `call_suggestions` and `savings_breakdown` |
| `index.css` | Styles for amber pending state, savings table, call suggestion rows |
