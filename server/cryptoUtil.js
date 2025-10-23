const crypto = require('crypto')

// AES-256-GCM encryption helper. Requires TOKEN_ENC_SECRET (32 bytes preferred).
// If secret shorter, it's hashed to 32 bytes via SHA-256.
function getKey() {
  const raw = process.env.TOKEN_ENC_SECRET || ''
  if (!raw) throw new Error('TOKEN_ENC_SECRET not set')
  if (Buffer.byteLength(raw) === 32) return Buffer.from(raw)
  return crypto.createHash('sha256').update(raw).digest()
}

function encrypt(plain) {
  const key = getKey()
  const iv = crypto.randomBytes(12) // GCM standard nonce length
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64') // store iv|tag|ciphertext
}

function decrypt(b64) {
  const key = getKey()
  const buf = Buffer.from(b64, 'base64')
  const iv = buf.subarray(0,12)
  const tag = buf.subarray(12,28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

module.exports = { encrypt, decrypt }
