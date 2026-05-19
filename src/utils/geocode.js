export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export async function geocode(address) {
  // Handle coordinate strings like "40.41610, -3.70278" (from geolocation button)
  const coordMatch = address.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/)
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]), display: address }
  }

  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}` +
    `&format=json&limit=1&countrycodes=es`

  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
  const data = await res.json()
  if (!data.length) return null
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    display: data[0].display_name,
  }
}
