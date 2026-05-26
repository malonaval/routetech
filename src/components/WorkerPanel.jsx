import { LocateFixed } from 'lucide-react'

export const WORKER_COLORS = ['#1d4e7a', '#8b2e2e', '#2e6b3e', '#7a5c1d', '#4a2e6b', '#1d6b6b']

export default function WorkerPanel({ workers, activeWorkerId, onSelectWorker, onOriginChange, onUseMyLocation }) {
  return (
    <div className="worker-panel">
      {workers.map((worker, idx) => {
        const color = WORKER_COLORS[idx % WORKER_COLORS.length]
        const isActive = worker.id === activeWorkerId
        return (
          <div
            key={worker.id}
            className={`worker-card${isActive ? ' worker-card--active' : ''}`}
            onClick={() => onSelectWorker(worker.id)}
          >
            <div className="worker-card-header">
              <span className="worker-dot" style={{ background: color }} />
              <span className="worker-name">{worker.id}</span>
              <span className="worker-horario">{worker.horario}</span>
              <span className="worker-count">{worker.orders.length} OT</span>
            </div>
            {isActive && (
              <div className="origin-row" onClick={e => e.stopPropagation()}>
                <input
                  className="origin-input"
                  value={worker.origin || ''}
                  onChange={e => onOriginChange(worker.id, e.target.value)}
                  placeholder="Punto de inicio..."
                />
                <button
                  className="loc-btn"
                  onClick={() => onUseMyLocation(worker.id)}
                  title="Usar ubicación actual"
                >
                  <LocateFixed size={14} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
