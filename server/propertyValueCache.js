/**
 * Property Value Cache
 * 
 * Stores and manages AI-generated property values in Redis.
 * Prevents duplicate value creation and enables cross-simulation reuse.
 * 
 * Features:
 * - Per-simulation cache: sim:<simId>:prop-cache:<objectType>:<fieldName>
 * - Global value index for cross-simulation reuse
 * - Email/domain deduplication across all simulations
 * - TTL management (simulation TTL + long-term persistence for reuse)
 */

/**
 * Create property value cache instance
 * 
 * @param {Object} redis - Redis client instance
 * @param {Object} logger - Logger instance (with info, warn, error methods)
 * @returns {Object} cache with methods
 */
module.exports = function createPropertyValueCache(redis, logger) {
  
  const SIM_CACHE_TTL = 86400 // 24 hours (simulation completion time)
  const REUSE_CACHE_TTL = 86400 * 30 // 30 days (for cross-sim reuse)

  /**
   * Record a property value that was created/used in this simulation
   * Stores in both per-simulation cache and global index
   */
  async function recordValue(simId, objectType, fieldName, value) {
    if (!simId || !objectType || !fieldName || value === null || value === undefined) {
      return
    }

    try {
      const valueStr = String(value).trim()
      
      // Per-simulation cache: sim:<simId>:prop-cache:<objectType>:<fieldName>:<valueHash>
      const simCacheKey = `sim:${simId}:prop-cache:${objectType}:${fieldName}`
      const simCacheSet = `${simCacheKey}:values`
      
      // Add to simulation-specific set
      await redis.sadd(simCacheSet, valueStr)
      await redis.expire(simCacheSet, SIM_CACHE_TTL)

      // Global reuse index: prop-index:<objectType>:<fieldName>
      const globalIndexKey = `prop-index:${objectType}:${fieldName}`
      const globalIndexSet = `${globalIndexKey}:values`
      
      // Add to global reuse index
      await redis.sadd(globalIndexSet, valueStr)
      await redis.expire(globalIndexSet, REUSE_CACHE_TTL)

      // Also store creation timestamp for sorting
      const timestampKey = `${globalIndexKey}:ts:${valueStr}`
      const now = Date.now()
      await redis.set(timestampKey, now, 'EX', REUSE_CACHE_TTL)

      logger.info('propertyValueCache', {
        msg: 'value_recorded',
        simId,
        objectType,
        fieldName,
        value: valueStr
      })

    } catch (err) {
      logger.error('propertyValueCache', {
        msg: 'value_record_failed',
        simId,
        objectType,
        fieldName,
        value,
        error: err.message
      })
    }
  }

  /**
   * Check if a value was recorded in this simulation
   */
  async function hasValue(simId, objectType, fieldName, value) {
    if (!simId || !objectType || !fieldName || value === null || value === undefined) {
      return false
    }

    try {
      const valueStr = String(value).trim()
      const simCacheSet = `sim:${simId}:prop-cache:${objectType}:${fieldName}:values`
      const isMember = await redis.sismember(simCacheSet, valueStr)
      return isMember === 1
    } catch (err) {
      logger.warn('propertyValueCache', {
        msg: 'value_check_failed',
        simId,
        objectType,
        fieldName,
        error: err.message
      })
      return false
    }
  }

  /**
   * Get a cached value if it exists
   * First checks simulation-specific cache, then global reuse index
   */
  async function getValue(simId, objectType, fieldName, suggestedValue) {
    if (!suggestedValue) return null

    try {
      const valueStr = String(suggestedValue).trim()

      // Check simulation cache first
      if (simId) {
        const simCacheSet = `sim:${simId}:prop-cache:${objectType}:${fieldName}:values`
        const isMember = await redis.sismember(simCacheSet, valueStr)
        if (isMember === 1) {
          logger.info('propertyValueCache', {
            msg: 'cache_hit_simulation',
            simId,
            objectType,
            fieldName,
            value: valueStr
          })
          return valueStr
        }
      }

      // Check global reuse index
      const globalIndexSet = `prop-index:${objectType}:${fieldName}:values`
      const isMember = await redis.sismember(globalIndexSet, valueStr)
      if (isMember === 1) {
        logger.info('propertyValueCache', {
          msg: 'cache_hit_global_reuse',
          simId,
          objectType,
          fieldName,
          value: valueStr
        })
        return valueStr
      }

      return null
    } catch (err) {
      logger.warn('propertyValueCache', {
        msg: 'value_get_failed',
        simId,
        objectType,
        fieldName,
        error: err.message
      })
      return null
    }
  }

  /**
   * Get all values recorded for a field (for reuse in new simulations)
   * Returns sorted by creation timestamp (newest first)
   */
  async function getReusableValues(objectType, fieldName, limit = 10) {
    if (!objectType || !fieldName) return []

    try {
      const globalIndexSet = `prop-index:${objectType}:${fieldName}:values`
      const values = await redis.smembers(globalIndexSet)

      if (!values || values.length === 0) {
        return []
      }

      // Sort by timestamp (newest first)
      const withTimestamps = await Promise.all(
        values.map(async (value) => {
          try {
            const timestampKey = `prop-index:${objectType}:${fieldName}:ts:${value}`
            const ts = await redis.get(timestampKey)
            return { value, timestamp: ts ? parseInt(ts, 10) : 0 }
          } catch (err) {
            return { value, timestamp: 0 }
          }
        })
      )

      const sorted = withTimestamps
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit)
        .map(item => item.value)

      logger.info('propertyValueCache', {
        msg: 'reusable_values_retrieved',
        objectType,
        fieldName,
        count: sorted.length
      })

      return sorted
    } catch (err) {
      logger.error('propertyValueCache', {
        msg: 'reusable_values_failed',
        objectType,
        fieldName,
        error: err.message
      })
      return []
    }
  }

  /**
   * Register an email address globally (prevents duplicates)
   */
  async function recordEmail(email) {
    if (!email || typeof email !== 'string') return

    try {
      const normalized = email.trim().toLowerCase()
      const key = `global:emails:${normalized}`
      await redis.setex(key, REUSE_CACHE_TTL, Date.now())

      logger.info('propertyValueCache', {
        msg: 'email_recorded',
        email: normalized
      })
    } catch (err) {
      logger.warn('propertyValueCache', {
        msg: 'email_record_failed',
        email,
        error: err.message
      })
    }
  }

  /**
   * Check if email is already in use
   */
  async function hasEmail(email) {
    if (!email || typeof email !== 'string') return false

    try {
      const normalized = email.trim().toLowerCase()
      const key = `global:emails:${normalized}`
      const exists = await redis.exists(key)
      return exists === 1
    } catch (err) {
      logger.warn('propertyValueCache', {
        msg: 'email_check_failed',
        email,
        error: err.message
      })
      return false
    }
  }

  /**
   * Register a domain globally (prevents duplicates)
   */
  async function recordDomain(domain) {
    if (!domain || typeof domain !== 'string') return

    try {
      const normalized = domain.trim().toLowerCase()
      const key = `global:domains:${normalized}`
      await redis.setex(key, REUSE_CACHE_TTL, Date.now())

      logger.info('propertyValueCache', {
        msg: 'domain_recorded',
        domain: normalized
      })
    } catch (err) {
      logger.warn('propertyValueCache', {
        msg: 'domain_record_failed',
        domain,
        error: err.message
      })
    }
  }

  /**
   * Check if domain is already in use
   */
  async function hasDomain(domain) {
    if (!domain || typeof domain !== 'string') return false

    try {
      const normalized = domain.trim().toLowerCase()
      const key = `global:domains:${normalized}`
      const exists = await redis.exists(key)
      return exists === 1
    } catch (err) {
      logger.warn('propertyValueCache', {
        msg: 'domain_check_failed',
        domain,
        error: err.message
      })
      return false
    }
  }

  /**
   * Clear all cached values for a simulation (cleanup)
   */
  async function clearSimulation(simId) {
    if (!simId) return

    try {
      // Pattern: sim:<simId>:prop-cache:*
      const pattern = `sim:${simId}:prop-cache:*`
      const keys = await redis.keys(pattern)

      if (keys.length > 0) {
        await redis.del(...keys)
      }

      logger.info('propertyValueCache', {
        msg: 'simulation_cleared',
        simId,
        keysDeleted: keys.length
      })
    } catch (err) {
      logger.error('propertyValueCache', {
        msg: 'simulation_clear_failed',
        simId,
        error: err.message
      })
    }
  }

  /**
   * Get cache statistics
   */
  async function getStats() {
    try {
      const propIndexKeys = await redis.keys('prop-index:*:values')
      const emailKeys = await redis.keys('global:emails:*')
      const domainKeys = await redis.keys('global:domains:*')

      return {
        propertyValueIndices: propIndexKeys.length,
        uniqueEmails: emailKeys.length,
        uniqueDomains: domainKeys.length,
        timestamp: new Date().toISOString()
      }
    } catch (err) {
      logger.error('propertyValueCache', {
        msg: 'stats_failed',
        error: err.message
      })
      return {}
    }
  }

  // Public API
  return {
    recordValue,
    hasValue,
    getValue,
    getReusableValues,
    recordEmail,
    hasEmail,
    recordDomain,
    hasDomain,
    clearSimulation,
    getStats
  }
}
