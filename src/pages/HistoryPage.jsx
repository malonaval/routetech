import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, MapPin, Phone } from 'lucide-react'
import { supabase } from '../utils/supabaseClient'

export default function HistoryPage() {
  const [routes,   setRoutes]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('routes')
      .select(`id, created_at, origin, total_km, saving_minutes, end_time, worker_count,
               route_stops(position, client_name, client_address, client_phone,
                           duration_min, window_type, window_start, window_end,
                           arrival_time, travel_minutes)`)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) setRoutes(data)
        setLoading(false)
      })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <button className="history-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={14} strokeWidth={2} /> Volver a la app
        </button>
        <div className="history-title">Historial de rutas</div>
        <button className="btn-logout" onClick={handleLogout}>Salir</button>
      </div>

      <div className="history-content">
        {loading && <div className="history-empty">Cargando…</div>}
        {!loading && routes.length === 0 && (
          <div className="history-empty">
            Aún no tienes rutas guardadas. Optimiza una ruta para verla aquí.
          </div>
        )}
        {routes.map(route => (
          <div key={route.id} className="history-route-card">
            <div
              className="history-route-header"
              onClick={() => setExpanded(expanded === route.id ? null : route.id)}
            >
              <div className="history-route-meta">
                <span className="history-route-date">{formatDate(route.created_at)}</span>
                <div className="history-route-stats">
                  <span>{route.route_stops?.length ?? 0} paradas</span>
                  <span>{route.total_km} km</span>
                  <span>{route.saving_minutes} min ahorrados</span>
                  {route.worker_count > 1 && <span>{route.worker_count} técnicos</span>}
                </div>
              </div>
              {expanded === route.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>

            {expanded === route.id && (
              <div className="history-stops">
                {(route.route_stops ?? [])
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map(stop => (
                    <div key={stop.position} className="history-stop-row">
                      <div className="history-stop-pos">{stop.position}</div>
                      <div className="history-stop-body">
                        <div className="history-stop-name">{stop.client_name}</div>
                        <div className="history-stop-detail">
                          <MapPin size={10} strokeWidth={1.5} /> {stop.client_address}
                        </div>
                        {stop.client_phone && (
                          <div className="history-stop-detail">
                            <Phone size={10} strokeWidth={1.5} /> {stop.client_phone}
                          </div>
                        )}
                      </div>
                      <div className="history-stop-time">
                        {stop.arrival_time && <div>{stop.arrival_time}</div>}
                        {stop.window_end && (
                          <div className="history-stop-window">→ {stop.window_end}</div>
                        )}
                        <div className="history-stop-tag" data-type={stop.window_type}>
                          {stop.window_type === 'fija' ? 'FIJA' : 'FLEX'}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
