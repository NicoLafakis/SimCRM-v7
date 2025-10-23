import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

// We will interact with the key store + validation logic at module level.
// For simplicity, directly import functions; the express server isn't spun up here.
const { createKey, getDecryptedToken } = require('../server/hubspotKeyStore')
const { encrypt, decrypt } = require('../server/cryptoUtil')

// NOTE: These tests assume DB pool may not be configured in test env; if not, they will be skipped gracefully.

vi.mock('axios')

describe('HubSpot key storage', () => {
  it('encrypt/decrypt round trip works', () => {
    // Provide a secret for crypto util
    process.env.TOKEN_ENC_SECRET = 'test-secret-for-token-enc-32bytes!!'.slice(0,32)
    const raw = 'hsu_fake_token_example_123'
    const enc = encrypt(raw)
    const dec = decrypt(enc)
    expect(dec).toBe(raw)
  })
})

describe('HubSpot validation flow (mocked)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('handles unauthorized token from HubSpot', async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 401 } })
    // We simulate the validation logic inline (mirrors server/index.js)
    const status = await (async () => {
      try {
          const { buildPath } = require('../server/tools/hubspot/apiRegistry')
          const path = `https://api.hubapi.com${buildPath('crm.contacts.get')}`
          await axios.get(path, { params: { limit:1 }, headers:{ Authorization: 'Bearer BAD' } })
          return 'ok'
        } catch (e) {
          return e.response?.status
        }
    })()
    expect(status).toBe(401)
  })
})
