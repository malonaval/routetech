import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './index.css'
import { supabase } from './utils/supabaseClient'
import App from './App.jsx'
import LoginPage from './pages/LoginPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'

const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

function AppRouter() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session
      if (s) {
        const loginTime = parseInt(localStorage.getItem('rt_login_time') || '0', 10)
        if (loginTime && Date.now() - loginTime > SESSION_TTL_MS) {
          // Han pasado más de 24h — cerrar sesión
          supabase.auth.signOut()
          localStorage.removeItem('rt_login_time')
          setSession(null)
          return
        }
      }
      setSession(s)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' && s) {
        // Guardar timestamp del login
        if (!localStorage.getItem('rt_login_time')) {
          localStorage.setItem('rt_login_time', Date.now().toString())
        }
      }
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('rt_login_time')
      }
      setSession(s)
    })

    // Comprobar cada hora si han pasado 24h
    const timer = setInterval(async () => {
      const loginTime = parseInt(localStorage.getItem('rt_login_time') || '0', 10)
      if (loginTime && Date.now() - loginTime > SESSION_TTL_MS) {
        await supabase.auth.signOut()
        localStorage.removeItem('rt_login_time')
      }
    }, 60 * 60 * 1000) // cada hora

    return () => {
      subscription.unsubscribe()
      clearInterval(timer)
    }
  }, [])

  if (session === undefined) return <div className="auth-loading">Cargando…</div>

  return (
    <Routes>
      <Route path="/login"     element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/historial" element={session ? <HistoryPage /> : <Navigate to="/login" replace />} />
      <Route path="/*"         element={session ? <App /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>
)
