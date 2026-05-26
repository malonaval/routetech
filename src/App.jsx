import { useState, useCallback, useMemo } from 'react'
import { Key, AlertTriangle, Map, Circle, LocateFixed, Fuel } from 'lucide-react'
import CsvUpload from './components/CsvUpload'
import OrderList from './components/OrderList'
import RouteMap from './components/RouteMap'
import { callGroqAPI } from './utils/groqApi'
import { geocode, sleep } from './utils/geocode'
import { geocodeGoogle, getGoogleRoute } from './utils/googleRoutes'

const LOADING_LOGS = [
  'Analizando ventanas horarias...',
  'Calculando secuencia óptima con IA...',
  'Geocodificando direcciones...',
  'Calculando ruta real con tráfico...',
]

export default function App() {
  const [orders, setOrders] = useState([])
  const [origin, setOrigin] = useState('Puerta del Sol, Madrid')

  const [groqKey,   setGroqKey]   = useState(() => localStorage.getItem('rt_groqkey')   || import.meta.env.VITE_GROQ_KEY   || '')
  const [googleKey, setGoogleKey] = useState(() => localStorage.getItem('rt_googlekey') || import.meta.env.VITE_GOOGLE_KEY || '')
  const [consumption, setConsumption] = useState(() => { const v = parseFloat(localStorage.getItem('rt_consumption')); return isNaN(v) ? 9 : v })
  const [fuelPrice,   setFuelPrice]   = useState(() => { const v = parseFloat(localStorage.getItem('rt_fuel_price'));  return isNaN(v) ? 1.65 : v })

  const [result,        setResult]        = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [loadingLogs,   setLoadingLogs]   = useState([])
  const [error,         setError]         = useState(null)
  const [originCoords,  setOriginCoords]  = useState(null)
  const [stopCoords,    setStopCoords]    = useState([])
  const [routePolyline, setRoutePolyline] = useState(null) // [[lat,lng],...] de Google
  const [highlightedId, setHighlightedId] = useState(null)
  const [pendingEdits, setPendingEdits] = useState({}) // { [orderId]: { ventana_tipo, ventana_inicio, ventana_fin } }
  const [groqExpanded,   setGroqExpanded]   = useState(() => !(localStorage.getItem('rt_groqkey') || import.meta.env.VITE_GROQ_KEY || ''))
  const [googleExpanded, setGoogleExpanded] = useState(() => !(localStorage.getItem('rt_googlekey') || import.meta.env.VITE_GOOGLE_KEY || ''))

  const saveKey = (storageKey, value, setter) => {
    setter(value)
    localStorage.setItem(storageKey, value)
  }

  const saveNum = (storageKey, value, setter) => {
    const n = parseFloat(value) || 0
    setter(n)
    localStorage.setItem(storageKey, n)
  }

  const handleOrders = useCallback(newOrders => {
    setOrders(newOrders)
    setResult(null)
    setStopCoords([])
    setOriginCoords(null)
    setRoutePolyline(null)
    setError(null)
    setPendingEdits({})
  }, [])

  const handleFocusStop = useCallback(id => {
    setHighlightedId(id)
    setTimeout(() => setHighlightedId(null), 1500)
  }, [])

  const handleHighlight = useCallback((id, on) => {
    setHighlightedId(on ? id : null)
  }, [])

  const handleEditOrder = useCallback((id, changes) => {
    setPendingEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...changes } }))
  }, [])

  const handleClearEdits = useCallback(() => {
    setPendingEdits({})
  }, [])

  // Geocodifica usando Google si hay key, si no usa Nominatim
  const resolveCoords = async (address) => {
    if (googleKey) {
      const r = await geocodeGoogle(address, googleKey)
      if (r) return r
    }
    return geocode(address)
  }

  const handleOptimize = async () => {
    if (!origin.trim() || !orders.length || !groqKey) return

    setLoading(true)
    setError(null)
    setResult(null)
    setStopCoords([])
    setOriginCoords(null)
    setRoutePolyline(null)
    setLoadingLogs([])

    let logIdx = 0
    const logTimer = setInterval(() => {
      if (logIdx < LOADING_LOGS.length) {
        setLoadingLogs(prev => [...prev, LOADING_LOGS[logIdx++]])
      }
    }, 800)

    try {
      // 1 · IA optimiza la secuencia
      const mergedOrders = orders.map(o =>
        pendingEdits[o.id] ? { ...o, ...pendingEdits[o.id] } : o
      )
      const aiResult = await callGroqAPI(groqKey, origin.trim(), mergedOrders)

      // 2 · Geocodificar origen
      const oCoords = await resolveCoords(origin.trim())
      setOriginCoords(oCoords)

      // 3 · Geocodificar todas las paradas en secuencia optimizada
      const stops = []
      for (const stop of aiResult.sequence) {
        const order = orders.find(o => o.id === stop.ot_id)
        if (order) {
          const coords = await resolveCoords(order.direccion)
          stops.push({ stop, order, coords, googleLeg: null })
          if (!googleKey) await sleep(250) // Nominatim rate-limit solo si no usamos Google
        }
      }

      setStopCoords(stops)
      setResult(aiResult)
      setPendingEdits({})

      // 4 · Ruta real con tráfico (solo si hay key de Google)
      if (googleKey && oCoords) {
        try {
          const routeData = await getGoogleRoute(googleKey, oCoords, stops)
          if (routeData) {
            setRoutePolyline(routeData.polylinePoints)
            // Enriquecer cada parada con datos reales de Google
            const enriched = stops.map((s, i) => ({
              ...s,
              googleLeg: routeData.legs[i] ?? null,
            }))
            setStopCoords(enriched)
            // Actualizar totales del resultado con datos reales
            setResult(prev => ({
              ...prev,
              total_km:       routeData.totalKm,
              total_mins_real: routeData.totalMins,
            }))
          }
        } catch (gErr) {
          // La ruta real falló: mostramos aviso pero seguimos con la estimada
          console.warn('Google Routes:', gErr.message)
          setError('⚠ Ruta Google no disponible — mostrando estimación de IA. ' + gErr.message)
          setTimeout(() => setError(null), 6000)
        }
      }
    } catch (err) {
      setError('⚠ ' + err.message)
    } finally {
      clearInterval(logTimer)
      setLoading(false)
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      setOrigin(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`)
    })
  }

  const displayOrders = useMemo(
    () =>
      result
        ? result.sequence.map(s => orders.find(o => o.id === s.ot_id)).filter(Boolean)
        : orders,
    [result, orders]
  )

  const canOptimize = Boolean(groqKey) && orders.length > 0 && origin.trim() && !loading

  return (
    <>
      <header>
        <div className="logo">RouteTech</div>
        <div className="header-sep" />
        <div className="header-badge">Optimización de rutas · IA + Tráfico real</div>

        {result && (
          <div className="header-stats">
            <div className="hstat">
              <div className="hstat-val">{result.saving_minutes ?? '—'}</div>
              <div className="hstat-lbl">Min ahorrados</div>
            </div>
            <div className="hstat">
              <div className="hstat-val">{result.total_km != null ? `${result.total_km} km` : '—'}</div>
              <div className="hstat-lbl">{routePolyline ? 'KM reales' : 'KM estimados'}</div>
            </div>
            <div className="hstat">
              <div className="hstat-val">{result.end_time ?? '—'}</div>
              <div className="hstat-lbl">Fin jornada</div>
            </div>
            {routePolyline && (
              <div className="hstat" style={{ borderLeft: '1px solid var(--border)' }}>
                <div className="hstat-val" style={{ fontSize: '13px', color: 'var(--blue)' }}>
                  Google Maps
                </div>
                <div className="hstat-lbl">Ruta con tráfico</div>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="workspace">
        <div className="left">

          {/* ── Groq API Key ── */}
          <div className="panel-section">
            <div
              className="section-label"
              style={{ cursor: groqKey ? 'pointer' : 'default' }}
              onClick={() => groqKey && setGroqExpanded(v => !v)}
            >
              {groqKey
                ? <Key size={13} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--text)' }} />
                : <AlertTriangle size={13} strokeWidth={1.5} style={{ flexShrink: 0, color: '#c0392b' }} />
              }
              Groq API Key
              {groqKey && (
                <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--muted)', letterSpacing: '1px' }}>
                  {groqExpanded ? 'OCULTAR' : 'CONFIGURADA · EDITAR'}
                </span>
              )}
            </div>
            {(!groqKey || groqExpanded) && (
              <>
                <input
                  type="password"
                  className="origin-input"
                  value={groqKey}
                  onChange={e => {
                    saveKey('rt_groqkey', e.target.value, setGroqKey)
                    if (e.target.value) setGroqExpanded(false)
                  }}
                  placeholder="gsk_..."
                  autoComplete="off"
                  autoFocus={groqExpanded && !!groqKey}
                />
                {!groqKey && (
                  <p className="apikey-hint">
                    Gratis en{' '}
                    <a href="https://console.groq.com" target="_blank" rel="noreferrer">
                      console.groq.com
                    </a>
                  </p>
                )}
              </>
            )}
          </div>

          {/* ── Google Maps API Key (opcional) ── */}
          <div className="panel-section">
            <div
              className="section-label"
              style={{ cursor: googleKey ? 'pointer' : 'default' }}
              onClick={() => googleKey && setGoogleExpanded(v => !v)}
            >
              {googleKey
                ? <Map size={13} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--blue)' }} />
                : <Circle size={13} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--muted)' }} />
              }
              Google Maps API Key
              {googleKey ? (
                <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--muted)', letterSpacing: '1px' }}>
                  {googleExpanded ? 'OCULTAR' : 'CONFIGURADA · EDITAR'}
                </span>
              ) : (
                <span style={{ fontSize: '8px', color: 'var(--muted)', letterSpacing: '1px' }}>
                  (tráfico real)
                </span>
              )}
            </div>
            {(!googleKey || googleExpanded) && (
              <>
                <input
                  type="password"
                  className="origin-input"
                  value={googleKey}
                  onChange={e => {
                    saveKey('rt_googlekey', e.target.value, setGoogleKey)
                    if (e.target.value) setGoogleExpanded(false)
                  }}
                  placeholder="AIza..."
                  autoComplete="off"
                />
                {!googleKey && (
                  <p className="apikey-hint">
                    Sin key se usan estimaciones de IA.{' '}
                    <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">
                      Obtener en Google Cloud
                    </a>{' '}
                    (activar Directions API + Geocoding API)
                  </p>
                )}
              </>
            )}
          </div>

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
                    onChange={e => { const n = parseFloat(e.target.value); setConsumption(isNaN(n) ? '' : n) }}
                    onBlur={e => saveNum('rt_consumption', e.target.value, setConsumption)}
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
                    onChange={e => { const n = parseFloat(e.target.value); setFuelPrice(isNaN(n) ? '' : n) }}
                    onBlur={e => saveNum('rt_fuel_price', e.target.value, setFuelPrice)}
                  />
                  <span className="fuel-unit">€/l</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── CSV Upload ── */}
          <CsvUpload onOrdersLoaded={handleOrders} hasOrders={orders.length > 0} orderCount={orders.length} />

          {orders.length > 0 && (
            <>
              {/* ── Punto de inicio ── */}
              <div className="panel-section">
                <div className="section-label">
                  <div className="step-dot">2</div>
                  Punto de inicio
                </div>
                <div className="origin-row">
                  <input
                    className="origin-input"
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    placeholder="Ej: Puerta del Sol, Madrid"
                  />
                  <button className="loc-btn" onClick={useMyLocation} title="Usar ubicación actual">
                    <LocateFixed size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              <OrderList
                orders={displayOrders}
                result={result}
                stopCoords={stopCoords}
                highlightedId={highlightedId}
                onFocusStop={handleFocusStop}
                pendingEdits={pendingEdits}
                onEditOrder={handleEditOrder}
              />

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
            </>
          )}
        </div>

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
          onFocusStop={handleFocusStop}
        />
      </div>
    </>
  )
}
