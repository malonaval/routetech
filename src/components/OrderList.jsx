import { Check, Navigation, Map, Cpu } from 'lucide-react'

// stopCoords: [{ order, stop, coords, googleLeg }] — puede ser null si aún no se han geocodificado
export default function OrderList({ orders, result, stopCoords = [], highlightedId, onFocusStop }) {
  // Mapa rápido id → googleLeg
  const legByOrderId = Object.fromEntries(
    stopCoords.filter(s => s.googleLeg).map(s => [s.order.id, s.googleLeg])
  )

  return (
    <div className="ot-scroll">
      <div className="section-label" style={{ marginBottom: 0 }}>
        <div className="step-dot done"><Check size={11} strokeWidth={2.5} /></div>
        <span>{orders.length} clientes cargados</span>
      </div>

      {orders.map((order, i) => {
        const seqStop  = result?.sequence.find(s => s.ot_id === order.id) ?? null
        const googleLeg = legByOrderId[order.id] ?? null
        const pos      = i + 1
        const isFixed  = order.ventana_tipo === 'fija'

        return (
          <div
            key={order.id}
            className={`ot-row${highlightedId === order.id ? ' highlighted' : ''}`}
            onClick={() => onFocusStop(order.id)}
          >
            <div className={`ot-pos ${isFixed ? 'fixed-col' : 'flex-col'}`}>{pos}</div>

            <div className="ot-body">
              <div className="ot-client">{order.cliente}</div>
              <div className="ot-addr">{order.direccion}</div>
              <div className="ot-tags">
                <span className={`tag ${isFixed ? 'tag-fixed' : 'tag-flex'}`}>
                  {isFixed ? 'FIJA' : 'FLEXIBLE'}
                </span>
                <span className="tag tag-plain">{order.duracion} min</span>
                {/* Tiempo real de Google o estimación de IA */}
                {googleLeg ? (
                  <>
                    <span
                      className="tag tag-plain"
                      title={googleLeg.hasRealTraffic
                        ? `Tráfico en tiempo real · sin tráfico serían ${googleLeg.durationNoTrafficMins} min`
                        : 'Google Maps · tiempo estimado'}
                      style={googleLeg.hasRealTraffic
                        ? { borderColor: 'var(--blue)', color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: '3px' }
                        : { display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      {googleLeg.hasRealTraffic
                        ? <Navigation size={10} strokeWidth={2} />
                        : <Map size={10} strokeWidth={1.5} />
                      }
                      {googleLeg.durationText}
                    </span>
                    {googleLeg.hasRealTraffic && googleLeg.durationMins > googleLeg.durationNoTrafficMins + 2 && (
                      <span className="tag tag-plain" title="Retraso por tráfico" style={{ color: '#c0392b', fontSize: '9px' }}>
                        +{googleLeg.durationMins - googleLeg.durationNoTrafficMins} min tráfico
                      </span>
                    )}
                  </>
                ) : seqStop ? (
                  <span className="tag tag-plain" title="Estimación IA" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Cpu size={10} strokeWidth={1.5} />
                    ~{seqStop.travel_minutes} min
                  </span>
                ) : null}
              </div>
            </div>

            <div className="ot-time">
              {seqStop ? seqStop.arrival_time : (order.ventana_inicio || '—')}
              {order.ventana_fin && (
                <div className="ot-win">→ {order.ventana_fin}</div>
              )}
              {googleLeg && (
                <div style={{ fontSize: '9px', color: 'var(--blue)', marginTop: '2px' }}>
                  {googleLeg.distanceText}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
