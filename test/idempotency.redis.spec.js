import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { acquireIdempotency, idempotencyKey, resetIdempotencyForSimulation } from '../server/idempotency'

// This test expects a local Redis reachable via REDIS_HOST/REDIS_PORT or REDIS_URL.
// Skips gracefully if not present.
let redisAvailable = true

beforeAll(async () => {
  if (!process.env.REDIS_HOST && !process.env.REDIS_URL) {
    redisAvailable = false
  }
})

describe('idempotency with real redis (optional)', () => {
  it('acquires then rejects second acquire for same key', async () => {
    if (!redisAvailable) return
    const key = idempotencyKey('sim-test', 0, 1)
    const first = await acquireIdempotency(key, 5000)
    const second = await acquireIdempotency(key, 5000)
    expect(first).toBe(true)
    expect(second).toBe(false)
  })
  it('reset removes keys', async () => {
    if (!redisAvailable) return
    const k1 = idempotencyKey('sim-reset', 0, 1)
    await acquireIdempotency(k1, 5000)
    const removed = await resetIdempotencyForSimulation('sim-reset')
    expect(removed).toBeGreaterThanOrEqual(1)
  })
})
