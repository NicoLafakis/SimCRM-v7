/**
 * Property Validator
 * 
 * Validates and normalizes properties before creating/updating CRM records.
 * Ensures enum values exist (or creates them), prevents duplicates, and handles fuzzy matching.
 * 
 * Features:
 * - Caches HubSpot field metadata (1 hour TTL)
 * - Detects and prevents duplicate enum values (fuzzy matching)
 * - Reuses AI-generated values from property value cache
 * - Handles special cases: email, domain (uniqueness checks)
 * - Structured logging of all normalization decisions
 */

const levenshtein = require('fastest-levenshtein')
const { buildPath } = require('./tools/hubspot/apiRegistry')

/**
 * Levenshtein distance-based fuzzy matching
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} similarity score 0-100 (100 = identical)
 */
function fuzzyMatch(str1, str2) {
  if (!str1 || !str2) return 0
  const s1 = String(str1).trim().toLowerCase()
  const s2 = String(str2).trim().toLowerCase()
  if (s1 === s2) return 100
  
  const maxLen = Math.max(s1.length, s2.length)
  if (maxLen === 0) return 100
  
  const distance = levenshtein.distance(s1, s2)
  const similarity = 100 - (distance / maxLen * 100)
  return Math.round(similarity)
}

/**
 * Create property validator instance
 * 
 * @param {Object} client - HubSpot client (with get, post methods)
 * @param {Object} redis - Redis client instance
 * @param {Object} propertyValueCache - PropertyValueCache instance
 * @param {Object} logger - Logger instance (with info, warn, error methods)
 * @returns {Object} validator with methods
 */
module.exports = function createPropertyValidator(client, redis, propertyValueCache, logger) {
  
  // Metadata cache: meta:<objectType>:fields
  const METADATA_CACHE_TTL = 3600 // 1 hour
  const FUZZY_MATCH_THRESHOLD = 85 // Accept >85% matches
  
  /**
   * Get or fetch field metadata for an object type
   * Caches in Redis to avoid repeated API calls
   */
  async function getFieldMetadata(objectType) {
    const cacheKey = `meta:${objectType}:fields`
    
    try {
      // Try Redis cache first
      const cached = await redis.get(cacheKey)
      if (cached) {
        logger.info('propertyValidator', { msg: 'field_metadata_cache_hit', objectType })
        return JSON.parse(cached)
      }
    } catch (err) {
      logger.warn('propertyValidator', { msg: 'field_metadata_cache_read_error', objectType, error: err.message })
    }
    
    try {
      // Fetch from HubSpot API using buildPath
      const path = buildPath('crm.objects.model.get', objectType)
      const res = await client.get(path)
      const metadata = res.data || {}
      
      // Cache for 1 hour
      try {
        await redis.setex(cacheKey, METADATA_CACHE_TTL, JSON.stringify(metadata))
      } catch (err) {
        logger.warn('propertyValidator', { msg: 'field_metadata_cache_write_error', objectType, error: err.message })
      }
      
      logger.info('propertyValidator', { msg: 'field_metadata_fetched', objectType })
      return metadata
    } catch (err) {
      logger.error('propertyValidator', { 
        msg: 'field_metadata_fetch_failed',
        objectType,
        error: err.message,
        status: err.status
      })
      return {}
    }
  }

  /**
   * Get field definition from metadata
   */
  function getFieldDefinition(metadata, fieldName) {
    if (!metadata.fields) return null
    return metadata.fields.find(f => f.name === fieldName)
  }

  /**
   * Get enum options for a field
   */
  function getEnumOptions(fieldDef) {
    if (!fieldDef || !fieldDef.modificationMetadata) return []
    const meta = fieldDef.modificationMetadata
    if (!meta.options) return []
    return meta.options.map(opt => opt.label || opt.value)
  }

  /**
   * Find best matching enum value from CRM
   * Returns exact match or fuzzy match if >FUZZY_MATCH_THRESHOLD%
   */
  function findBestEnumMatch(suggestedValue, existingOptions = []) {
    if (!suggestedValue || !existingOptions.length) return null
    
    const suggested = String(suggestedValue).trim()
    let bestMatch = null
    let bestScore = 0
    
    for (const option of existingOptions) {
      const optionStr = String(option).trim()
      
      // Exact match: immediate return
      if (optionStr.toLowerCase() === suggested.toLowerCase()) {
        return { value: optionStr, score: 100, type: 'exact' }
      }
      
      // Fuzzy match: find best candidate
      const score = fuzzyMatch(suggested, optionStr)
      if (score > bestScore) {
        bestScore = score
        bestMatch = { value: optionStr, score, type: 'fuzzy' }
      }
    }
    
    // Return only if meets threshold
    if (bestMatch && bestScore >= FUZZY_MATCH_THRESHOLD) {
      return bestMatch
    }
    
    return null
  }

  /**
   * Normalize a single property value
   * - Returns { value, normalized: boolean, reason: string, score?: number }
   */
  async function normalizePropertyValue(objectType, fieldName, suggestedValue, metadata) {
    // Non-string/number values: pass through
    if (suggestedValue === null || suggestedValue === undefined) {
      return { value: suggestedValue, normalized: false, reason: 'null_or_undefined' }
    }

    const fieldDef = getFieldDefinition(metadata, fieldName)
    if (!fieldDef) {
      logger.warn('propertyValidator', {
        msg: 'field_not_found',
        objectType,
        fieldName,
        suggestedValue
      })
      return { value: suggestedValue, normalized: false, reason: 'field_not_found' }
    }

    // Non-enum fields: pass through
    if (fieldDef.fieldType !== 'enumeration' && fieldDef.fieldType !== 'select') {
      return { value: suggestedValue, normalized: false, reason: 'not_enum' }
    }

    // Enum/select field: find or match
    const existingOptions = getEnumOptions(fieldDef)
    const bestMatch = findBestEnumMatch(suggestedValue, existingOptions)

    if (bestMatch) {
      const matchType = bestMatch.type === 'exact' ? 'exact_match' : 'fuzzy_match'
      logger.info('propertyValidator', {
        msg: 'enum_value_matched',
        objectType,
        fieldName,
        suggestedValue,
        matchedValue: bestMatch.value,
        matchType,
        score: bestMatch.score
      })
      return {
        value: bestMatch.value,
        normalized: true,
        reason: matchType,
        score: bestMatch.score
      }
    }

    // No match found: value might be new or invalid
    logger.info('propertyValidator', {
      msg: 'enum_value_no_match_found',
      objectType,
      fieldName,
      suggestedValue,
      existingOptionsCount: existingOptions.length
    })

    return { value: suggestedValue, normalized: false, reason: 'no_match_found', existingOptions }
  }

  /**
   * Normalize all properties for an object type
   * Returns { properties: {...}, normalizations: [...] }
   */
  async function normalizeProperties(objectType, incomingProps, simId) {
    if (!incomingProps || typeof incomingProps !== 'object') {
      return { properties: incomingProps || {}, normalizations: [] }
    }

    const metadata = await getFieldMetadata(objectType)
    const normalizations = []
    const normalized = {}

    for (const [fieldName, fieldValue] of Object.entries(incomingProps)) {
      try {
        // Check property value cache first
        let cachedValue = null
        if (simId && propertyValueCache) {
          cachedValue = await propertyValueCache.getValue(simId, objectType, fieldName, fieldValue)
        }

        if (cachedValue) {
          logger.info('propertyValidator', {
            msg: 'property_value_cache_hit',
            objectType,
            fieldName,
            suggestedValue: fieldValue,
            cachedValue
          })
          normalized[fieldName] = cachedValue
          normalizations.push({
            fieldName,
            original: fieldValue,
            normalized: cachedValue,
            reason: 'cache_hit'
          })
          continue
        }

        // Normalize against HubSpot metadata
        const result = await normalizePropertyValue(objectType, fieldName, fieldValue, metadata)
        normalized[fieldName] = result.value
        
        normalizations.push({
          fieldName,
          original: fieldValue,
          normalized: result.value,
          reason: result.reason,
          score: result.score,
          matchType: result.reason === 'fuzzy_match' ? 'fuzzy' : 'exact'
        })

        // Store in cache for reuse
        if (result.normalized && simId && propertyValueCache) {
          try {
            await propertyValueCache.recordValue(simId, objectType, fieldName, result.value)
          } catch (err) {
            logger.warn('propertyValidator', {
              msg: 'property_value_cache_record_failed',
              objectType,
              fieldName,
              value: result.value,
              error: err.message
            })
          }
        }

      } catch (err) {
        logger.error('propertyValidator', {
          msg: 'property_normalization_error',
          objectType,
          fieldName,
          value: fieldValue,
          error: err.message
        })
        normalized[fieldName] = fieldValue
      }
    }

    return { properties: normalized, normalizations }
  }

  /**
   * Check for duplicate email addresses across all simulations
   */
  async function checkEmailDuplicate(email) {
    if (!email || typeof email !== 'string') return false
    
    try {
      const normalized = email.trim().toLowerCase()
      const key = `global:emails:${normalized}`
      const exists = await redis.exists(key)
      return exists === 1
    } catch (err) {
      logger.warn('propertyValidator', {
        msg: 'email_duplicate_check_failed',
        email,
        error: err.message
      })
      return false
    }
  }

  /**
   * Check for duplicate domain names across all simulations
   */
  async function checkDomainDuplicate(domain) {
    if (!domain || typeof domain !== 'string') return false
    
    try {
      const normalized = domain.trim().toLowerCase()
      const key = `global:domains:${normalized}`
      const exists = await redis.exists(key)
      return exists === 1
    } catch (err) {
      logger.warn('propertyValidator', {
        msg: 'domain_duplicate_check_failed',
        domain,
        error: err.message
      })
      return false
    }
  }

  /**
   * Record email address globally
   */
  async function recordEmail(email) {
    if (!email || typeof email !== 'string') return
    
    try {
      const normalized = email.trim().toLowerCase()
      const key = `global:emails:${normalized}`
      await redis.setex(key, 86400 * 365, '1') // 1 year TTL
    } catch (err) {
      logger.warn('propertyValidator', {
        msg: 'email_record_failed',
        email,
        error: err.message
      })
    }
  }

  /**
   * Record domain name globally
   */
  async function recordDomain(domain) {
    if (!domain || typeof domain !== 'string') return
    
    try {
      const normalized = domain.trim().toLowerCase()
      const key = `global:domains:${normalized}`
      await redis.setex(key, 86400 * 365, '1') // 1 year TTL
    } catch (err) {
      logger.warn('propertyValidator', {
        msg: 'domain_record_failed',
        domain,
        error: err.message
      })
    }
  }

  // Public API
  return {
    getFieldMetadata,
    getFieldDefinition,
    getEnumOptions,
    findBestEnumMatch,
    normalizePropertyValue,
    normalizeProperties,
    checkEmailDuplicate,
    checkDomainDuplicate,
    recordEmail,
    recordDomain,
    fuzzyMatch // Export for testing
  }
}
