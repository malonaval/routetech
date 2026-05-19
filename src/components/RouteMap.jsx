import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Flag, Car, Navigation, Map, Cpu } from 'lucide-react'
import ResultsPanel from './ResultsPanel'

function makeIcon(label, type) {
  const colors = { origin: '#18181b', fixed: '#8b2e2e', flex: '#1d4e7a' }
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
  loading,
  loadingLogs,
  error,
  result,
  highlightedId,
  onHighlight,
}) {
  const bounds = useMemo(() => [
    ...(originCoords ? [[originCoords.lat, originCoords.lng]] : []),
    ...stopCoords.filter(s => s.coords).map(s => [s.coords.lat, s.coords.lng]),
  ], [originCoords, stopCoords])

  // Línea recta entre paradas (fallback cuando no hay ruta Google)
  const straightPoints = useMemo(() => [
    ...(originCoords ? [[originCoords.lat, originCoords.lng]] : []),
    ...stopCoords.filter(s => s.coords).map(s => [s.coords.lat, s.coords.lng]),
  ], [originCoords, stopCoords])

  const showPlaceholder = !result && !loading && stopCoords.length === 0

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

      {/* Razonamiento IA */}
      <ResultsPanel result={result} hasRealRoute={!!routePolyline} />
    </div>
  )
}
