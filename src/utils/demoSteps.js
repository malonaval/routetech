// Each step: selector (CSS selector for spotlight target, null = welcome modal),
// title, body (sales copy), position ('top'|'bottom'|'left'|'right')
const DEMO_STEPS = [
  {
    selector: null,
    title: 'Bienvenido a RouteTech',
    body: 'Optimización de rutas con IA para equipos de campo. En menos de 30 segundos tendrás la ruta perfecta para todo tu equipo.',
    position: 'center',
  },
  {
    selector: '.drop-zone',
    title: 'Importa tus órdenes',
    body: 'Carga el Excel o CSV que ya tienes: cliente, dirección, duración y ventana horaria. Sin cambiar tu forma de trabajar — RouteTech se adapta a ti.',
    position: 'right',
  },
  {
    selector: '.ot-scroll',
    title: 'Tus órdenes, al detalle',
    body: 'Cada visita con su duración, cliente y ventana horaria. Puedes editar cualquier dato antes de optimizar.',
    position: 'right',
  },
  {
    selector: '.origin-row',
    title: 'Define dónde empieza el día',
    body: 'El técnico sale desde su casa, almacén o cualquier dirección. También detecta su ubicación GPS.',
    position: 'right',
  },
  {
    selector: '[data-tour="fuel-config"]',
    title: 'Ahorro real en combustible',
    body: 'Configura el consumo de tu vehículo y el precio de la gasolina. RouteTech calculará automáticamente cuánto dinero ahorras cada día con la ruta optimizada.',
    position: 'right',
  },
  {
    selector: '.btn-optimize',
    title: 'Un clic, ruta perfecta',
    body: 'La IA analiza todas las combinaciones posibles, respeta las ventanas horarias fijas y minimiza los kilómetros.',
    position: 'top',
  },
  {
    selector: '.leaflet-container',
    title: 'Ruta real con tráfico',
    body: 'No estimaciones — kilómetros y tiempos reales usando Google Maps con tráfico en tiempo real.',
    position: 'left',
  },
  {
    selector: '.savings-table',
    title: 'Lo que ahorras, en números',
    body: 'Minutos ganados, kilómetros menos y ahorro en combustible calculados automáticamente.',
    position: 'left',
  },
  {
    selector: '.call-section',
    title: 'Renegocia antes de salir',
    body: 'La IA detecta qué clientes conviene llamar para mover su cita y hacer la ruta aún más eficiente.',
    position: 'left',
  },
  {
    selector: '[data-tour="multi-demo"]',
    title: 'Para equipos completos',
    body: '¿Varios técnicos? Sube un único archivo con todos sus clientes. La IA distribuye automáticamente las órdenes entre técnicos, optimiza la ruta de cada uno y respeta sus horarios individuales.',
    position: 'top',
  },
  {
    selector: '.leaflet-container',
    title: 'Reparto equitativo automático',
    body: 'Mira el mapa: Carlos (azul, zona norte) y Ana (rojo, zona sur) con rutas completamente independientes. Carlos termina a las 17:15 con 14,8 km — Ana a las 17:20 con 15,6 km. La IA lo calcula en segundos.',
    position: 'left',
  },
]

export default DEMO_STEPS
