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

// Calcula la ruta real con tráfico usando Google Directions API
// orderedStops: [{ coords: {lat, lng}, order, stop }, ...]
export async function getGoogleRoute(apiKey, originCoords, orderedStops) {
  const valid = orderedStops.filter(s => s.coords)
  if (!valid.length || !originCoords) return null

  const origin = `${originCoords.lat},${originCoords.lng}`
  const dest   = `${valid[valid.length - 1].coords.lat},${valid[valid.length - 1].coords.lng}`

  const params = new URLSearchParams({
    origin,
    destination: dest,
    key: apiKey,
    language: 'es',
    region: 'es',
    mode: 'driving',
    departure_time: String(Math.floor(Date.now() / 1000)), // timestamp Unix — más fiable que 'now'
    traffic_model: 'best_guess',
  })

  // Waypoints intermedios (todos excepto el destino final)
  if (valid.length > 1) {
    const wps = valid
      .slice(0, -1)
      .map(s => `${s.coords.lat},${s.coords.lng}`)
      .join('|')
    params.append('waypoints', wps)
  }

  const res = await fetch(`/api/gmaps/maps/api/directions/json?${params}`)
  const data = await res.json()

  if (data.status !== 'OK') {
    throw new Error(
      `Google Directions: ${data.status}${data.error_message ? ' — ' + data.error_message : ''}`
    )
  }

  const route = data.routes[0]

  const legs = route.legs.map(leg => ({
    // duration_in_traffic disponible cuando departure_time=now
    durationSecs:          leg.duration_in_traffic?.value ?? leg.duration.value,
    durationMins:          Math.round((leg.duration_in_traffic?.value ?? leg.duration.value) / 60),
    durationText:          leg.duration_in_traffic?.text  ?? leg.duration.text,
    hasRealTraffic:        !!leg.duration_in_traffic,
    durationNoTrafficMins: Math.round(leg.duration.value / 60),
    distanceM:             leg.distance.value,
    distanceText:          leg.distance.text,
    distanceKm:            (leg.distance.value / 1000).toFixed(1),
  }))

  return {
    polylinePoints: decodePolyline(route.overview_polyline.points),
    legs,
    totalKm: (legs.reduce((s, l) => s + l.distanceM, 0) / 1000).toFixed(1),
    totalMins: legs.reduce((s, l) => s + l.durationMins, 0),
  }
}
