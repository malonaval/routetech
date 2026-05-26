import { useState } from 'react'
import { Upload, Zap, Check } from 'lucide-react'

const DEMO_CSV = `cliente,direccion,duracion_min,ventana_tipo,ventana_inicio,ventana_fin
María García,Calle de Alcalá 120 Madrid,60,fija,09:00,10:00
Carlos López,Calle de Bravo Murillo 78 Madrid,45,flexible,,
Ana Martínez,Paseo de las Delicias 56 Madrid,30,fija,11:30,12:30
Pedro Jiménez,Calle de Embajadores 34 Madrid,45,flexible,,
Laura Rodríguez,Calle de Fuencarral 102 Madrid,60,flexible,,
Miguel Fernández,Calle de Toledo 89 Madrid,30,fija,13:00,14:00
Carmen Sánchez,Calle de Santa Engracia 67 Madrid,45,flexible,,
Antonio Ruiz,Calle de Fernández de los Ríos 45 Madrid,30,flexible,,
Isabel Moreno,Calle de O'Donnell 42 Madrid,60,fija,17:00,18:00
Francisco Díaz,Avenida de Entrevías 23 Madrid,45,flexible,,`

const DEMO_CSV_NORTE = `cliente,direccion,duracion_min,ventana_tipo,ventana_inicio,ventana_fin
Elena Vázquez,Calle de Silvano 12 Madrid,60,fija,09:00,10:00
Roberto Iglesias,Avenida de Manoteras 34 Madrid,45,flexible,,
Sofía Castro,Calle de Arturo Soria 180 Madrid,30,fija,11:00,12:00
Javier Morales,Calle del Mar Egeo 8 Madrid,45,flexible,,
Patricia Núñez,Avenida de San Luis 45 Madrid,60,flexible,,
Andrés Herrero,Calle de Sanchinarro 23 Madrid,30,fija,13:30,14:30
Lucía Domínguez,Calle de las Tablas 67 Madrid,45,flexible,,
Manuel Romero,Avenida de Montecarmelo 15 Madrid,30,flexible,,
Teresa Alonso,Calle del Padre Damián 28 Madrid,60,fija,16:00,17:00
Gonzalo Reyes,Calle de Hortaleza 120 Madrid,45,flexible,,`

function parseCSVText(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const orders = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim())
    const row = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
    if (row.cliente || row.client) {
      orders.push({
        id: `OT-${2840 + i}`,
        cliente: row.cliente || row.client || `Cliente ${i}`,
        direccion: row.direccion || row.address || '',
        duracion: parseInt(row.duracion_min || row.duracion || 60) || 60,
        ventana_tipo: (row.ventana_tipo || 'flexible').toLowerCase(),
        ventana_inicio: row.ventana_inicio || '',
        ventana_fin: row.ventana_fin || '',
      })
    }
  }
  return orders
}

export default function CsvUpload({ onOrdersLoaded, hasOrders, orderCount = 0 }) {
  const [dragging, setDragging] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const handleDragOver = e => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  const handleDrop = e => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }

  const handleFileInput = e => {
    const file = e.target.files[0]
    if (file) readFile(file)
  }

  const readFile = file => {
    const reader = new FileReader()
    reader.onload = e => {
      const orders = parseCSVText(e.target.result)
      if (orders.length) onOrdersLoaded(orders)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const loadDemoCentro = () => {
    const orders = parseCSVText(DEMO_CSV)
    if (orders.length) { onOrdersLoaded(orders); setExpanded(false) }
  }

  const loadDemoNorte = () => {
    const orders = parseCSVText(DEMO_CSV_NORTE)
    if (orders.length) { onOrdersLoaded(orders); setExpanded(false) }
  }

  return (
    <div className="panel-section">
      <div
        className="section-label"
        style={{ cursor: hasOrders ? 'pointer' : 'default', marginBottom: expanded ? undefined : 0 }}
        onClick={() => hasOrders && setExpanded(v => !v)}
      >
        <div className={`step-dot${hasOrders ? ' done' : ''}`}>
          {hasOrders ? <Check size={11} strokeWidth={2.5} /> : '1'}
        </div>
        Órdenes de trabajo
        {hasOrders && (
          <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--muted)', letterSpacing: '1px' }}>
            {expanded ? 'OCULTAR' : `${orderCount} CLIENTES · CAMBIAR`}
          </span>
        )}
      </div>

      {(!hasOrders || expanded) && (
        <>
          <div
            className={`drop-zone${dragging ? ' dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input type="file" accept=".csv" onChange={handleFileInput} />
            <Upload size={18} strokeWidth={1.5} style={{ margin: '0 auto 6px', display: 'block', color: 'var(--muted)' }} />
            <div className="drop-title">Arrastra tu CSV</div>
            <div className="drop-sub">o haz clic para seleccionar</div>
            <div className="drop-fmt">
              cliente, direccion, duracion_min<br />
              ventana_tipo, ventana_inicio, ventana_fin
            </div>
          </div>

          <div className="demo-btn-row">
            <button className="btn-demo" onClick={loadDemoCentro}>
              <Zap size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
              Madrid Centro
            </button>
            <button className="btn-demo" onClick={loadDemoNorte}>
              <Zap size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
              Madrid Norte
            </button>
          </div>
        </>
      )}
    </div>
  )
}
