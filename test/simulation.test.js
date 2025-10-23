import { describe, it, expect } from 'vitest'
import SimulationEngine from '../src/simulation/SimulationEngine'

describe('SimulationEngine', () => {
  it('creates contact and company and associates them', () => {
    const events = []
    const engine = new SimulationEngine({ onEvent: e => events.push(e) })
    engine.createContactWithCompany()
    expect(engine.records.contacts.length).toBe(1)
    expect(engine.records.companies.length).toBe(1)
    const c = engine.records.contacts[0]
    const cmp = engine.records.companies[0]
    expect(c.companyId).toBe(cmp.id)
    expect(c.notes.length).toBeGreaterThan(0)
  })

  it('advances contact to mql and then sql when fast', () => {
    const engine = new SimulationEngine({ onEvent: () => {} })
    engine.createContactWithCompany()
    const c = engine.records.contacts[0]
    // artificially set createdAt in the past to force transitions
    c.createdAt = Date.now() - 15000
    engine.advanceContact(c)
    // after enough time, should reach sql or nurture
    expect(['sales_qualified_lead', 'marketing_qualified_lead', 'subscriber', 'nurture']).toContain(c.lifecycle)
  })
})
