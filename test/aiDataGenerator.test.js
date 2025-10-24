/**
 * AI Data Generator Tests
 *
 * Test cases for aiDataGenerator module covering:
 * - Contact and company generation
 * - Deal generation
 * - Note, call, task, ticket generation
 * - Fallback behavior when AI unavailable
 * - Metrics tracking
 * - Health status reporting
 * - Error handling and retries
 */

const assert = require('assert')

describe('aiDataGenerator', () => {
  let aiGenerator
  let mockRedis
  let originalEnv

  beforeEach(() => {
    // Store original env vars
    originalEnv = { ...process.env }

    // Mock Redis client
    mockRedis = {
      hIncrBy: async () => {},
      hSet: async () => {},
      hGetAll: async () => ({}),
      get: async () => null,
      set: async () => {}
    }

    // Disable AI by default for most tests (use fallback)
    process.env.AI_ENABLED = 'false'
    delete process.env.ANTHROPIC_API_KEY

    // Force reload module to pick up env changes
    delete require.cache[require.resolve('../server/aiDataGenerator')]
    aiGenerator = require('../server/aiDataGenerator')
  })

  afterEach(() => {
    // Restore env vars
    process.env = originalEnv
  })

  describe('generateContactAndCompany (fallback)', () => {
    it('should generate contact and company with fallback when AI disabled', async () => {
      const context = {
        index: 1,
        scenario: 'B2B',
        distribution_method: 'EVEN'
      }

      const result = await aiGenerator.generateContactAndCompany(context)

      assert.ok(result.contact, 'Should have contact')
      assert.ok(result.company, 'Should have company')
      assert.ok(result.contact.firstname, 'Contact should have firstname')
      assert.ok(result.contact.lastname, 'Contact should have lastname')
      assert.ok(result.contact.email, 'Contact should have email')
      assert.ok(result.contact.simcrm_original_source, 'Contact should have simcrm_original_source')
      assert.ok(result.contact.simcrm_buyer_role, 'Contact should have simcrm_buyer_role')
      assert.ok(result.contact.simcrm_engagement_score, 'Contact should have simcrm_engagement_score')
      assert.ok(result.contact.simcrm_lead_temperature, 'Contact should have simcrm_lead_temperature')
      assert.ok(result.company.name, 'Company should have name')
      assert.ok(result.company.domain, 'Company should have domain')
      assert.ok(result.company.industry, 'Company should have industry')
    })

    it('should generate different data for different indices', async () => {
      const context1 = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const context2 = { index: 2, scenario: 'B2B', distribution_method: 'EVEN' }

      const result1 = await aiGenerator.generateContactAndCompany(context1)
      const result2 = await aiGenerator.generateContactAndCompany(context2)

      assert.notStrictEqual(result1.contact.email, result2.contact.email, 'Should generate different emails')
    })

    it('should include generation metadata indicating fallback', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      const contactMetadata = JSON.parse(result.contact.simcrm_generation_metadata)
      assert.strictEqual(contactMetadata.method, 'fallback', 'Should indicate fallback method')
      assert.ok(contactMetadata.timestamp, 'Should have timestamp')
      assert.ok(contactMetadata.latencyMs >= 0, 'Should have latency')
    })

    it('should generate B2B-appropriate data for B2B scenario', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      const b2bIndustries = ['Technology', 'Manufacturing', 'Healthcare', 'Finance', 'Consulting']
      assert.ok(b2bIndustries.includes(result.company.industry), 'Should use B2B industry')
    })

    it('should generate B2C-appropriate data for B2C scenario', async () => {
      const context = { index: 1, scenario: 'B2C', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      const b2cIndustries = ['Retail', 'E-commerce', 'Services', 'Consumer Goods', 'Hospitality']
      assert.ok(b2cIndustries.includes(result.company.industry), 'Should use B2C industry')
    })
  })

  describe('generateDeal (fallback)', () => {
    it('should generate deal data with fallback', async () => {
      const context = {
        index: 1,
        scenario: 'B2B',
        contactData: {
          contact: { firstname: 'John' },
          company: { name: 'Acme Corp' }
        }
      }

      const result = await aiGenerator.generateDeal(context)

      assert.ok(result.dealname, 'Should have deal name')
      assert.ok(result.amount, 'Should have amount')
      assert.ok(result.closedate, 'Should have close date')
      assert.ok(result.simcrm_product_interest, 'Should have product interest')
      assert.ok(result.simcrm_sales_notes, 'Should have sales notes')
    })

    it('should generate numeric amount as string', async () => {
      const context = { index: 1, scenario: 'B2B', contactData: {} }
      const result = await aiGenerator.generateDeal(context)

      assert.strictEqual(typeof result.amount, 'string', 'Amount should be string')
      assert.ok(!isNaN(parseInt(result.amount, 10)), 'Amount should be parseable as number')
    })
  })

  describe('generateNote (fallback)', () => {
    it('should generate note data with fallback', async () => {
      const context = {
        index: 1,
        contactData: {
          contact: { firstname: 'Jane' }
        }
      }

      const result = await aiGenerator.generateNote(context)

      assert.ok(result.body, 'Should have note body')
      assert.strictEqual(typeof result.body, 'string', 'Body should be string')
      assert.ok(result.body.length > 10, 'Body should be meaningful text')
    })
  })

  describe('generateCall (fallback)', () => {
    it('should generate call data with fallback', async () => {
      const context = {
        index: 1,
        contactData: {
          contact: { firstname: 'Bob' }
        }
      }

      const result = await aiGenerator.generateCall(context)

      assert.ok(result.body, 'Should have call body')
      assert.strictEqual(result.status, 'COMPLETED', 'Should have COMPLETED status')
      assert.ok(result.duration, 'Should have duration')
      assert.strictEqual(typeof result.duration, 'string', 'Duration should be string')
    })

    it('should generate realistic call duration', async () => {
      const context = { index: 1, contactData: {} }
      const result = await aiGenerator.generateCall(context)

      const duration = parseInt(result.duration, 10)
      assert.ok(duration >= 300 && duration <= 1800, 'Duration should be between 5-30 minutes')
    })
  })

  describe('generateTask (fallback)', () => {
    it('should generate task data with fallback', async () => {
      const context = {
        index: 1,
        contactData: {
          contact: { firstname: 'Alice' }
        }
      }

      const result = await aiGenerator.generateTask(context)

      assert.ok(result.subject, 'Should have task subject')
      assert.ok(result.body, 'Should have task body')
      assert.strictEqual(result.status, 'NOT_STARTED', 'Should have NOT_STARTED status')
    })
  })

  describe('generateTicket (fallback)', () => {
    it('should generate ticket data with fallback', async () => {
      const context = {
        index: 1,
        contactData: {
          contact: { firstname: 'Charlie' }
        }
      }

      const result = await aiGenerator.generateTicket(context)

      assert.ok(result.subject, 'Should have ticket subject')
      assert.ok(result.content, 'Should have ticket content')
    })
  })

  describe('metrics tracking', () => {
    it('should track fallback metrics in Redis', async () => {
      let trackedMetrics = {}
      const mockRedisWithTracking = {
        hIncrBy: async (key, field, value) => {
          if (!trackedMetrics[key]) trackedMetrics[key] = {}
          trackedMetrics[key][field] = (trackedMetrics[key][field] || 0) + value
        },
        hSet: async (key, field, value) => {
          if (!trackedMetrics[key]) trackedMetrics[key] = {}
          if (typeof field === 'object') {
            Object.assign(trackedMetrics[key], field)
          } else {
            trackedMetrics[key][field] = value
          }
        }
      }

      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      await aiGenerator.generateContactAndCompany(context, mockRedisWithTracking, 'sim-123')

      const simMetrics = trackedMetrics['sim:sim-123:metrics']
      assert.ok(simMetrics, 'Should track metrics')
      assert.strictEqual(simMetrics.ai_generation_fallback, 1, 'Should increment fallback count')
    })
  })

  describe('health status', () => {
    it('should return health status', () => {
      const health = aiGenerator.getHealthStatus()

      assert.ok(health, 'Should return health object')
      assert.strictEqual(typeof health.enabled, 'boolean', 'Should have enabled flag')
      assert.ok(health.provider, 'Should have provider')
      assert.ok(health.model, 'Should have model')
      assert.strictEqual(typeof health.apiKeyConfigured, 'boolean', 'Should have apiKeyConfigured flag')
    })

    it('should report API key not configured when not set', () => {
      const health = aiGenerator.getHealthStatus()
      assert.strictEqual(health.apiKeyConfigured, false, 'Should report API key not configured')
    })

    it('should report disabled when AI_ENABLED=false', () => {
      const health = aiGenerator.getHealthStatus()
      assert.strictEqual(health.enabled, false, 'Should report disabled')
    })
  })

  describe('custom simcrm_ properties', () => {
    it('should include all required custom properties on contacts', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      const requiredProps = [
        'simcrm_original_source',
        'simcrm_buyer_role',
        'simcrm_engagement_score',
        'simcrm_lead_temperature',
        'simcrm_marketing_consent_detail'
      ]

      for (const prop of requiredProps) {
        assert.ok(result.contact[prop], `Contact should have ${prop}`)
      }
    })

    it('should include all required custom properties on companies', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      const requiredProps = [
        'simcrm_original_source',
        'simcrm_product_interest'
      ]

      for (const prop of requiredProps) {
        assert.ok(result.company[prop], `Company should have ${prop}`)
      }
    })

    it('should include all required custom properties on deals', async () => {
      const context = { index: 1, scenario: 'B2B', contactData: {} }
      const result = await aiGenerator.generateDeal(context)

      const requiredProps = [
        'simcrm_product_interest',
        'simcrm_sales_notes'
      ]

      for (const prop of requiredProps) {
        assert.ok(result[prop], `Deal should have ${prop}`)
      }
    })

    it('should set buyer_role to valid value', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      const validRoles = ['Decision Maker', 'Influencer', 'End User', 'Champion']
      assert.ok(validRoles.includes(result.contact.simcrm_buyer_role), 'Should have valid buyer role')
    })

    it('should set lead_temperature to valid value', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      const validTemps = ['hot', 'warm', 'cold']
      assert.ok(validTemps.includes(result.contact.simcrm_lead_temperature), 'Should have valid lead temperature')
    })

    it('should set product_interest as JSON string', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      assert.doesNotThrow(() => {
        JSON.parse(result.company.simcrm_product_interest)
      }, 'Product interest should be valid JSON')
    })
  })

  describe('error handling', () => {
    it('should not throw when Redis is unavailable', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }

      // Should not throw
      await assert.doesNotReject(async () => {
        await aiGenerator.generateContactAndCompany(context, null, 'sim-123')
      }, 'Should handle null Redis gracefully')
    })

    it('should handle missing contactData gracefully', async () => {
      const context = { index: 1, scenario: 'B2B' }

      await assert.doesNotReject(async () => {
        await aiGenerator.generateDeal(context)
        await aiGenerator.generateNote(context)
        await aiGenerator.generateCall(context)
        await aiGenerator.generateTask(context)
        await aiGenerator.generateTicket(context)
      }, 'Should handle missing contactData')
    })
  })

  describe('data quality', () => {
    it('should generate unique emails for sequential indices', async () => {
      const emails = new Set()

      for (let i = 0; i < 10; i++) {
        const context = { index: i, scenario: 'B2B', distribution_method: 'EVEN' }
        const result = await aiGenerator.generateContactAndCompany(context)
        emails.add(result.contact.email)
      }

      assert.strictEqual(emails.size, 10, 'Should generate 10 unique emails')
    })

    it('should generate unique domains for sequential indices', async () => {
      const domains = new Set()

      for (let i = 0; i < 10; i++) {
        const context = { index: i, scenario: 'B2B', distribution_method: 'EVEN' }
        const result = await aiGenerator.generateContactAndCompany(context)
        domains.add(result.company.domain)
      }

      assert.strictEqual(domains.size, 10, 'Should generate 10 unique domains')
    })

    it('should generate valid email format', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      assert.ok(emailRegex.test(result.contact.email), 'Should generate valid email format')
    })

    it('should generate valid phone format', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      const phoneRegex = /^\+1-\d{3}-\d{4}$/
      assert.ok(phoneRegex.test(result.contact.phone), 'Should generate valid phone format')
    })

    it('should not use example.com domains', async () => {
      const context = { index: 1, scenario: 'B2B', distribution_method: 'EVEN' }
      const result = await aiGenerator.generateContactAndCompany(context)

      assert.ok(!result.company.domain.includes('example.com'), 'Should not use example.com')
      assert.ok(!result.contact.email.includes('example.com'), 'Should not use example.com in email')
    })
  })
})
