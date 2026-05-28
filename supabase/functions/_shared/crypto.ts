function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

async function getKey(mode: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const raw = hexToBytes(Deno.env.get('ENCRYPTION_KEY') ?? '')
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [mode])
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey('encrypt')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )
  const combined = new Uint8Array(12 + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), 12)
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(encoded: string): Promise<string> {
  const key = await getKey('decrypt')
  const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}

export async function encryptIfPresent(v: string | null | undefined): Promise<string | null> {
  if (!v) return null
  return encrypt(v)
}

export async function decryptIfPresent(v: string | null | undefined): Promise<string | null> {
  if (!v) return null
  return decrypt(v)
}
