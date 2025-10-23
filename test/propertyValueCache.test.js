/**
 * Property Value Cache Tests
 * 
 * Test cases for propertyValueCache module covering:
 * - Recording and retrieving property values
 * - Email/domain deduplication
 * - Per-simulation caching
 * - Cross-simulation reuse
 */

const assert = require('assert')

describe('propertyValueCache', () => {
  let mockRedis
  let mockLogger
  let propertyValueCache

  beforeEach(() => {
    const cache = {}

    mockRedis = {
      sadd: async (key, value) => {
        if (!cache[key]) cache[key] = new Set()
        cache[key].add(value)
        return 1
      },
      sismember: async (key, value) => {
        return (cache[key] && cache[key].has(value)) ? 1 : 0
      },
      smembers: async (key) => {
        return cache[key] ? Array.from(cache[key]) : []
      },
      set: async (key, value, ex, ttl) => {
        cache[key] = { value, ex, ttl, timestamp: Date.now() }
      },
      setex: async (key, ttl, value) => {
        cache[key] = { value, ttl, timestamp: Date.now() }
      },
      get: async (key) => {
        const item = cache[key]
        return item ? (typeof item === 'object' && item.value ? item.value : item) : null
      },
      exists: async (key) => {
        return cache[key] ? 1 : 0
      },
      del: async (...keys) => {
        keys.forEach(k => delete cache[k])
        return keys.length
      },
      keys: async (pattern) => {
        return Object.keys(cache).filter(k => {
          if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
            return regex.test(k)
          }
          return k === pattern
        })
      },
      expire: async () => {}
    }

    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {}
    }

    const createPropertyValueCache = require('../server/propertyValueCache')
    propertyValueCache = createPropertyValueCache(mockRedis, mockLogger)
  })

  describe('recordValue and getValue', () => {
    it('should record a property value', async () => {
      await propertyValueCache.recordValue('sim123', 'companies', 'industry', 'Technology')
      const value = await propertyValueCache.getValue('sim123', 'companies', 'industry', 'Technology')
      assert.strictEqual(value, 'Technology')
    })

    it('should trim whitespace when recording', async () => {
      await propertyValueCache.recordValue('sim123', 'companies', 'industry', '  Technology  ')
      const value = await propertyValueCache.getValue('sim123', 'companies', 'industry', 'Technology')
      assert.strictEqual(value, 'Technology')
    })

    it('should return null for non-existent value', async () => {
      const value = await propertyValueCache.getValue('sim123', 'companies', 'industry', 'NonExistent')
      assert.strictEqual(value, null)
    })

    it('should not record null or undefined values', async () => {
      await propertyValueCache.recordValue('sim123', 'companies', 'industry', null)
      const hasValue = await propertyValueCache.hasValue('sim123', 'companies', 'industry', null)
      assert.strictEqual(hasValue, false)
    })

    it('should handle missing simId', async () => {
      await propertyValueCache.recordValue(null, 'companies', 'industry', 'Technology')
      // Should not crash
      assert(true)
    })
  })

  describe('hasValue', () => {
    it('should return true for recorded values', async () => {
      await propertyValueCache.recordValue('sim123', 'companies', 'industry', 'Technology')
      const has = await propertyValueCache.hasValue('sim123', 'companies', 'industry', 'Technology')
      assert.strictEqual(has, true)
    })

    it('should return false for unrecorded values', async () => {
      const has = await propertyValueCache.hasValue('sim123', 'companies', 'industry', 'NonExistent')
      assert.strictEqual(has, false)
    })
  })

  describe('cross-simulation reuse', () => {
    it('should store values in global reuse index', async () => {
      await propertyValueCache.recordValue('sim123', 'companies', 'industry', 'Technology')
      const reusable = await propertyValueCache.getReusableValues('companies', 'industry', 10)
      assert(reusable.includes('Technology'))
    })

    it('should retrieve multiple reusable values sorted by timestamp', async () => {
      await propertyValueCache.recordValue('sim123', 'companies', 'industry', 'Technology')
      await propertyValueCache.recordValue('sim124', 'companies', 'industry', 'Real Estate')
      
      const reusable = await propertyValueCache.getReusableValues('companies', 'industry', 10)
      assert.strictEqual(reusable.length, 2)
    })

    it('should respect limit parameter', async () => {
      await propertyValueCache.recordValue('sim1', 'companies', 'industry', 'Tech')
      await propertyValueCache.recordValue('sim2', 'companies', 'industry', 'Estate')
      await propertyValueCache.recordValue('sim3', 'companies', 'industry', 'Retail')
      
      const reusable = await propertyValueCache.getReusableValues('companies', 'industry', 2)
      assert(reusable.length <= 2)
    })

    it('should return empty array for non-existent field', async () => {
      const reusable = await propertyValueCache.getReusableValues('companies', 'nonexistent', 10)
      assert.deepStrictEqual(reusable, [])
    })
  })

  describe('email deduplication', () => {
    it('should record email addresses', async () => {
      await propertyValueCache.recordEmail('john@example.com')
      const has = await propertyValueCache.hasEmail('john@example.com')
      assert.strictEqual(has, true)
    })

    it('should normalize emails to lowercase', async () => {
      await propertyValueCache.recordEmail('John@Example.COM')
      const has = await propertyValueCache.hasEmail('john@example.com')
      assert.strictEqual(has, true)
    })

    it('should trim whitespace from emails', async () => {
      await propertyValueCache.recordEmail('  john@example.com  ')
      const has = await propertyValueCache.hasEmail('john@example.com')
      assert.strictEqual(has, true)
    })

    it('should return false for unrecorded emails', async () => {
      const has = await propertyValueCache.hasEmail('unknown@example.com')
      assert.strictEqual(has, false)
    })

    it('should handle null/undefined emails', async () => {
      await propertyValueCache.recordEmail(null)
      await propertyValueCache.recordEmail(undefined)
      // Should not crash
      assert(true)
    })
  })

  describe('domain deduplication', () => {
    it('should record domain names', async () => {
      await propertyValueCache.recordDomain('example.com')
      const has = await propertyValueCache.hasDomain('example.com')
      assert.strictEqual(has, true)
    })

    it('should normalize domains to lowercase', async () => {
      await propertyValueCache.recordDomain('Example.COM')
      const has = await propertyValueCache.hasDomain('example.com')
      assert.strictEqual(has, true)
    })

    it('should trim whitespace from domains', async () => {
      await propertyValueCache.recordDomain('  example.com  ')
      const has = await propertyValueCache.hasDomain('example.com')
      assert.strictEqual(has, true)
    })

    it('should return false for unrecorded domains', async () => {
      const has = await propertyValueCache.hasDomain('unknown.com')
      assert.strictEqual(has, false)
    })

    it('should handle null/undefined domains', async () => {
      await propertyValueCache.recordDomain(null)
      await propertyValueCache.recordDomain(undefined)
      // Should not crash
      assert(true)
    })
  })

  describe('cache statistics', () => {
    it('should return cache statistics', async () => {
      await propertyValueCache.recordValue('sim1', 'companies', 'industry', 'Tech')
      await propertyValueCache.recordEmail('john@example.com')
      await propertyValueCache.recordDomain('example.com')
      
      const stats = await propertyValueCache.getStats()
      assert(stats.timestamp)
      assert(typeof stats.propertyValueIndices === 'number')
      assert(typeof stats.uniqueEmails === 'number')
      assert(typeof stats.uniqueDomains === 'number')
    })
  })

  describe('clearSimulation', () => {
    it('should clear all values for a simulation', async () => {
      await propertyValueCache.recordValue('sim123', 'companies', 'industry', 'Technology')
      await propertyValueCache.recordValue('sim123', 'contacts', 'lifecyclestage', 'Lead')
      
      await propertyValueCache.clearSimulation('sim123')
      
      const has1 = await propertyValueCache.hasValue('sim123', 'companies', 'industry', 'Technology')
      const has2 = await propertyValueCache.hasValue('sim123', 'contacts', 'lifecyclestage', 'Lead')
      
      assert.strictEqual(has1, false)
      assert.strictEqual(has2, false)
    })

    it('should not affect other simulations', async () => {
      await propertyValueCache.recordValue('sim123', 'companies', 'industry', 'Technology')
      await propertyValueCache.recordValue('sim456', 'companies', 'industry', 'Real Estate')
      
      await propertyValueCache.clearSimulation('sim123')
      
      const has = await propertyValueCache.hasValue('sim456', 'companies', 'industry', 'Real Estate')
      assert.strictEqual(has, true)
    })
  })

  describe('all 9 object types', () => {
    const objectTypes = [
      'contacts',
      'companies',
      'deals',
      'tickets',
      'engagements',
      'quotes',
      'invoices',
      'customObjects',
      'associations'
    ]

    objectTypes.forEach(objectType => {
      it(`should record and retrieve values for ${objectType}`, async () => {
        const value = `test_value_${objectType}`
        await propertyValueCache.recordValue('sim123', objectType, 'testField', value)
        
        const retrieved = await propertyValueCache.getValue('sim123', objectType, 'testField', value)
        assert.strictEqual(retrieved, value)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty string values', async () => {
      await propertyValueCache.recordValue('sim123', 'companies', 'field', '')
      const has = await propertyValueCache.hasValue('sim123', 'companies', 'field', '')
      assert.strictEqual(has, true)
    })

    it('should handle numeric values', async () => {
      await propertyValueCache.recordValue('sim123', 'deals', 'amount', 10000)
      const has = await propertyValueCache.hasValue('sim123', 'deals', 'amount', 10000)
      assert.strictEqual(has, true)
    })

    it('should handle boolean values', async () => {
      await propertyValueCache.recordValue('sim123', 'companies', 'is_public', true)
      const has = await propertyValueCache.hasValue('sim123', 'companies', 'is_public', true)
      assert.strictEqual(has, true)
    })

    it('should handle special characters in values', async () => {
      const special = 'Value!@#$%^&*()'
      await propertyValueCache.recordValue('sim123', 'companies', 'field', special)
      const retrieved = await propertyValueCache.getValue('sim123', 'companies', 'field', special)
      assert.strictEqual(retrieved, special)
    })
  })
})
