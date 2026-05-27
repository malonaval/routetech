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
    body: 'Carga un Excel o CSV con tus órdenes del día. Sin formación especial — el mismo formato que ya usas.',
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
    body: 'Carga las órdenes de todos tus técnicos juntas y la IA optimiza la ruta de cada uno: mínimos kilómetros, ventanas horarias respetadas y reparto equitativo de trabajo.',
    position: 'top',
  },
  {
    selector: '.worker-breakdown',
    title: 'Reparto equitativo automático',
    body: 'Sin hojas de cálculo ni coordinadores asignando visitas a mano. La IA redistribuye las órdenes para que todos los técnicos terminen a la misma hora y nadie haga kilómetros de más.',
    position: 'left',
  },
]

export default DEMO_STEPS
