import { Map, Cpu, Phone, ChevronRight, Clock, AlertTriangle, PhoneCall } from 'lucide-react'

export default function ResultsPanel({ result, hasRealRoute, consumption = 9, fuelPrice = 1.65, onFocusStop, stopCoords = [] }) {
  if (!result) return null

  // Index traffic legs and phone numbers by order id
  const legById   = Object.fromEntries(stopCoords.filter(s => s.googleLeg).map(s => [s.order.id, s.googleLeg]))
  const phoneById = Object.fromEntries(stopCoords.filter(s => s.order?.telefono).map(s => [s.order.id, s.order.telefono]))

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
          {result.call_suggestions.map(s => {
            const leg = legById[s.ot_id]
            const trafficDelay = leg?.hasRealTraffic
              ? leg.durationMins - leg.durationNoTrafficMins
              : 0
            const phone = phoneById[s.ot_id]
            return (
              <div
                key={s.ot_id}
                className="call-row"
                onClick={() => onFocusStop?.(s.ot_id)}
              >
                <div className="call-info">
                  <div className="call-client">
                    {s.cliente}
                    {phone && (
                      <a
                        href={`tel:${phone.replace(/\s/g, '')}`}
                        className="call-phone-btn"
                        title={`Llamar: ${phone}`}
                        onClick={e => e.stopPropagation()}
                      >
                        <PhoneCall size={11} strokeWidth={2} />
                        {phone}
                      </a>
                    )}
                  </div>
                  <div className="call-window">
                    Ahora: {s.current_window}
                    {s.suggested_time && (
                      <span className="call-suggested">
                        <Clock size={9} strokeWidth={2} />
                        Proponer: {s.suggested_time}
                      </span>
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
