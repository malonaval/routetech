import { Map, Cpu } from 'lucide-react'

export default function ResultsPanel({ result, hasRealRoute }) {
  if (!result) return null
  return (
    <div className="reasoning-card">
      <div className="reasoning-title">
        {hasRealRoute
          ? <><Map size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />Ruta real · Google Maps</>
          : <><Cpu size={13} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />Razonamiento IA</>
        }
      </div>
      <div className="reasoning-text">{result.reasoning}</div>
      {hasRealRoute && (
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border)',
          fontSize: '10px',
          color: 'var(--muted)',
          letterSpacing: '0.5px',
        }}>
          Tiempos calculados con tráfico en tiempo real
        </div>
      )}
    </div>
  )
}
