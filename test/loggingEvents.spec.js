import { describe, it, expect } from 'vitest'

// Basic structural test of logEvents catalog (no runtime log capture here)
import events from '../server/logEvents'

describe('logEvents catalog', () => {
  it('contains required core event IDs', () => {
    const requiredValues = ['SIM_JOB_COMPLETED','SIM_IDEMPOTENCY_SKIP','HS_OP_FAILED','DLQ_REPLAY','SIM_ABORT_FORCE']
    const valueSet = new Set(Object.values(events))
    for (const v of requiredValues) {
      expect(valueSet.has(v)).toBe(true)
    }
  })
})
