/**
 * Property Validator Tests
 * 
 * Test cases for propertyValidator module covering:
 * - Fuzzy matching for enum values
 * - Property deduplication
 * - Caching of metadata and values
 * - Email/domain uniqueness
 * - All 9 object types
 */

const assert = require('assert')

describe('propertyValidator', () => {
  let mockClient
  let mockRedis
  let mockCache
  let mockLogger
  let propertyValidator

  beforeEach(() => {
    // Mock Redis client
    mockRedis = {
      get: async (key) => null,
      setex: async () => {},
      exists: async () => 0,
      set: async () => {},
      sadd: async () => {},
      sismember: async () => 0,
      smembers: async () => [],
      del: async () => {},
      keys: async () => [],
      expire: async () => {}
    }

    // Mock HubSpot client
    mockClient = {
      get: async (path) => ({
        data: {
          fields: [
            {
              name: 'industry',
              fieldType: 'enumeration',
              modificationMetadata: {
                options: [
                  { label: 'Technology', value: 'technology' },
                  { label: 'Real Estate', value: 'real_estate' },
                  { label: 'Management Consulting', value: 'mgmt_consulting' }
                ]
              }
            },
            {
              name: 'firstname',
              fieldType: 'text',
              modificationMetadata: {}
            },
            {
              name: 'email',
              fieldType: 'text',
              modificationMetadata: {}
            }
          ]
        }
      })
    }

    // Mock property value cache
    mockCache = {
      getValue: async () => null,
      recordValue: async () => {},
      recordEmail: async () => {},
      recordDomain: async () => {},
      hasEmail: async () => false,
      hasDomain: async () => false
    }

    // Mock logger
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {}
    }

    // Import and create validator
    const createPropertyValidator = require('../server/propertyValidator')
    propertyValidator = createPropertyValidator(mockClient, mockRedis, mockCache, mockLogger)
  })

  describe('fuzzyMatch', () => {
    it('should return 100 for identical strings', () => {
      const score = propertyValidator.fuzzyMatch('Management Consulting', 'Management Consulting')
      assert.strictEqual(score, 100)
    })

    it('should return 100 for identical strings with different case', () => {
      const score = propertyValidator.fuzzyMatch('management consulting', 'MANAGEMENT CONSULTING')
      assert.strictEqual(score, 100)
    })

    it('should detect near-matches with high score', () => {
      const score = propertyValidator.fuzzyMatch('Management Consulting', 'Management Consultin')
      assert(score >= 80, `Expected score >= 80, got ${score}`)
    })

    it('should handle trailing/leading spaces', () => {
      const score = propertyValidator.fuzzyMatch('  Management Consulting  ', 'Management Consulting')
      assert.strictEqual(score, 100)
    })

    it('should return low score for different strings', () => {
      const score = propertyValidator.fuzzyMatch('Technology', 'Real Estate')
      assert(score < 50, `Expected score < 50, got ${score}`)
    })

    it('should return 0 for empty strings', () => {
      const score = propertyValidator.fuzzyMatch('', '')
      assert.strictEqual(score, 100) // Empty === empty
    })

    it('should return 0 for null/undefined', () => {
      const score1 = propertyValidator.fuzzyMatch(null, 'test')
      const score2 = propertyValidator.fuzzyMatch('test', undefined)
      assert.strictEqual(score1, 0)
      assert.strictEqual(score2, 0)
    })
  })

  describe('findBestEnumMatch', () => {
    it('should find exact match', () => {
      const options = ['Technology', 'Real Estate', 'Management Consulting']
      const match = propertyValidator.findBestEnumMatch('Management Consulting', options)
      assert(match)
      assert.strictEqual(match.value, 'Management Consulting')
      assert.strictEqual(match.type, 'exact')
      assert.strictEqual(match.score, 100)
    })

    it('should find fuzzy match above threshold', () => {
      const options = ['Technology', 'Real Estate', 'Management Consultin']
      const match = propertyValidator.findBestEnumMatch('Management Consulting', options)
      assert(match, 'Should find fuzzy match')
      assert.strictEqual(match.type, 'fuzzy')
      assert(match.score >= 85)
    })

    it('should return null if no match above threshold', () => {
      const options = ['Technology', 'Real Estate']
      const match = propertyValidator.findBestEnumMatch('Management Consulting', options)
      assert.strictEqual(match, null)
    })

    it('should return null for empty options array', () => {
      const match = propertyValidator.findBestEnumMatch('Management Consulting', [])
      assert.strictEqual(match, null)
    })

    it('should handle case-insensitive matching', () => {
      const options = ['TECHNOLOGY', 'REAL ESTATE', 'MANAGEMENT CONSULTING']
      const match = propertyValidator.findBestEnumMatch('management consulting', options)
      assert(match)
      assert.strictEqual(match.type, 'exact')
    })
  })

  describe('normalizePropertyValue', () => {
    it('should pass through non-enum fields', async () => {
      const result = await propertyValidator.normalizePropertyValue('contacts', 'firstname', 'John', {
        fields: [
          { name: 'firstname', fieldType: 'text', modificationMetadata: {} }
        ]
      })
      assert.strictEqual(result.normalized, false)
      assert.strictEqual(result.reason, 'not_enum')
      assert.strictEqual(result.value, 'John')
    })

    it('should return exact match for enum fields', async () => {
      const result = await propertyValidator.normalizePropertyValue('companies', 'industry', 'Technology', {
        fields: [
          {
            name: 'industry',
            fieldType: 'enumeration',
            modificationMetadata: {
              options: [
                { label: 'Technology', value: 'tech' },
                { label: 'Real Estate', value: 'estate' }
              ]
            }
          }
        ]
      })
      assert.strictEqual(result.normalized, true)
      assert.strictEqual(result.reason, 'exact_match')
      assert.strictEqual(result.value, 'Technology')
      assert.strictEqual(result.score, 100)
    })

    it('should return fuzzy match for similar enum values', async () => {
      const result = await propertyValidator.normalizePropertyValue('companies', 'industry', 'Tech', {
        fields: [
          {
            name: 'industry',
            fieldType: 'enumeration',
            modificationMetadata: {
              options: [
                { label: 'Technology', value: 'tech' },
                { label: 'Real Estate', value: 'estate' }
              ]
            }
          }
        ]
      })
      assert.strictEqual(result.normalized, true)
      assert.strictEqual(result.reason, 'fuzzy_match')
      assert(result.score > 85)
    })

    it('should return no_match_found for unmatchable enums', async () => {
      const result = await propertyValidator.normalizePropertyValue('companies', 'industry', 'Manufacturing', {
        fields: [
          {
            name: 'industry',
            fieldType: 'enumeration',
            modificationMetadata: {
              options: [
                { label: 'Technology', value: 'tech' },
                { label: 'Real Estate', value: 'estate' }
              ]
            }
          }
        ]
      })
      assert.strictEqual(result.normalized, false)
      assert.strictEqual(result.reason, 'no_match_found')
    })

    it('should handle missing field definitions', async () => {
      const result = await propertyValidator.normalizePropertyValue('companies', 'nonexistent', 'value', {
        fields: []
      })
      assert.strictEqual(result.normalized, false)
      assert.strictEqual(result.reason, 'field_not_found')
    })

    it('should handle null/undefined values', async () => {
      const result = await propertyValidator.normalizePropertyValue('companies', 'industry', null, {
        fields: []
      })
      assert.strictEqual(result.normalized, false)
      assert.strictEqual(result.reason, 'null_or_undefined')
      assert.strictEqual(result.value, null)
    })
  })

  describe('email and domain uniqueness', () => {
    it('should record email addresses', async () => {
      let recordedEmail = null
      mockRedis.setex = async (key, ttl, val) => {
        if (key.includes('global:emails')) recordedEmail = val
      }
      
      await propertyValidator.recordEmail('john@example.com')
      assert(recordedEmail)
    })

    it('should record domain names', async () => {
      let recordedDomain = null
      mockRedis.setex = async (key, ttl, val) => {
        if (key.includes('global:domains')) recordedDomain = val
      }
      
      await propertyValidator.recordDomain('example.com')
      assert(recordedDomain)
    })

    it('should check for duplicate emails', async () => {
      mockRedis.exists = async (key) => {
        if (key.includes('john@example.com')) return 1
        return 0
      }
      
      const isDuplicate = await propertyValidator.checkEmailDuplicate('john@example.com')
      assert.strictEqual(isDuplicate, true)
    })

    it('should check for duplicate domains', async () => {
      mockRedis.exists = async (key) => {
        if (key.includes('example.com')) return 1
        return 0
      }
      
      const isDuplicate = await propertyValidator.checkDomainDuplicate('example.com')
      assert.strictEqual(isDuplicate, true)
    })
  })

  describe('metadata caching', () => {
    it('should cache field metadata in Redis', async () => {
      let cacheKey = null
      let cacheValue = null
      
      mockRedis.setex = async (key, ttl, val) => {
        cacheKey = key
        cacheValue = val
      }
      
      await propertyValidator.getFieldMetadata('contacts')
      
      assert(cacheKey.includes('meta:contacts:fields'))
      assert(cacheValue)
    })

    it('should retrieve cached metadata', async () => {
      const cachedData = JSON.stringify({ fields: [] })
      mockRedis.get = async (key) => {
        if (key.includes('meta:companies:fields')) return cachedData
        return null
      }
      
      const metadata = await propertyValidator.getFieldMetadata('companies')
      assert.deepStrictEqual(metadata, { fields: [] })
    })
  })

  describe('normalizeProperties for all 9 object types', () => {
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
      it(`should normalize properties for ${objectType}`, async () => {
        const props = { testField: 'testValue' }
        const result = await propertyValidator.normalizeProperties(objectType, props)
        
        assert(result.hasOwnProperty('properties'))
        assert(Array.isArray(result.normalizations))
        assert(result.properties.testField !== undefined)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty properties object', async () => {
      const result = await propertyValidator.normalizeProperties('contacts', {})
      assert.deepStrictEqual(result.properties, {})
      assert.strictEqual(result.normalizations.length, 0)
    })

    it('should handle null properties', async () => {
      const result = await propertyValidator.normalizeProperties('contacts', null)
      assert.deepStrictEqual(result.properties, null)
    })

    it('should handle undefined properties', async () => {
      const result = await propertyValidator.normalizeProperties('contacts', undefined)
      assert.deepStrictEqual(result.properties, {})
    })

    it('should handle non-object properties', async () => {
      const result = await propertyValidator.normalizeProperties('contacts', 'string')
      assert.strictEqual(result.properties, 'string')
    })

    it('should trim whitespace from enum values', () => {
      const options = ['Technology', 'Real Estate']
      const match = propertyValidator.findBestEnumMatch('  Technology  ', options)
      assert(match)
      assert.strictEqual(match.type, 'exact')
    })
  })
})
