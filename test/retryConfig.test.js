import { describe, it, expect } from 'vitest'
import { getRetryConfig } from '../server/jobRetryConfig'

describe('Retry config', () => {
  it('returns defaults snapshot shape', () => {
    const cfg = getRetryConfig()
    expect(cfg.contact.attempts).toBeGreaterThan(0)
    expect(Array.isArray(cfg.contact.backoff)).toBe(true)
  })

  it('legacy naming overrides contact backoff', () => {
    process.env.BACKOFF_CONTACT = '0,100,300'
    delete require.cache[require.resolve('../server/jobRetryConfig')]
    const { getRetryConfig: fresh } = require('../server/jobRetryConfig')
    const cfg = fresh()
    expect(cfg.contact.backoff).toEqual([0,100,300])
    delete process.env.BACKOFF_CONTACT
    delete require.cache[require.resolve('../server/jobRetryConfig')]
  })

  it('new naming overrides legacy (precedence)', () => {
    process.env.BACKOFF_CONTACT = '0,100'
    process.env.CONTACT_BACKOFF_MS = '50,75,125'
    process.env.ATTEMPTS_CONTACT = '2'
    process.env.CONTACT_ATTEMPTS = '5'
    delete require.cache[require.resolve('../server/jobRetryConfig')]
    const { getRetryConfig: fresh } = require('../server/jobRetryConfig')
    const cfg = fresh()
    expect(cfg.contact.attempts).toBe(5)
    expect(cfg.contact.backoff).toEqual([50,75,125])
    // cleanup
    delete process.env.BACKOFF_CONTACT
    delete process.env.CONTACT_BACKOFF_MS
    delete process.env.ATTEMPTS_CONTACT
    delete process.env.CONTACT_ATTEMPTS
    delete require.cache[require.resolve('../server/jobRetryConfig')]
  })

  it('normalizes backoff length if too short for attempts', () => {
    process.env.CONTACT_ATTEMPTS = '4'
    process.env.CONTACT_BACKOFF_MS = '10,20' // only 2 intervals; needs 3 for attempts-1
    delete require.cache[require.resolve('../server/jobRetryConfig')]
    const { getRetryConfig: fresh } = require('../server/jobRetryConfig')
    const cfg = fresh()
    expect(cfg.contact.backoff.length).toBe(3)
    expect(cfg.contact.backoff).toEqual([10,20,20])
    delete process.env.CONTACT_ATTEMPTS
    delete process.env.CONTACT_BACKOFF_MS
    delete require.cache[require.resolve('../server/jobRetryConfig')]
  })
})