import { Map, Cpu, Phone, ChevronRight, Clock, AlertTriangle, PhoneCall, ArrowUpDown } from 'lucide-react'
import { useState } from 'react'
import { WORKER_COLORS } from './WorkerPanel'

export default function ResultsPanel({ result, hasRealRoute, consumption = 9, fuelPrice = 1.65, onFocusStop, onProposeTime, stopCoords = [], workersData = [], originalOrders = [] }) {
  const [reorderOpen, setReorderOpen] = useState(false)

  if (!result) return null

  const isMultiWorker = Array.isArray(result.workers) && result.workers.length > 0

  const legById   = Object.fromEntries(stopCoords.filter(s => s.googleLeg).map(s => [s.order.id, s.googleLeg]))
  const phoneById = Object.fromEntries(stopCoords.filter(s => s.order?.telefono).map(s => [s.order.id, s.order.telefono]))

  // Deduplicar sugerencias por ot_id (el modelo a veces repite el mismo cliente)
  const callSuggestions = result.call_suggestions
    ? result.call_suggestions.filter((s, i, arr) => arr.findIndex(x => x.ot_id === s.ot_id) === i)
    : []

  const sb = result.savings_breakdown
  const savedKm   = sb ? Math.round((sb.original_estimated_km - sb.optimised_km) * 10) / 10 : null
  const savedMins = result.saving_minutes ?? result.global_saving_minutes ?? (sb ? sb.original_estimated_mins - sb.optimised_mins : null)
  const fuelSaved = savedKm != null
    ? ((savedKm * consumption / 100) * fuelPrice).toFixed(2)
    : null

  // Worker color lookup
  const workerColorById = {}
  workersData.forEach((w, i) => { workerColorById[w.id] = w.color || WORKER_COLORS[i % WORKER_COLORS.length] })

  return (
    <div className="reasoning-card">
      {/* ── Savings summary ── */}
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

      {/* ── Per-worker breakdown ── */}
      {isMultiWorker && (
        <div className="worker-breakdown">
          {result.workers.map((wr, i) => {
            const color = workerColorById[wr.trabajador] || WORKER_COLORS[i % WORKER_COLORS.length]
            const wData = workersData.find(w => w.id === wr.trabajador)
            const realKm = wData?.totalKm ?? wr.total_km
            return (
              <div key={wr.trabajador} className="worker-breakdown-row">
                <span className="worker-dot" style={{ background: color }} />
                <span className="worker-breakdown-name">{wr.trabajador}</span>
                <span className="worker-breakdown-stat">{wr.end_time}</span>
                <span className="worker-breakdown-stat">{realKm} km</span>
                <span className="worker-breakdown-saving">−{wr.saving_minutes} min</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Reasoning ── */}
      <div className="reasoning-title">
        {hasRealRoute || workersData.some(w => w.routePolyline)
          ? <><Map size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />Ruta real · Google Maps</>
          : <><Cpu size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />Razonamiento IA</>
        }
      </div>
      <div className="reasoning-text">{result.reasoning}</div>
      {(hasRealRoute || workersData.some(w => w.routePolyline)) && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.5px' }}>
          Tiempos calculados con tráfico en tiempo real
        </div>
      )}

      {/* ── Reordering comparison (single-worker only) ── */}
      {!isMultiWorker && originalOrders.length > 0 && result.sequence?.length > 0 && (
        <div className="reorder-section">
          <div className="reorder-header" onClick={() => setReorderOpen(v => !v)}>
            <ArrowUpDown size={11} strokeWidth={1.8} />
            Reordenación de paradas
            <span style={{ marginLeft: 'auto', fontSize: '9px', letterSpacing: '0.8px' }}>
              {reorderOpen ? 'OCULTAR' : 'VER'}
            </span>
          </div>
          {reorderOpen && (
            <table className="reorder-table">
              <thead>
                <tr>
                  <th className="reorder-th reorder-th--pos">#</th>
                  <th className="reorder-th">Antes (CSV)</th>
                  <th className="reorder-th reorder-th--pos">#</th>
                  <th className="reorder-th">Después (IA)</th>
                  <th className="reorder-th reorder-th--delta">Δ</th>
                </tr>
              </thead>
              <tbody>
                {result.sequence.map((s, i) => {
                  const origIdx = originalOrders.findIndex(o => o.id === s.ot_id)
                  const origPos = origIdx + 1
                  const newPos  = s.position ?? i + 1
                  const delta   = origPos - newPos
                  const origOrder = originalOrders[origIdx]
                  const csvClientAtPos = originalOrders[i] // client that was at this position in CSV
                  return (
                    <tr key={s.ot_id} className="reorder-tr">
                      <td className="reorder-td reorder-pos">{i + 1}</td>
                      <td className="reorder-td reorder-name">
                        {csvClientAtPos
                          ? <span title={csvClientAtPos.direccion}>{csvClientAtPos.cliente}</span>
                          : '—'}
                      </td>
                      <td className="reorder-td reorder-pos">{newPos}</td>
                      <td className="reorder-td reorder-name">
                        <span title={origOrder?.direccion ?? ''}>{s.cliente}</span>
                      </td>
                      <td className="reorder-td reorder-delta">
                        {delta > 0
                          ? <span className="reorder-delta--up">↑{delta}</span>
                          : delta < 0
                          ? <span className="reorder-delta--down">↓{Math.abs(delta)}</span>
                          : <span className="reorder-delta--same">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Call recommendations ── */}
      {callSuggestions.length > 0 && (
        <div className="call-section">
          <div className="call-title">
            <Phone size={11} strokeWidth={1.5} />
            Llamadas recomendadas
          </div>
          {callSuggestions.map(s => {
            const leg = legById[s.ot_id]
            const trafficDelay = leg?.hasRealTraffic ? leg.durationMins - leg.durationNoTrafficMins : 0
            const phone = phoneById[s.ot_id]
            const workerColor = s.trabajador ? (workerColorById[s.trabajador] || null) : null
            return (
              <div key={s.ot_id} className="call-row" onClick={() => onFocusStop?.(s.ot_id)}>
                <div className="call-info">
                  <div className="call-client">
                    {workerColor && <span className="worker-dot" style={{ background: workerColor, marginRight: '4px' }} />}
                    {s.cliente}
                  </div>
                  <div className="call-window">
                    Ahora: {s.current_window}
                    {s.suggested_time && (
                      <button
                        className="call-suggested call-suggested-btn"
                        title="Aplicar esta hora y recalcular"
                        onClick={e => { e.stopPropagation(); onProposeTime?.(s.ot_id, s.suggested_time) }}
                      >
                        <Clock size={9} strokeWidth={2} />
                        Proponer: {s.suggested_time}
                      </button>
                    )}
                  </div>
                  {trafficDelay > 3 && (
                    <div className="call-traffic">
                      <AlertTriangle size={9} strokeWidth={2} />
                      +{trafficDelay} min de tráfico en esta zona ahora
                    </div>
                  )}
                  <div className="call-reason">{s.reason}</div>
                </div>
                <div className="call-saving">
                  {phone && (
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="call-phone-btn" title={phone} onClick={e => e.stopPropagation()}>
                      <PhoneCall size={10} strokeWidth={2} />
                      Llamar
                    </a>
                  )}
                  <span className="call-saving-val">+{s.potential_saving_minutes} min</span>
                  <ChevronRight size={12} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
