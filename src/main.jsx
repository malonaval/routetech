import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './index.css'
import { supabase } from './utils/supabaseClient'
import App from './App.jsx'
import LoginPage from './pages/LoginPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'

function AppRouter() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
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
