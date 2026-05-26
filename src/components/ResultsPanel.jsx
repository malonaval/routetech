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
