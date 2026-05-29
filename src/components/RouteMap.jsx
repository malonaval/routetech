import React from 'react'
import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Flag, Car, Navigation, Map, Cpu } from 'lucide-react'
import ResultsPanel from './ResultsPanel'

function makeIcon(label, type) {
  const colors = { origin: '#18181b', fixed: '#b45309', flex: '#0e7490' }
  const color = colors[type] || '#6b6762'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;
      background:${color};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      border:2px solid rgba(255,255,255,.3);
      box-shadow:0 2px 8px rgba(0,0,0,.2);
    "><span style="transform:rotate(45deg);color:white;font-family:'Inter',sans-serif;font-weight:600;font-size:12px;letter-spacing:-0.5px">${label}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  })
}

function makeColoredIcon(label, color, isFixed) {
  const bg = color  // worker color always — fixed/flex shown in popup, not pin color
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;
      background:${bg};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      border:2px solid rgba(255,255,255,.4);
      box-shadow:0 2px 8px rgba(0,0,0,.2);
    "><span style="transform:rotate(45deg);color:white;font-family:'Inter',sans-serif;font-weight:600;font-size:12px;letter-spacing:-0.5px">${label}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  })
}

function BoundsController({ bounds }) {
  const map = useMap()
  const boundsKey = bounds.map(b => b.join(',')).join('|')
  useEffect(() => {
    if (!bounds.length) return
    if (bounds.length === 1) map.setView(bounds[0], 13)
    else map.fitBounds(bounds, { padding: [40, 40] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey])
  return null
}

export default function RouteMap({
  originAddress,
  originCoords,
  stopCoords,
  routePolyline,       // [[lat,lng],...] de Google — null si no hay
  naivePolyline,       // [[lat,lng],...] orden CSV original para comparativa
  originalOrders = [], // órdenes en orden CSV original
  workersData = [],
  loading,
  loadingLogs,
  error,
  result,
  highlightedId,
  onHighlight,
  consumption,
  fuelPrice,
  onFocusStop,
  onProposeTime,
}) {
  const bounds = useMemo(() => {
    const pts = []
    if (workersData.length > 0) {
      workersData.forEach(w => {
        if (w.originCoords) pts.push([w.originCoords.lat, w.originCoords.lng])
        w.stopCoords.forEach(s => { if (s.coords) pts.push([s.coords.lat, s.coords.lng]) })
      })
    } else {
      if (originCoords) pts.push([originCoords.lat, originCoords.lng])
      stopCoords.forEach(s => { if (s.coords) pts.push([s.coords.lat, s.coords.lng]) })
    }
    return pts.length > 0 ? pts : [[40.4168, -3.7038]]
  }, [workersData, originCoords, stopCoords])

  // Línea recta entre paradas (fallback cuando no hay ruta Google)
  const straightPoints = useMemo(() => [
    ...(originCoords ? [[originCoords.lat, originCoords.lng]] : []),
    ...stopCoords.filter(s => s.coords).map(s => [s.coords.lat, s.coords.lng]),
  ], [originCoords, stopCoords])

  const showPlaceholder = !loading && workersData.length === 0 &&
    !originCoords && stopCoords.length === 0 && !routePolyline

  return (
    <div className="map-container">
      <MapContainer
        center={[40.416, -3.703]}
        zoom={12}
        style={{ width: '100%', height: '100%' }}
        zoomControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />

        {workersData.length === 0 && (
          <>
            {/* Marcador de origen */}
            {originCoords && (
              <Marker position={[originCoords.lat, originCoords.lng]} icon={makeIcon('◉', 'origin')}>
                <Popup>
                  <div className="popup-title" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Flag size={12} strokeWidth={1.5} /> Punto de inicio</div>
                  <div className="popup-addr">{originAddress}</div>
                  <div className="popup-row"><span className="popup-time">09:00</span></div>
                </Popup>
              </Marker>
            )}

            {/* Marcadores de paradas */}
            {stopCoords.map(({ stop, order, coords, googleLeg }) => {
              if (!coords) return null
              const isFixed = order.ventana_tipo === 'fija'
              // Tiempo de viaje: real de Google si existe, estimado de IA si no
              const travelText = googleLeg
                ? `${googleLeg.durationText} · ${googleLeg.distanceText}`
                : `~${stop.travel_minutes} min`
              const DataSourceEl = googleLeg
                ? googleLeg.hasRealTraffic
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Navigation size={9} strokeWidth={2} /> Google Maps · tráfico real (sin tráfico: {googleLeg.durationNoTrafficMins} min)</span>
                  : <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Map size={9} strokeWidth={1.5} /> Google Maps (estimado)</span>
                : <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Cpu size={9} strokeWidth={1.5} /> Estimación IA</span>

              return (
                <Marker
                  key={order.id}
                  position={[coords.lat, coords.lng]}
                  icon={makeIcon(stop.position, isFixed ? 'fixed' : 'flex')}
                  eventHandlers={{
                    mouseover: () => onHighlight(order.id, true),
                    mouseout:  () => onHighlight(order.id, false),
                  }}
                >
                  <Popup>
                    <div className="popup-title">{stop.position}. {order.cliente}</div>
                    <div className="popup-addr">{order.direccion}</div>
                    <div className="popup-row" style={{ marginBottom: '6px' }}>
                      <span className={`tag ${isFixed ? 'tag-fixed' : 'tag-flex'}`} style={{ fontSize: '9px' }}>
                        {isFixed ? 'FIJA' : 'FLEXIBLE'}
                      </span>
                      {stop.window && (
                        <span style={{ fontSize: '10px', color: 'var(--muted2)' }}>{stop.window}</span>
                      )}
                    </div>
                    <div className="popup-row">
                      <span style={{ color: 'var(--muted2)', fontSize: '11px' }}>Llegada:</span>
                      <span className="popup-time">{stop.arrival_time}</span>
                    </div>
                    <div className="popup-row" style={{ marginTop: '4px' }}>
                      <span style={{ color: 'var(--muted2)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Car size={10} strokeWidth={1.5} /> {travelText}
                      </span>
                    </div>
                    {stop.window_status && (
                      <div className="popup-row" style={{ marginTop: '4px', color: 'var(--blue)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Flag size={9} strokeWidth={2} /> {stop.window_status}
                      </div>
                    )}
                    <div style={{ marginTop: '6px', fontSize: '9px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '5px' }}>
                      {DataSourceEl}
                    </div>
                  </Popup>
                </Marker>
              )
            })}

            {/* ── Polilínea de orden CSV original (comparativa) ── */}
            {naivePolyline && naivePolyline.length > 1 && result && (
              <Polyline
                positions={naivePolyline}
                pathOptions={{ color: '#e07b39', weight: 2.5, opacity: 0.75, dashArray: '7, 5' }}
              />
            )}

            {/* ── Ruta real de Google (carreteras reales) ── */}
            {routePolyline && routePolyline.length > 1 && (
              <>
                <Polyline
                  positions={routePolyline}
                  pathOptions={{ color: 'rgba(24,24,27,0.07)', weight: 12 }}
                />
                <Polyline
                  positions={routePolyline}
                  pathOptions={{ color: '#18181b', weight: 3, opacity: 0.85 }}
                />
              </>
            )}

            {/* ── Línea recta como fallback (sin Google key) ── */}
            {!routePolyline && straightPoints.length > 1 && (
              <>
                <Polyline
                  positions={straightPoints}
                  pathOptions={{ color: 'rgba(24,24,27,0.07)', weight: 10 }}
                />
                <Polyline
                  positions={straightPoints}
                  pathOptions={{ color: '#18181b', weight: 2, opacity: 0.6, dashArray: '8, 6' }}
                />
              </>
            )}
          </>
        )}

        {/* ── Multi-worker routes ── */}
        {workersData.map(worker => (
          <React.Fragment key={worker.id}>
            {/* Origin marker */}
            {worker.originCoords && (
              <Marker
                position={[worker.originCoords.lat, worker.originCoords.lng]}
                icon={makeIcon('●', 'origin')}
                opacity={worker.isActive ? 1 : 0.4}
              />
            )}

            {/* Stop markers */}
            {worker.stopCoords.map((s, i) => {
              if (!s.coords) return null
              const isFixed = s.order?.ventana_tipo === 'fija'
              return (
                <Marker
                  key={s.order.id}
                  position={[s.coords.lat, s.coords.lng]}
                  icon={makeColoredIcon(i + 1, worker.color, isFixed)}
                  opacity={worker.isActive ? 1 : 0.35}
                  eventHandlers={{
                    click: () => onFocusStop?.(s.order.id),
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', minWidth: '160px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{i + 1}. {s.order.cliente}</div>
                      <div style={{ color: '#666', fontSize: '11px' }}>{s.order.direccion}</div>
                      <div style={{ marginTop: '6px', fontSize: '11px' }}>
                        <span style={{
                          background: isFixed ? '#b45309' : '#0e7490',
                          color: 'white', borderRadius: '2px', padding: '1px 5px', marginRight: '4px'
                        }}>
                          {isFixed ? 'FIJA' : 'FLEX'}
                        </span>
                        {s.stop?.arrival_time}
                      </div>
                      <div style={{ marginTop: '3px', fontSize: '10px', color: '#888' }}>{worker.id}</div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}

            {/* Route polyline */}
            {worker.routePolyline && (
              <Polyline
                positions={worker.routePolyline}
                pathOptions={{
                  color: worker.color,
                  weight: worker.isActive ? 4 : 2,
                  opacity: worker.isActive ? 0.85 : 0.3,
                }}
              />
            )}
          </React.Fragment>
        ))}

        <BoundsController bounds={bounds} />
      </MapContainer>

      {/* Placeholder */}
      {showPlaceholder && (
        <div className="map-placeholder">
          <div className="placeholder-icon"><Map size={32} strokeWidth={1} /></div>
          <div className="placeholder-title">El mapa aparecerá aquí</div>
          <div className="placeholder-sub">
            Carga los clientes, configura el punto de inicio y pulsa Calcular ruta óptima
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <div className="loading-title">Calculando ruta óptima...</div>
          <div className="loading-log">
            {loadingLogs.map((log, i) => <span key={i}>› {log}</span>)}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="error-toast">{error}</div>}

      {/* Leyenda de rutas (solo cuando hay comparativa) */}
      {naivePolyline && naivePolyline.length > 1 && result && workersData.length === 0 && (
        <div className="map-legend">
          <div className="map-legend-row">
            <span className="map-legend-line map-legend-line--solid" />
            Ruta optimizada
          </div>
          <div className="map-legend-row">
            <span className="map-legend-line map-legend-line--dashed" style={{ background: 'repeating-linear-gradient(to right, #e07b39 0, #e07b39 5px, transparent 5px, transparent 9px)' }} />
            Orden CSV original
          </div>
        </div>
      )}

      {/* Razonamiento IA */}
      <ResultsPanel result={result} hasRealRoute={!!routePolyline} consumption={consumption} fuelPrice={fuelPrice} onFocusStop={onFocusStop} onProposeTime={onProposeTime} stopCoords={stopCoords} workersData={workersData} originalOrders={originalOrders} />
    </div>
  )
}
