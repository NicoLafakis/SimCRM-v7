// Simple Redis-backed idempotency utility
// acquireIdempotency(key, ttlMs) -> true if acquired, false if already seen

let redisClient = null
async function getRedis() {
  if (redisClient) return redisClient
  if (!process.env.REDIS_HOST && !process.env.REDIS_URL) return null
  const { createClient } = require('redis')
  try {
    if (process.env.REDIS_URL) {
      redisClient = createClient({ url: process.env.REDIS_URL })
    } else {
      redisClient = createClient({
        socket: { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT,10) : 6379 },
        password: process.env.REDIS_PASSWORD || undefined,
        database: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB,10) : undefined,
      })
    }
    await redisClient.connect()
  } catch (e) {
    try { if (redisClient) redisClient.disconnect() } catch {}
    redisClient = null
  }
  return redisClient
}

async function acquireIdempotency(key, ttlMs = 24 * 60 * 60 * 1000) {
  const r = await getRedis()
  if (!r) return true // fallback allow
  try {
    const res = await r.set(key, '1', { NX: true, PX: ttlMs })
    return !!res
  } catch { return true }
}

function idempotencyKey(simId, overrideVersion, index) {
  return `idem:${simId}:${overrideVersion || 0}:${index}`
}

async function resetIdempotencyForSimulation(simId) {
  const r = await getRedis()
  if (!r) return 0
  // Pattern scan (potentially many keys). Keep scope: idem:{simId}*
  const pattern = `idem:${simId}:*`
  let cursor = 0
  let removed = 0
  do {
    const reply = await r.scan(cursor, { MATCH: pattern, COUNT: 200 })
    cursor = parseInt(reply.cursor,10)
    const keys = reply.keys || []
    if (keys.length) {
      try { removed += await r.del(keys) } catch {}
    }
  } while (cursor !== 0)
  return removed
}

module.exports = { acquireIdempotency, idempotencyKey, resetIdempotencyForSimulation }
