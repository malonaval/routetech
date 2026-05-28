import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './utils/supabaseClient'
import { Key, AlertTriangle, Map, Circle, LocateFixed, Fuel } from 'lucide-react'
import CsvUpload, { DEMO_ORDERS_CENTRO } from './components/CsvUpload'
import DemoTour from './components/DemoTour'
import OrderList from './components/OrderList'
import RouteMap from './components/RouteMap'
import { callGroqAPI, callGroqAPIMultiWorker } from './utils/groqApi'
import { geocode, sleep } from './utils/geocode'
import { geocodeGoogle, getGoogleRoute } from './utils/googleRoutes'
import WorkerPanel, { WORKER_COLORS } from './components/WorkerPanel'
import { DEMO_ORIGIN, DEMO_ORIGIN_COORDS, DEMO_STOP_COORDS, DEMO_RESULT, DEMO_MULTI_RESULT, DEMO_ROUTE_POLYLINE, DEMO_WORKERS_MAP_DATA } from './utils/demoData'

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
  const [naivePolyline, setNaivePolyline] = useState(null) // [[lat,lng],...] orden CSV original
  const [originalOrders, setOriginalOrders] = useState([]) // órdenes en orden CSV, para comparativa
  const [highlightedId, setHighlightedId] = useState(null)
  const [pendingEdits, setPendingEdits] = useState({}) // { [orderId]: { ventana_tipo, ventana_inicio, ventana_fin } }

  // ── Multi-worker state ──
  const [workers,        setWorkers]        = useState([])
  const [activeWorkerId, setActiveWorkerId] = useState(null)
  const [workerResults,  setWorkerResults]  = useState({})
  const [demoStep, setDemoStep] = useState(null) // null = tour inactive, 0–10 = active step
  const [demoWorkersData, setDemoWorkersData] = useState([]) // injected at step 10 for two-route map

  const [groqExpanded,   setGroqExpanded]   = useState(() => !(localStorage.getItem('rt_groqkey') || import.meta.env.VITE_GROQ_KEY || ''))
  const [googleExpanded, setGoogleExpanded] = useState(() => !(localStorage.getItem('rt_googlekey') || import.meta.env.VITE_GOOGLE_KEY || ''))
  const [fuelExpanded,   setFuelExpanded]   = useState(false)

  const persistSettings = async (patch) => {
    try { await supabase.functions.invoke('save-settings', { body: patch }) } catch { /* silencioso */ }
  }

  const saveKey = (storageKey, value, setter) => {
    setter(value)
    localStorage.setItem(storageKey, value)
    const field = storageKey === 'rt_groqkey' ? 'groq_api_key' : 'google_maps_key'
    persistSettings({ [field]: value })
  }

  const saveNum = (storageKey, value, setter) => {
    const n = parseFloat(value) || 0
    setter(n)
    localStorage.setItem(storageKey, n)
    const field = storageKey === 'rt_consumption' ? 'consumption' : 'fuel_price'
    persistSettings({ [field]: n })
  }

  const handleOrders = useCallback(newOrders => {
    setOrders(newOrders)
    setResult(null)
    setStopCoords([])
    setOriginCoords(null)
    setRoutePolyline(null)
    setNaivePolyline(null)
    setOriginalOrders([])
    setError(null)
    setPendingEdits({})
    setWorkers([])
    setActiveWorkerId(null)
    setWorkerResults({})
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

  // Aplica el tiempo sugerido de una llamada recomendada como edición pendiente
  const handleProposeTime = useCallback((otId, suggestedTime) => {
    setPendingEdits(prev => ({
      ...prev,
      [otId]: {
        ...(prev[otId] || {}),
        ventana_tipo:    'fija',
        ventana_inicio:  suggestedTime,
        ventana_fin:     suggestedTime,
      },
    }))
  }, [])

  const handleDeleteOrder = useCallback(id => {
    if (workers.length > 0) {
      // Multi-worker mode: remove from the active worker's orders
      setWorkers(prev => prev.map(w =>
        w.id === activeWorkerId
          ? { ...w, orders: w.orders.filter(o => o.id !== id) }
          : w
      ))
    } else {
      // Single-worker mode: remove from orders array
      setOrders(prev => prev.filter(o => o.id !== id))
    }
    setPendingEdits(prev => { const next = { ...prev }; delete next[id]; return next })
    setResult(null)
    setStopCoords([])
    setRoutePolyline(null)
  }, [workers, activeWorkerId])

  const handleWorkersLoaded = useCallback(newWorkers => {
    const colored = newWorkers.map((w, i) => ({
      ...w,
      origin: '',
      originCoords: null,
      color: WORKER_COLORS[i % WORKER_COLORS.length],
    }))
    setWorkers(colored)
    setActiveWorkerId(colored[0]?.id ?? null)
    setWorkerResults({})
    // Clear single-worker state
    setOrders([])
    setResult(null)
    setStopCoords([])
    setOriginCoords(null)
    setRoutePolyline(null)
    setError(null)
    setPendingEdits({})
  }, [])

  const handleDemoStart = useCallback(() => {
    handleOrders(DEMO_ORDERS_CENTRO)   // load orders and reset all result state
    setOrigin(DEMO_ORIGIN)
    setDemoStep(0)
  }, [handleOrders])

  // Inject pre-baked results as the tour progresses:
  //   steps 0-5  → no results (map placeholder, orders loaded)
  //   steps 6-9  → single-worker results (map + savings + calls)
  //   step  10   → multi-worker results (.worker-breakdown rendered)
  // Also auto-expand/collapse the fuel section on step 4.
  useEffect(() => {
    if (demoStep === null) return
    setFuelExpanded(demoStep === 4)
    if (demoStep >= 10) {
      setOriginCoords(null)           // each worker has its own origin in demoWorkersData
      setStopCoords([])
      setResult(DEMO_MULTI_RESULT)
      setRoutePolyline(null)
      setDemoWorkersData(DEMO_WORKERS_MAP_DATA)
    } else if (demoStep >= 6) {
      setDemoWorkersData([])
      setOriginCoords(DEMO_ORIGIN_COORDS)
      setStopCoords(DEMO_STOP_COORDS)
      setResult(DEMO_RESULT)
      setRoutePolyline(DEMO_ROUTE_POLYLINE)
    } else {
      setDemoWorkersData([])
      setOriginCoords(null)
      setStopCoords([])
      setResult(null)
      setRoutePolyline(null)
    }
  }, [demoStep])

  const handleDemoNext  = useCallback(() => setDemoStep(s => s + 1), [])
  const handleDemoPrev  = useCallback(() => setDemoStep(s => Math.max(0, s - 1)), [])
  const handleDemoClose = useCallback(() => setDemoStep(null), [])

  // Cargar settings del usuario desde Supabase al iniciar
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase.functions.invoke('get-settings')
        if (error || !data) return
        if (data.groq_api_key)        { setGroqKey(data.groq_api_key);        localStorage.setItem('rt_groqkey',    data.groq_api_key);    setGroqExpanded(false) }
        if (data.google_maps_key)     { setGoogleKey(data.google_maps_key);   localStorage.setItem('rt_googlekey',  data.google_maps_key); setGoogleExpanded(false) }
        if (data.consumption != null) { setConsumption(data.consumption);     localStorage.setItem('rt_consumption', data.consumption) }
        if (data.fuel_price  != null) { setFuelPrice(data.fuel_price);        localStorage.setItem('rt_fuel_price',  data.fuel_price) }
      } catch { /* silencioso — la app funciona con localStorage */ }
    }
    loadSettings()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-guardar ruta en Supabase tras cada optimización (no durante demo)
  useEffect(() => {
    if (!result || demoStep !== null) return
    if (!stopCoords.length) return

    const payload = {
      origin,
      total_km:       result.total_km ?? result.savings_breakdown?.optimised_km ?? 0,
      saving_minutes: result.saving_minutes ?? 0,
      end_time:       result.end_time ?? '',
      worker_count:   workers.length || 1,
      stops: stopCoords.map(({ stop, order }) => ({
        position:       stop.position,
        client_name:    order.cliente    ?? '',
        client_address: order.direccion  ?? '',
        client_phone:   order.telefono   ?? '',
        duration_min:   order.duracion   ?? 0,
        window_type:    order.ventana_tipo   ?? 'flexible',
        window_start:   order.ventana_inicio ?? '',
        window_end:     order.ventana_fin    ?? '',
        arrival_time:   stop.arrival_time    ?? '',
        travel_minutes: stop.travel_minutes  ?? 0,
      })),
    }

    supabase.functions.invoke('save-route', { body: payload }).catch(() => {})
  }, [result]) // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleWorkerOriginChange = useCallback((workerId, value) => {
    setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, origin: value } : w))
  }, [])

  const handleWorkerUseMyLocation = useCallback(workerId => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      const coords = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
      setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, origin: coords } : w))
    })
  }, [])

  // Geocodifica usando Google si hay key, si no usa Nominatim
  const resolveCoords = async (address) => {
    if (googleKey) {
      const r = await geocodeGoogle(address, googleKey)
      if (r) return r
    }
    return geocode(address)
  }

  // Distancia en km entre dos coordenadas (fórmula haversine)
  const haversineKm = (a, b) => {
    const R = 6371
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.asin(Math.sqrt(h))
  }

  const handleOptimize = async () => {
    if (!origin.trim() || !orders.length || !groqKey) return

    setLoading(true)
    setError(null)
    setResult(null)
    setStopCoords([])
    setOriginCoords(null)
    setRoutePolyline(null)
    setNaivePolyline(null)
    setOriginalOrders([])
    setLoadingLogs([])

    let logIdx = 0
    const logTimer = setInterval(() => {
      if (logIdx < LOADING_LOGS.length) {
        setLoadingLogs(prev => [...prev, LOADING_LOGS[logIdx++]])
      }
    }, 800)

    try {
      const mergedOrders = orders.map(o =>
        pendingEdits[o.id] ? { ...o, ...pendingEdits[o.id] } : o
      )

      // 1 · Geocodificar origen y todas las paradas ANTES de llamar a Groq
      //     así podemos calcular distancias reales y pasárselas al modelo
      const oCoords = await resolveCoords(origin.trim())
      setOriginCoords(oCoords)

      const coordsMap = {}
      for (const order of mergedOrders) {
        const c = await resolveCoords(order.direccion)
        coordsMap[order.id] = c
        if (!googleKey) await sleep(250) // Nominatim rate-limit
      }

      // 2 · Guardar polilínea de orden CSV original (para la comparativa visual)
      const naivePts = [
        ...(oCoords ? [[oCoords.lat, oCoords.lng]] : []),
        ...mergedOrders.map(o => coordsMap[o.id]).filter(Boolean).map(c => [c.lat, c.lng]),
      ]
      setNaivePolyline(naivePts.length > 1 ? naivePts : null)
      setOriginalOrders([...mergedOrders])

      // 3 · Distancias reales desde el origen a cada parada
      const distancesKm = {}
      if (oCoords) {
        for (const order of mergedOrders) {
          const c = coordsMap[order.id]
          if (c) distancesKm[order.id] = haversineKm(oCoords, c)
        }
      }

      // 3 · IA optimiza la secuencia con distancias reales
      const aiResult = await callGroqAPI(groqKey, origin.trim(), mergedOrders, distancesKm)

      // 4 · Construir stopCoords usando las coords ya geocodificadas
      const stops = aiResult.sequence
        .map(stop => {
          const order = mergedOrders.find(o => o.id === stop.ot_id)
          if (!order) return null
          return { stop, order, coords: coordsMap[order.id] ?? null, googleLeg: null }
        })
        .filter(Boolean)

      setStopCoords(stops)
      setResult(aiResult)
      setOrders(mergedOrders)
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

  const handleOptimizeMulti = async () => {
    if (!groqKey || !workers.length) return
    if (workers.some(w => !w.origin.trim())) {
      setError('⚠ Configura el punto de inicio de cada trabajador')
      return
    }

    setLoading(true)
    setError(null)
    setWorkerResults({})
    setLoadingLogs([])

    let logIdx = 0
    const multiLogs = [
      'Analizando cargas de trabajo...',
      'Reasignando OTs con IA...',
      'Geocodificando direcciones...',
      'Calculando rutas reales con tráfico...',
    ]
    const logTimer = setInterval(() => {
      if (logIdx < multiLogs.length) {
        setLoadingLogs(prev => [...prev, multiLogs[logIdx++]])
      }
    }, 800)

    try {
      // 1 · Apply pending edits to active worker's orders
      const mergedWorkers = workers.map(w => ({
        ...w,
        orders: w.orders.map(o => pendingEdits[o.id] ? { ...o, ...pendingEdits[o.id] } : o),
      }))

      // 2 · AI optimizes and reassigns
      const aiResult = await callGroqAPIMultiWorker(groqKey, mergedWorkers)

      // 3 · Build a flat map of all orders by id (across all workers)
      const allOrdersById = {}
      mergedWorkers.forEach(w => w.orders.forEach(o => { allOrdersById[o.id] = o }))

      // 4 · Geocode all origins in parallel
      const originCoordsList = await Promise.all(
        mergedWorkers.map(w => resolveCoords(w.origin.trim()))
      )

      // 5 · Collect all unique addresses to geocode
      const allAddresses = {}
      aiResult.workers.forEach(wr => {
        wr.sequence.forEach(s => {
          const order = allOrdersById[s.ot_id]
          if (order) allAddresses[order.id] = order.direccion
        })
      })
      const geocoded = {}
      await Promise.all(
        Object.entries(allAddresses).map(async ([id, addr]) => {
          geocoded[id] = await resolveCoords(addr)
        })
      )

      // 6 · Build per-worker stop lists
      const workerStops = {}
      aiResult.workers.forEach((wr, idx) => {
        const stops = wr.sequence
          .map(s => {
            const order = allOrdersById[s.ot_id]
            return order ? { stop: s, order, coords: geocoded[order.id] ?? null, googleLeg: null } : null
          })
          .filter(Boolean)
        workerStops[wr.trabajador] = { stops, originCoords: originCoordsList[idx] }
      })

      // 7 · Update workers with reassigned orders and persist edits
      const updatedWorkers = mergedWorkers.map(w => {
        const wrResult = aiResult.workers.find(r => r.trabajador === w.id)
        if (!wrResult) return w
        const reassignedOrders = wrResult.sequence
          .map(s => allOrdersById[s.ot_id])
          .filter(Boolean)
        // Use wrResult.trabajador as key (same as workerStops key) to avoid id mismatch
        return { ...w, orders: reassignedOrders, originCoords: workerStops[wrResult.trabajador]?.originCoords ?? null }
      })
      setWorkers(updatedWorkers)
      setPendingEdits({})

      // 8 · Set initial workerResults (without Google legs yet)
      const initialResults = {}
      aiResult.workers.forEach(wr => {
        initialResults[wr.trabajador] = {
          sequence: wr.sequence,
          stopCoords: workerStops[wr.trabajador]?.stops ?? [],
          routePolyline: null,
          totalKm: wr.total_km,
          totalMins: wr.total_mins_estimated,
          endTime: wr.end_time,
          savingMinutes: wr.saving_minutes,
        }
      })
      setWorkerResults(initialResults)

      // Store global AI result for header stats and results panel
      setResult({
        saving_minutes: aiResult.global_saving_minutes,
        total_km: aiResult.global_km,
        reasoning: aiResult.reasoning,
        call_suggestions: aiResult.call_suggestions ?? [],
        savings_breakdown: aiResult.savings_breakdown,
        workers: aiResult.workers,
      })

      // 9 · Google Routes per worker in parallel
      if (googleKey) {
        try {
          const routeResults = await Promise.all(
            aiResult.workers.map(async wr => {
              const { stops, originCoords: oCoords } = workerStops[wr.trabajador]
              if (!oCoords || !stops.length) return { trabajador: wr.trabajador, routeData: null }
              const routeData = await getGoogleRoute(googleKey, oCoords, stops)
              return { trabajador: wr.trabajador, routeData }
            })
          )

          setWorkerResults(prev => {
            const next = { ...prev }
            routeResults.forEach(({ trabajador, routeData }) => {
              if (!routeData) return
              const enrichedStops = (next[trabajador]?.stopCoords ?? []).map((s, i) => ({
                ...s,
                googleLeg: routeData.legs[i] ?? null,
              }))
              next[trabajador] = {
                ...next[trabajador],
                routePolyline: routeData.polylinePoints,
                stopCoords: enrichedStops,
                totalKm: routeData.totalKm,
                totalMins: routeData.totalMins,
              }
            })
            return next
          })
        } catch (gErr) {
          console.warn('Google Routes multi:', gErr.message)
          setError('⚠ Ruta Google no disponible — mostrando estimación de IA.')
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

  const isMultiWorker = workers.length > 0

  const activeWorker = isMultiWorker
    ? workers.find(w => w.id === activeWorkerId) ?? null
    : null

  const activeWorkerResult = isMultiWorker && activeWorkerId
    ? workerResults[activeWorkerId] ?? null
    : null

  const displayOrders = useMemo(() => {
    if (isMultiWorker) {
      if (!activeWorker) return []
      const seq = activeWorkerResult?.sequence
      if (seq) {
        return seq.map(s => activeWorker.orders.find(o => o.id === s.ot_id)).filter(Boolean)
      }
      return activeWorker.orders
    }
    return result
      ? result.sequence?.map(s => orders.find(o => o.id === s.ot_id)).filter(Boolean) ?? orders
      : orders
  }, [activeWorker, activeWorkerResult, result, orders, workers])

  const canOptimize = isMultiWorker
    ? Boolean(groqKey) && workers.length > 0 && workers.every(w => w.origin.trim()) && !loading
    : Boolean(groqKey) && orders.length > 0 && origin.trim() && !loading

  return (
    <>
      <header>
        <div className="logo">RouteTech</div>
        <div className="header-sep" />
        <div className="header-badge">Optimización de rutas · IA + Tráfico real</div>
        <button className="btn-demo-start" onClick={handleDemoStart}>
          ▶ Demo
        </button>
        <button className="btn-history" onClick={() => navigate('/historial')} title="Ver historial de rutas">
          Historial
        </button>
        <button
          className="btn-logout"
          onClick={handleLogout}
          title="Cerrar sesión"
        >
          Salir
        </button>

        {result && (
          <div className="header-stats">
            <div className="hstat">
              <div className="hstat-val">{result.saving_minutes ?? result.global_saving_minutes ?? '—'}</div>
              <div className="hstat-lbl">Min ahorrados</div>
            </div>
            <div className="hstat">
              <div className="hstat-val">{result.total_km != null ? `${result.total_km} km` : '—'}</div>
              <div className="hstat-lbl">{isMultiWorker ? 'KM totales' : (routePolyline ? 'KM reales' : 'KM estimados')}</div>
            </div>
            {!isMultiWorker && (
              <div className="hstat">
                <div className="hstat-val">{result.end_time ?? '—'}</div>
                <div className="hstat-lbl">Fin jornada</div>
              </div>
            )}
            {isMultiWorker && (
              <div className="hstat">
                <div className="hstat-val">{workers.length}</div>
                <div className="hstat-lbl">Trabajadores</div>
              </div>
            )}
            {(routePolyline || Object.values(workerResults).some(r => r.routePolyline)) && (
              <div className="hstat" style={{ borderLeft: '1px solid var(--border)' }}>
                <div className="hstat-val" style={{ fontSize: '13px', color: 'var(--blue)' }}>Google Maps</div>
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
          <div className="panel-section" data-tour="fuel-config">
            <div
              className="section-label"
              style={{ cursor: 'pointer', marginBottom: fuelExpanded ? undefined : 0 }}
              onClick={() => setFuelExpanded(v => !v)}
            >
              <Fuel size={13} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--muted)' }} />
              Vehículo
              <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--muted)', letterSpacing: '1px' }}>
                {fuelExpanded ? 'OCULTAR' : `${consumption} l · ${Number(fuelPrice).toFixed(2)} €/l · CAMBIAR`}
              </span>
            </div>
            {fuelExpanded && (
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
            )}
          </div>

          {/* ── CSV Upload ── */}
          <CsvUpload
            onOrdersLoaded={handleOrders}
            onWorkersLoaded={handleWorkersLoaded}
            hasOrders={orders.length > 0 || workers.length > 0}
            orderCount={isMultiWorker
              ? workers.reduce((s, w) => s + w.orders.length, 0)
              : orders.length}
          />

          {isMultiWorker ? (
            <>
              <WorkerPanel
                workers={workers}
                activeWorkerId={activeWorkerId}
                onSelectWorker={setActiveWorkerId}
                onOriginChange={handleWorkerOriginChange}
                onUseMyLocation={handleWorkerUseMyLocation}
              />
              {activeWorker && (
                <OrderList
                  orders={displayOrders}
                  result={activeWorkerResult ? { sequence: activeWorkerResult.sequence } : null}
                  stopCoords={activeWorkerResult?.stopCoords ?? []}
                  highlightedId={highlightedId}
                  onFocusStop={handleFocusStop}
                  pendingEdits={pendingEdits}
                  onEditOrder={handleEditOrder}
                  onDeleteOrder={handleDeleteOrder}
                />
              )}
              <div className="opt-wrap">
                <button
                  className="btn-optimize"
                  onClick={handleOptimizeMulti}
                  disabled={!canOptimize}
                >
                  Optimizar todas las rutas
                  <span className="btn-sub">
                    {!groqKey
                      ? 'Configura tu Groq API Key primero'
                      : `${workers.length} trabajadores · IA + tráfico real`}
                  </span>
                </button>
              </div>
            </>
          ) : (
            orders.length > 0 && (
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
                  onDeleteOrder={handleDeleteOrder}
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
            )
          )}
        </div>

        <RouteMap
          originAddress={isMultiWorker || demoWorkersData.length > 0 ? '' : origin}
          originCoords={isMultiWorker || demoWorkersData.length > 0 ? null : originCoords}
          stopCoords={isMultiWorker || demoWorkersData.length > 0 ? [] : stopCoords}
          routePolyline={isMultiWorker || demoWorkersData.length > 0 ? null : routePolyline}
          naivePolyline={isMultiWorker || demoWorkersData.length > 0 ? null : naivePolyline}
          originalOrders={isMultiWorker || demoWorkersData.length > 0 ? [] : originalOrders}
          workersData={demoWorkersData.length > 0
            ? demoWorkersData
            : isMultiWorker
              ? workers.map((w, i) => ({
                  id: w.id,
                  color: w.color,
                  originCoords: w.originCoords,
                  stopCoords: workerResults[w.id]?.stopCoords ?? [],
                  routePolyline: workerResults[w.id]?.routePolyline ?? null,
                  isActive: w.id === activeWorkerId,
                }))
              : []
          }
          loading={loading}
          loadingLogs={loadingLogs}
          error={error}
          result={result}
          highlightedId={highlightedId}
          onHighlight={handleHighlight}
          consumption={consumption}
          fuelPrice={fuelPrice}
          onFocusStop={handleFocusStop}
          onProposeTime={handleProposeTime}
        />
      </div>
      {demoStep !== null && (
        <DemoTour
          step={demoStep}
          onNext={handleDemoNext}
          onPrev={handleDemoPrev}
          onClose={handleDemoClose}
        />
      )}
    </>
  )
}
