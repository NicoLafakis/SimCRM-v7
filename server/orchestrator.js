const { createClient } = require('./hubspotClient')
const { createTools } = require('./toolsFactory')
const createPropertyValidator = require('./propertyValidator')
const createPropertyValueCache = require('./propertyValueCache')
const { Queue } = require('bullmq')
const { buildBullOptions } = require('./jobRetryConfig')
const { expandDistribution } = require('./distributionUtil')
const { getScenarioParameters } = require('./scenarioParameters')
const { getMergedScenario, getOverrideVersionInfo } = require('./configSurface')
const { getLogger } = require('./logging')
const Redis = require('redis')
const knexConfig = require('../knexfile')
const Knex = require('knex')

// Lazily create Redis connection options (BullMQ will manage its own ioredis internally if given connection params)
function deriveShard(simId) {
  return 0 // placeholder for future hash-based shard assignment
}

function queueNameFor(simId) {
  const shard = deriveShard(simId)
  // Match worker queue naming: use '-' as shard separator to avoid ':' which BullMQ disallows
  return `simulation-jobs-${shard}`
}

function getQueue(connectionOpts = null, simId = null) {
  if (!connectionOpts) {
    let envConn
    if (process.env.REDIS_URL) {
      try {
        const u = new URL(process.env.REDIS_URL)
        envConn = {
          host: u.hostname,
          port: u.port ? parseInt(u.port, 10) : undefined,
          password: u.password || undefined,
          username: u.username || undefined,
          tls: u.protocol === 'rediss:' ? {} : undefined,
          db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB,10) : undefined,
        }
      } catch (e) {
        console.warn('Invalid REDIS_URL, falling back to discrete vars:', e.message)
      }
    }
    if (!envConn) {
      envConn = {
        host: process.env.REDIS_HOST || undefined,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB,10) : undefined,
      }
    }
    Object.keys(envConn).forEach(k => envConn[k] === undefined && delete envConn[k])
    connectionOpts = envConn
  }
  return new Queue(simId ? queueNameFor(simId) : 'simulation-jobs-0', { connection: connectionOpts })
}

const knex = Knex(knexConfig.development || knexConfig)
// Feature flag: only perform real HubSpot writes when SIM_REAL_MODE=1
const REAL_MODE = process.env.SIM_REAL_MODE === '1'
const logger = getLogger()

function createOrchestrator({ apiToken, redisClient = null } = {}) {
  const client = createClient({ apiToken })
  if (apiToken) client.setToken(apiToken)
  const tools = createTools(client)
  
  // Initialize property validator and cache
  let redis = redisClient
  let propertyValidator = null
  let propertyValueCache = null
  
  if (!redis) {
    // Create Redis connection for validator/cache if not provided
    redis = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
    })
  }
  
  if (REAL_MODE && redis) {
    propertyValueCache = createPropertyValueCache(redis, logger)
    propertyValidator = createPropertyValidator(client, redis, propertyValueCache, logger)
  }

  return {
    // Dynamically create a tools instance for a given token (per-user private app token)
    withToken(token) {
      const userClient = createClient({})
      userClient.setToken(token)
      return createTools(userClient)
    },

    // High-level: create contact + company and associate
    createContactWithCompany: async ({ contactProps, companyProps, simId = null }) => {
      if (!REAL_MODE) {
        // Simulated objects (no external write). Keep shape similar to HubSpot objects used elsewhere.
        const now = Date.now()
        const company = { id: `sim_company_${now}_${Math.random().toString(36).slice(2,8)}`, properties: { ...companyProps }, simulated: true }
        const contact = { id: `sim_contact_${now}_${Math.random().toString(36).slice(2,8)}`, properties: { ...contactProps }, simulated: true }
        return { contact, company, simulated: true }
      }
      
      // Normalize properties through validator
      let normalizedCompanyProps = companyProps
      let normalizedContactProps = contactProps
      
      if (propertyValidator && simId) {
        const companyResult = await propertyValidator.normalizeProperties('companies', companyProps, simId)
        const contactResult = await propertyValidator.normalizeProperties('contacts', contactProps, simId)
        normalizedCompanyProps = companyResult.properties
        normalizedContactProps = contactResult.properties
        
        // Record email and domain if present
        if (normalizedContactProps.email) {
          await propertyValueCache.recordEmail(normalizedContactProps.email)
        }
        if (normalizedCompanyProps.domain) {
          await propertyValueCache.recordDomain(normalizedCompanyProps.domain)
        }
      }
      
      const company = await tools.companies.create(normalizedCompanyProps)
      const contact = await tools.contacts.create({ ...normalizedContactProps })
      try {
        await tools.associations.associateContactToCompany(contact.id, company.id, true) // primary association
      } catch (err) {
        console.warn('Association failed (real mode):', err.message)
      }
      return { contact, company, simulated: false }
    },

    createDealForContact: async ({ contactId, companyId, dealProps, simId = null }) => {
      if (!REAL_MODE) {
        return { id: `sim_deal_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, properties: { ...dealProps }, simulated: true }
      }
      
      // Normalize properties through validator
      let normalizedDealProps = dealProps
      if (propertyValidator && simId) {
        const result = await propertyValidator.normalizeProperties('deals', dealProps, simId)
        normalizedDealProps = result.properties
      }
      
      const deal = await tools.deals.create(normalizedDealProps, [])
      try {
        const associationResults = await tools.associations.associateDealToContactAndCompany(deal.id, contactId, companyId)
        associationResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            const type = index === 0 ? 'contact' : 'company'
            console.warn(`Deal to ${type} association failed (real mode):`, result.reason?.message)
          }
        })
      } catch (err) {
        console.warn('Deal association failed (real mode):', err.message)
      }
      return { ...deal, simulated: false }
    },

    // New method: Create a note and associate it with related objects
    createNoteWithAssociations: async ({ noteProps, contactId, companyId, dealId, ticketId, simId = null }) => {
      if (!REAL_MODE) {
        return { id: `sim_note_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, properties: { body: noteProps.body }, simulated: true }
      }
      
      // Normalize properties through validator
      let normalizedNoteProps = { body: noteProps.body || noteProps.hs_note_body }
      if (propertyValidator && simId) {
        const result = await propertyValidator.normalizeProperties('engagements', normalizedNoteProps, simId)
        normalizedNoteProps = result.properties
      }
      
      const note = await tools.engagements.create({
        engagement: { type: 'NOTE' },
        metadata: normalizedNoteProps
      })
      if (contactId || companyId || dealId || ticketId) {
        try { await tools.associations.associateNote(note.id, { contactId, companyId, dealId, ticketId }) } catch (err) { console.warn('Note association failed (real mode):', err.message) }
      }
      return { ...note, simulated: false }
    },

    // New method: Create a call and associate it with a contact
    createCallForContact: async ({ callProps, contactId, simId = null }) => {
      if (!REAL_MODE) {
        return { id: `sim_call_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, properties: { body: callProps.body }, simulated: true }
      }
      
      // Normalize properties through validator
      let normalizedCallProps = { body: callProps.body, status: callProps.status || 'COMPLETED', duration: callProps.duration }
      if (propertyValidator && simId) {
        const result = await propertyValidator.normalizeProperties('engagements', normalizedCallProps, simId)
        normalizedCallProps = result.properties
      }
      
      const call = await tools.engagements.create({
        engagement: { type: 'CALL' },
        metadata: normalizedCallProps
      })
      if (contactId) {
        try { await tools.associations.associateCallToContact(call.id, contactId) } catch (err) { console.warn('Call association failed (real mode):', err.message) }
      }
      return { ...call, simulated: false }
    },

    // New method: Create a task and associate it with a contact (for ownership)
    createTaskForContact: async ({ taskProps, contactId, simId = null }) => {
      if (!REAL_MODE) {
        return { id: `sim_task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, properties: { body: taskProps.body, subject: taskProps.subject }, simulated: true }
      }
      
      // Normalize properties through validator
      let normalizedTaskProps = { body: taskProps.body, subject: taskProps.subject, status: taskProps.status || 'NOT_STARTED' }
      if (propertyValidator && simId) {
        const result = await propertyValidator.normalizeProperties('engagements', normalizedTaskProps, simId)
        normalizedTaskProps = result.properties
      }
      
      const task = await tools.engagements.create({
        engagement: { type: 'TASK' },
        metadata: normalizedTaskProps
      })
      if (contactId) {
        try { await tools.associations.associateTaskToContact(task.id, contactId) } catch (err) { console.warn('Task association failed (real mode):', err.message) }
      }
      return { ...task, simulated: false }
    },

    // pass-through for tools
    tools,

    /**
     * startSimulation(simulationId)
     * Reads simulation record, expands distribution into per-record timestamps, enqueues delayed jobs.
     */
    startSimulation: async (simulationId) => {
      // Load simulation row
      const sim = await knex('simulations').where({ id: simulationId }).first()
      if (!sim) throw new Error('Simulation not found')
      if (sim.status === 'RUNNING') {
        return { scheduled: 0, alreadyRunning: true }
      }
      if (sim.status !== 'QUEUED') throw new Error('Simulation not in QUEUED state')

      // Parse HubSpot configuration from database
      let hubspotConfig = null
      if (sim.hubspot_pipeline_id || sim.hubspot_owner_ids) {
        hubspotConfig = {
          pipelineId: sim.hubspot_pipeline_id || null,
          ownerIds: sim.hubspot_owner_ids ? JSON.parse(sim.hubspot_owner_ids) : []
        }
      }

  // Use merged scenario parameters (base + runtime overrides if any)
  const scenarioParams = getMergedScenario(sim.scenario) || getScenarioParameters(sim.scenario)
      // Adjust total count via scenario multiplier (rounded)
      let effectiveTotal = sim.total_records
      if (scenarioParams?.leadVolumeMultiplier) {
        effectiveTotal = Math.max(1, Math.round(effectiveTotal * scenarioParams.leadVolumeMultiplier))
      }

  const now = Date.now()
  const vInfo = getOverrideVersionInfo(sim.scenario)
      const timestamps = expandDistribution(
        sim.distribution_method,
        effectiveTotal,
        sim.start_time,
        sim.end_time
      )

      // Cache full timestamps array in Redis for later segment expansions
      const redisCache = Redis.createClient({
        url: process.env.REDIS_URL || undefined,
        socket: process.env.REDIS_URL ? undefined : { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT,10) : 6379 }
      })
      redisCache.on('error', e => console.warn('Redis cache err:', e.message))
      try { await redisCache.connect() } catch (e) { console.warn('Redis cache connect fail:', e.message) }
      try {
        const key = `sim:${simulationId}:timestamps`
        // Store as JSON string; large arrays acceptable for initial caching (future: compression if needed)
        await redisCache.set(key, JSON.stringify(timestamps), { EX: 6 * 60 * 60 }) // 6h TTL
      } catch (e) { console.warn('Timestamp cache store failed:', e.message) }
      try { await redisCache.quit() } catch {}

      // Segment-based expansion (initial segment only)
      const SEGMENT_HOURS = 1
      const segmentSizeMs = SEGMENT_HOURS * 60 * 60 * 1000
      const firstSegmentEnd = sim.start_time + segmentSizeMs
      const segmentsZKey = `sim:${simulationId}:segments`
      const redis = Redis.createClient({
        url: process.env.REDIS_URL || undefined,
        socket: process.env.REDIS_URL ? undefined : { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT,10) : 6379 }
      })
      redis.on('error', e => console.warn('Segment redis error:', e.message))
      try { await redis.connect() } catch (e) { console.warn('Segment redis connect failed:', e.message) }

      // Pre-compute indices per segment
      const segmentDefs = []
      let currentStart = sim.start_time
      let lastIndex = 0
      while (currentStart < sim.end_time && lastIndex < timestamps.length) {
        const segEnd = Math.min(currentStart + segmentSizeMs, sim.end_time)
        // gather indices inside this segment
        const segIndices = []
        for (let i = lastIndex; i < timestamps.length; i++) {
          const ts = timestamps[i]
            if (ts >= currentStart && ts < segEnd) {
              segIndices.push(i)
            } else if (ts >= segEnd) {
              break
            }
        }
        if (segIndices.length) {
          lastIndex = segIndices[segIndices.length-1] + 1
          segmentDefs.push({ start: currentStart, end: segEnd, firstIdx: segIndices[0], lastIdx: segIndices[segIndices.length-1] })
        } else {
          currentStart = segEnd
          continue
        }
        currentStart = segEnd
      }

      // Store segments metadata
      if (segmentDefs.length) {
        const multi = redis.multi()
        for (let i=0;i<segmentDefs.length;i++) {
          const seg = segmentDefs[i]
          const id = `seg:${i}`
          multi.zAdd(segmentsZKey, [{ score: seg.start, value: id }])
          multi.hSet(`sim:${simulationId}:${id}`, {
            start: seg.start.toString(),
            end: seg.end.toString(),
            firstIdx: seg.firstIdx.toString(),
            lastIdx: seg.lastIdx.toString(),
          })
        }
        try { await multi.exec() } catch (e) { console.warn('Segment meta store failed:', e.message) }
      }

      // Enqueue only first segment
      const queue = getQueue(null, simulationId)
      let scheduled = 0
      if (segmentDefs.length) {
        const firstSeg = segmentDefs[0]
        for (let i = firstSeg.firstIdx; i <= firstSeg.lastIdx; i++) {
          const ts = timestamps[i]
          const delay = Math.max(0, ts - now)
          const retryOpts = buildBullOptions('contact')
          await queue.add('create-record', {
            simulationId,
            user_id: sim.user_id,
            index: i + 1,
            scenario: sim.scenario,
            distribution_method: sim.distribution_method,
            override_version: vInfo.version,
            overrides_hash: vInfo.hash,
            hubspot: hubspotConfig,
            scenario_params: scenarioParams ? {
              avgSalesCycleDays: scenarioParams.avgSalesCycleDays,
              dealWinRateBase: scenarioParams.dealWinRateBase,
              contactToCompanyRatio: scenarioParams.contactToCompanyRatio,
              interactions: scenarioParams.interactions ? {
                probabilities: scenarioParams.interactions.probabilities,
                perRecordCaps: scenarioParams.interactions.perRecordCaps,
                globalBudgets: scenarioParams.interactions.globalBudgets,
              } : null,
            } : null,
          }, { delay, ...retryOpts })
          scheduled++
        }
      }
      try { await redis.quit() } catch {}

      await knex('simulations').where({ id: simulationId }).update({
        status: 'RUNNING',
        updated_at: Date.now()
      })

      return { scheduled, effectiveTotal, overrideVersion: vInfo.version, overridesHash: vInfo.hash }
    },
  }
}

module.exports = { createOrchestrator }
