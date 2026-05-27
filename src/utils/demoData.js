// Pre-baked demo data for the guided tour.
// Injected by handleDemoStart so the map, savings table and call section
// are populated from step 1 — no API calls required.

export const DEMO_ORIGIN = 'Puerta del Sol, Madrid'

export const DEMO_ORIGIN_COORDS = { lat: 40.4168, lng: -3.7038 }

// Approximate geocoded coordinates for the Madrid Centro demo addresses
const COORDS = {
  'OT-2841': { lat: 40.4191, lng: -3.6790 }, // Alcalá 120
  'OT-2842': { lat: 40.4437, lng: -3.7048 }, // Bravo Murillo 78
  'OT-2843': { lat: 40.4022, lng: -3.6981 }, // Delicias 56
  'OT-2844': { lat: 40.4083, lng: -3.7038 }, // Embajadores 34
  'OT-2845': { lat: 40.4302, lng: -3.7021 }, // Fuencarral 102
  'OT-2846': { lat: 40.4078, lng: -3.7104 }, // Toledo 89
  'OT-2847': { lat: 40.4291, lng: -3.6979 }, // Santa Engracia 67
  'OT-2848': { lat: 40.4319, lng: -3.7148 }, // Fernández de los Ríos 45
  'OT-2849': { lat: 40.4225, lng: -3.6736 }, // O'Donnell 42
  'OT-2850': { lat: 40.3931, lng: -3.6817 }, // Entrevías 23
}

// Order objects — mirrors DEMO_CSV in CsvUpload.jsx
const ORDERS = [
  { id: 'OT-2841', cliente: 'María García',     direccion: 'Calle de Alcalá 120 Madrid',               duracion: 60, ventana_tipo: 'fija',     ventana_inicio: '09:00', ventana_fin: '10:00', telefono: '+34 612 345 678', trabajador: '', horario: '' },
  { id: 'OT-2842', cliente: 'Carlos López',      direccion: 'Calle de Bravo Murillo 78 Madrid',         duracion: 45, ventana_tipo: 'flexible', ventana_inicio: '',      ventana_fin: '',      telefono: '+34 623 456 789', trabajador: '', horario: '' },
  { id: 'OT-2843', cliente: 'Ana Martínez',      direccion: 'Paseo de las Delicias 56 Madrid',          duracion: 30, ventana_tipo: 'fija',     ventana_inicio: '11:30', ventana_fin: '12:30', telefono: '+34 634 567 890', trabajador: '', horario: '' },
  { id: 'OT-2844', cliente: 'Pedro Jiménez',     direccion: 'Calle de Embajadores 34 Madrid',           duracion: 45, ventana_tipo: 'flexible', ventana_inicio: '',      ventana_fin: '',      telefono: '+34 645 678 901', trabajador: '', horario: '' },
  { id: 'OT-2845', cliente: 'Laura Rodríguez',   direccion: 'Calle de Fuencarral 102 Madrid',           duracion: 60, ventana_tipo: 'flexible', ventana_inicio: '',      ventana_fin: '',      telefono: '+34 656 789 012', trabajador: '', horario: '' },
  { id: 'OT-2846', cliente: 'Miguel Fernández',  direccion: 'Calle de Toledo 89 Madrid',                duracion: 30, ventana_tipo: 'fija',     ventana_inicio: '13:00', ventana_fin: '14:00', telefono: '+34 667 890 123', trabajador: '', horario: '' },
  { id: 'OT-2847', cliente: 'Carmen Sánchez',    direccion: 'Calle de Santa Engracia 67 Madrid',        duracion: 45, ventana_tipo: 'flexible', ventana_inicio: '',      ventana_fin: '',      telefono: '+34 678 901 234', trabajador: '', horario: '' },
  { id: 'OT-2848', cliente: 'Antonio Ruiz',      direccion: 'Calle de Fernández de los Ríos 45 Madrid', duracion: 30, ventana_tipo: 'flexible', ventana_inicio: '',      ventana_fin: '',      telefono: '+34 689 012 345', trabajador: '', horario: '' },
  { id: 'OT-2849', cliente: 'Isabel Moreno',     direccion: "Calle de O'Donnell 42 Madrid",             duracion: 60, ventana_tipo: 'fija',     ventana_inicio: '17:00', ventana_fin: '18:00', telefono: '+34 690 123 456', trabajador: '', horario: '' },
  { id: 'OT-2850', cliente: 'Francisco Díaz',    direccion: 'Avenida de Entrevías 23 Madrid',           duracion: 45, ventana_tipo: 'flexible', ventana_inicio: '',      ventana_fin: '',      telefono: '+34 601 234 567', trabajador: '', horario: '' },
]

// Optimised sequence — respects the 4 fixed windows (09:00, 11:30, 13:00, 17:00)
const SEQUENCE = [
  { ot_id: 'OT-2841', position:  1, travel_minutes:  8, window: '09:00 – 10:00' },
  { ot_id: 'OT-2845', position:  2, travel_minutes: 14, window: null },
  { ot_id: 'OT-2842', position:  3, travel_minutes: 10, window: null },
  { ot_id: 'OT-2847', position:  4, travel_minutes: 12, window: null },
  { ot_id: 'OT-2848', position:  5, travel_minutes:  9, window: null },
  { ot_id: 'OT-2843', position:  6, travel_minutes: 16, window: '11:30 – 12:30' },
  { ot_id: 'OT-2846', position:  7, travel_minutes: 11, window: '13:00 – 14:00' },
  { ot_id: 'OT-2844', position:  8, travel_minutes:  7, window: null },
  { ot_id: 'OT-2850', position:  9, travel_minutes: 13, window: null },
  { ot_id: 'OT-2849', position: 10, travel_minutes: 22, window: '17:00 – 18:00' },
]

// stopCoords in optimised order — same shape App.jsx produces after real geocoding
export const DEMO_STOP_COORDS = SEQUENCE.map(stop => ({
  stop,
  order: ORDERS.find(o => o.id === stop.ot_id),
  coords: COORDS[stop.ot_id],
  googleLeg: null,
}))

// Route polyline: origin → stops in sequence order (simplified, no real road trace)
export const DEMO_ROUTE_POLYLINE = [
  [DEMO_ORIGIN_COORDS.lat, DEMO_ORIGIN_COORDS.lng],
  ...SEQUENCE.map(s => [COORDS[s.ot_id].lat, COORDS[s.ot_id].lng]),
]

// Pre-baked multi-worker result — injected at step 10 so .worker-breakdown renders
export const DEMO_MULTI_RESULT = {
  workers: [
    { trabajador: 'Carlos', sequence: [], end_time: '17:15', total_km: 14.8, saving_minutes: 24 },
    { trabajador: 'Ana',    sequence: [], end_time: '17:20', total_km: 15.6, saving_minutes: 23 },
  ],
  global_saving_minutes: 47,
  saving_minutes: 47,
  total_km: 30.4,
  end_time: '17:20',
  reasoning: 'Distribución equitativa entre Carlos (zona norte-este) y Ana (zona sur-oeste). Ambos técnicos terminan con una diferencia de solo 5 minutos.',
  savings_breakdown: {
    original_estimated_km:   47.2,
    optimised_km:            30.4,
    original_estimated_mins: 265,
    optimised_mins:          218,
  },
  call_suggestions: [],
}

// Pre-baked optimisation result — mirrors the Groq single-worker response shape
export const DEMO_RESULT = {
  sequence: SEQUENCE,
  saving_minutes: 47,
  total_km: 32.4,
  total_mins_real: 218,
  end_time: '17:52',
  reasoning: "Ruta optimizada comenzando por el este (ventana fija 09:00 de María García), subiendo al norte para aprovechar recorridos continuos, y cerrando con la ventana fija de las 17:00 en O'Donnell. Las 4 ventanas horarias fijas quedan cubiertas con margen.",
  savings_breakdown: {
    original_estimated_km:   47.2,
    optimised_km:            32.4,
    original_estimated_mins: 265,
    optimised_mins:          218,
  },
  call_suggestions: [
    {
      ot_id:                    'OT-2849',
      cliente:                  'Isabel Moreno',
      current_window:           '17:00 – 18:00',
      suggested_time:           '15:30',
      reason:                   "Su ventana fija al este obliga a regresar al final de la jornada. Moverla a las 15:30 permitiría terminar a las 16:45 y ahorrar 28 minutos.",
      potential_saving_minutes: 28,
    },
  ],
}
