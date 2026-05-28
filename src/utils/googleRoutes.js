// Decodifica el formato de polilínea codificada de Google Maps
function decodePolyline(encoded) {
  const points = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : (result >> 1)
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : (result >> 1)
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

// Geocodifica una dirección usando Google Geocoding API
export async function geocodeGoogle(address, apiKey) {
  const params = new URLSearchParams({
    address,
    key: apiKey,
    language: 'es',
    region: 'es',
    components: 'country:ES',
  })
  const res = await fetch(`/api/gmaps/maps/api/geocode/json?${params}`)
  const data = await res.json()
  if (data.status !== 'OK' || !data.results.length) return null
  const { lat, lng } = data.results[0].geometry.location
  return { lat, lng, display: data.results[0].formatted_address }
}

// Llama a Directions API para un tramo único (sin waypoints → garantiza duration_in_traffic)
async function fetchLeg(apiKey, fromCoords, toCoords) {
  const departureTime = String(Math.floor(Date.now() / 1000))
  const params = new URLSearchParams({
    origin:         `${fromCoords.lat},${fromCoords.lng}`,
    destination:    `${toCoords.lat},${toCoords.lng}`,
    key:            apiKey,
    language:       'es',
    region:         'es',
    mode:           'driving',
    departure_time: departureTime,
    traffic_model:  'best_guess',
  })
  const res  = await fetch(`/api/gmaps/maps/api/directions/json?${params}`)
  const data = await res.json()
  if (data.status !== 'OK') throw new Error(`Google Directions: ${data.status}`)
  const leg = data.routes[0].legs[0]
  return {
    durationSecs:          leg.duration_in_traffic?.value ?? leg.duration.value,
    durationMins:          Math.round((leg.duration_in_traffic?.value ?? leg.duration.value) / 60),
    durationText:          leg.duration_in_traffic?.text  ?? leg.duration.text,
    hasRealTraffic:        !!leg.duration_in_traffic,
    durationNoTrafficMins: Math.round(leg.duration.value / 60),
    distanceM:             leg.distance.value,
    distanceText:          leg.distance.text,
    distanceKm:            (leg.distance.value / 1000).toFixed(1),
    polyline:              data.routes[0].overview_polyline.points,
  }
}

// Calcula la ruta CSV original (una sola llamada, sin tráfico) para comparar km reales de carretera
// orderedCoords: [{lat, lng},...] en orden CSV ya geocodificados
export async function getNaiveGoogleRoute(apiKey, originCoords, orderedCoords) {
  const valid = orderedCoords.filter(Boolean)
  if (!valid.length || !originCoords) return null

  const allPts = [originCoords, ...valid]
  const origin      = `${allPts[0].lat},${allPts[0].lng}`
  const destination = `${allPts[allPts.length - 1].lat},${allPts[allPts.length - 1].lng}`
  const middle      = allPts.slice(1, -1).map(c => `${c.lat},${c.lng}`).join('|')

  const params = new URLSearchParams({
    origin,
    destination,
    key:      apiKey,
    language: 'es',
    region:   'es',
    mode:     'driving',
  })
  if (middle) params.set('waypoints', middle)

  const res  = await fetch(`/api/gmaps/maps/api/directions/json?${params}`)
  const data = await res.json()
  if (data.status !== 'OK') return null

  const route  = data.routes[0]
  const totalKm = (route.legs.reduce((s, l) => s + l.distance.value, 0) / 1000).toFixed(1)
  return {
    polylinePoints: decodePolyline(route.overview_polyline.points),
    totalKm: parseFloat(totalKm),
  }
}

// Calcula la ruta real con tráfico: una llamada por tramo para garantizar duration_in_traffic
// orderedStops: [{ coords: {lat, lng}, order, stop }, ...]
export async function getGoogleRoute(apiKey, originCoords, orderedStops) {
  const valid = orderedStops.filter(s => s.coords)
  if (!valid.length || !originCoords) return null

  // Construir lista de puntos: origen + todas las paradas
  const points = [originCoords, ...valid.map(s => s.coords)]

  // Una petición por tramo en paralelo
  const legPromises = []
  for (let i = 0; i < points.length - 1; i++) {
    legPromises.push(fetchLeg(apiKey, points[i], points[i + 1]))
  }
  const legs = await Promise.all(legPromises)

  // Concatenar polylines de cada tramo
  const allPoints = legs.flatMap(l => decodePolyline(l.polyline))

  return {
    polylinePoints: allPoints,
    legs,
    totalKm:   (legs.reduce((s, l) => s + l.distanceM, 0) / 1000).toFixed(1),
    totalMins: legs.reduce((s, l) => s + l.durationMins, 0),
  }
}
