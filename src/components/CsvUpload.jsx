import { useState } from 'react'
import { Upload, Zap, Check } from 'lucide-react'

const DEMO_CSV = `cliente,direccion,duracion_min,ventana_tipo,ventana_inicio,ventana_fin,telefono
María García,Calle de Alcalá 120 Madrid,60,fija,09:00,10:00,+34 612 345 678
Carlos López,Calle de Bravo Murillo 78 Madrid,45,flexible,,,+34 623 456 789
Ana Martínez,Paseo de las Delicias 56 Madrid,30,fija,11:30,12:30,+34 634 567 890
Pedro Jiménez,Calle de Embajadores 34 Madrid,45,flexible,,,+34 645 678 901
Laura Rodríguez,Calle de Fuencarral 102 Madrid,60,flexible,,,+34 656 789 012
Miguel Fernández,Calle de Toledo 89 Madrid,30,fija,13:00,14:00,+34 667 890 123
Carmen Sánchez,Calle de Santa Engracia 67 Madrid,45,flexible,,,+34 678 901 234
Antonio Ruiz,Calle de Fernández de los Ríos 45 Madrid,30,flexible,,,+34 689 012 345
Isabel Moreno,Calle de O'Donnell 42 Madrid,60,fija,17:00,18:00,+34 690 123 456
Francisco Díaz,Avenida de Entrevías 23 Madrid,45,flexible,,,+34 601 234 567`

const DEMO_CSV_NORTE = `cliente,direccion,duracion_min,ventana_tipo,ventana_inicio,ventana_fin,telefono
Elena Vázquez,Calle de Silvano 12 Madrid,60,fija,09:00,10:00,+34 611 111 001
Roberto Iglesias,Avenida de Manoteras 34 Madrid,45,flexible,,,+34 622 222 002
Sofía Castro,Calle de Arturo Soria 180 Madrid,30,fija,11:00,12:00,+34 633 333 003
Javier Morales,Calle del Mar Egeo 8 Madrid,45,flexible,,,+34 644 444 004
Patricia Núñez,Avenida de San Luis 45 Madrid,60,flexible,,,+34 655 555 005
Andrés Herrero,Calle de Sanchinarro 23 Madrid,30,fija,13:30,14:30,+34 666 666 006
Lucía Domínguez,Calle de las Tablas 67 Madrid,45,flexible,,,+34 677 777 007
Manuel Romero,Avenida de Montecarmelo 15 Madrid,30,flexible,,,+34 688 888 008
Teresa Alonso,Calle del Padre Damián 28 Madrid,60,fija,16:00,17:00,+34 699 999 009
Gonzalo Reyes,Calle de Hortaleza 120 Madrid,45,flexible,,,+34 600 000 010`

const DEMO_CSV_MULTIWORKER = `cliente,direccion,duracion_min,ventana_tipo,ventana_inicio,ventana_fin,telefono,trabajador,horario
María García,Calle de Alcalá 120 Madrid,60,fija,09:00,10:00,+34 612 345 678,Carlos,09:00-18:00
Carlos López,Calle de Bravo Murillo 78 Madrid,45,flexible,,,+34 623 456 789,Carlos,09:00-18:00
Ana Martínez,Paseo de las Delicias 56 Madrid,30,fija,11:30,12:30,+34 634 567 890,Carlos,09:00-18:00
Pedro Jiménez,Calle de Embajadores 34 Madrid,45,flexible,,,+34 645 678 901,Carlos,09:00-18:00
Laura Rodríguez,Calle de Fuencarral 102 Madrid,60,flexible,,,+34 656 789 012,Carlos,09:00-18:00
Miguel Fernández,Calle de Toledo 89 Madrid,30,fija,13:00,14:00,+34 667 890 123,Carlos,09:00-18:00
Carmen Sánchez,Calle de Santa Engracia 67 Madrid,45,flexible,,,+34 678 901 234,Ana,08:00-17:00
Antonio Ruiz,Calle de Fernández de los Ríos 45 Madrid,30,flexible,,,+34 689 012 345,Ana,08:00-17:00
Isabel Moreno,Calle de O'Donnell 42 Madrid,60,fija,17:00,18:00,+34 690 123 456,Ana,08:00-17:00
Francisco Díaz,Avenida de Entrevías 23 Madrid,45,flexible,,,+34 601 234 567,Ana,08:00-17:00
Elena Vázquez,Calle de Silvano 12 Madrid,60,fija,09:00,10:00,+34 611 111 001,Ana,08:00-17:00
Roberto Iglesias,Avenida de Manoteras 34 Madrid,45,flexible,,,+34 622 222 002,Ana,08:00-17:00`

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
        telefono: row.telefono || row.phone || row.tel || '',
        trabajador: row.trabajador || '',
        horario: row.horario || '',
      })
    }
  }
  return orders
}

function parseWorkersFromOrders(orders) {
  const map = {}
  orders.forEach(o => {
    const id = o.trabajador || 'default'
    if (!map[id]) map[id] = { id, horario: o.horario || '09:00-18:00', orders: [] }
    map[id].orders.push(o)
  })
  return Object.values(map)
}

export default function CsvUpload({ onOrdersLoaded, onWorkersLoaded, hasOrders, orderCount = 0 }) {
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
      if (!orders.length) return
      const hasWorkerCol = orders.some(o => o.trabajador)
      if (hasWorkerCol && onWorkersLoaded) {
        const workers = parseWorkersFromOrders(orders)
        onWorkersLoaded(workers)
        setExpanded(false)
      } else {
        onOrdersLoaded(orders)
        setExpanded(false)
      }
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

  const loadDemoMulti = () => {
    const orders = parseCSVText(DEMO_CSV_MULTIWORKER)
    if (orders.length && onWorkersLoaded) {
      onWorkersLoaded(parseWorkersFromOrders(orders))
      setExpanded(false)
    }
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
              ventana_tipo, ventana_inicio, ventana_fin, telefono
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
            <button className="btn-demo" onClick={loadDemoMulti}>
              <Zap size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
              2 Trabajadores
            </button>
          </div>
        </>
      )}
    </div>
  )
}
