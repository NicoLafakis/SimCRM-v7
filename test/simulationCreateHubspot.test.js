import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import knexConfig from '../knexfile.js'
import knex from 'knex'

// This test performs a direct DB insert via the existing POST logic would require spinning up server.
// Simplify: Reuse the same hashing / field assignment pattern by requiring server/index would start listener (undesired in test env).
// Instead, mimic the core part: ensure DB columns accept values and JSON string stored.

const k = knex(knexConfig.test || knexConfig.development || knexConfig)

describe('Simulation hubspot metadata persistence', () => {
  beforeAll(async () => {
    try { await k.migrate.latest() } catch (e) { console.warn('Migration latest failed (may already be applied):', e.message) }
  })
  afterAll(async () => { await k.destroy() })

  it('inserts simulation row with hubspot_pipeline_id and hubspot_owner_ids', async () => {
    const now = Date.now()
    const uniqueId = `test-sim-hubspot-${now}-${Math.random().toString(36).slice(2,8)}`
    const row = {
      id: uniqueId,
      user_id: 'user-x',
      status: 'QUEUED',
      scenario: 'b2b',
      distribution_method: 'linear',
      total_records: 10,
      records_processed: 0,
      start_time: now,
      end_time: now + 3600000,
      created_at: now,
      updated_at: now,
      hubspot_pipeline_id: 'pipe1',
      hubspot_owner_ids: JSON.stringify(['1','2'])
    }
    await k('simulations').insert(row)
    const fetched = await k('simulations').where({ id: row.id }).first()
    expect(fetched.hubspot_pipeline_id).toBe('pipe1')
    expect(JSON.parse(fetched.hubspot_owner_ids)).toEqual(['1','2'])
    // Cleanup so repeated test runs don't accumulate rows
    await k('simulations').where({ id: row.id }).delete()
  })
})
