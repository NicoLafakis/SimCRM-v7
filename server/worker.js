// Worker process consuming simulation jobs.
// Run with: node server/worker.js

const { Worker, Queue } = require('bullmq')
const { createClient: createRedisClient } = require('redis')
const knexConfig = require('../knexfile')
const Knex = require('knex')
const { createClient } = require('./hubspotClient')
const { createTools } = require('./toolsFactory')
const { getDecryptedToken } = require('./hubspotKeyStore')

const knex = Knex(knexConfig.development || knexConfig)

// Redis progress counters (optional). Enabled if REDIS_PROGRESS=1
const USE_REDIS_PROGRESS = process.env.REDIS_PROGRESS === '1'
let redisClient = null
if (USE_REDIS_PROGRESS) {
  const buildRedisClientOpts = () => {
    if (process.env.REDIS_URL) {
      return { url: process.env.REDIS_URL, database: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB,10) : undefined }
    }
    return {
      socket: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT,10) : 6379,
        tls: (process.env.REDIS_HOST && process.env.REDIS_HOST.startsWith('redis-') && process.env.REDIS_FORCE_TLS === '1') ? {} : undefined,
      },
      password: process.env.REDIS_PASSWORD || undefined,
      database: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB,10) : undefined,
    }
  }
  redisClient = createRedisClient(buildRedisClientOpts())
  redisClient.on('error', (e) => console.warn('Redis error:', e.message)) // eslint-disable-line no-console
  redisClient.connect().catch(e => console.warn('Redis connect failed:', e.message)) // eslint-disable-line no-console
}

async function flushProgress(simulationId) {
  if (!USE_REDIS_PROGRESS || !redisClient) return
  const key = `sim:${simulationId}:processed`
  const valStr = await redisClient.get(key)
  if (!valStr) return
  const val = parseInt(valStr, 10)
  if (isNaN(val)) return
  // Write absolute value to DB
  await knex('simulations').where({ id: simulationId }).update({ records_processed: val, updated_at: Date.now() })
}

// Placeholder: we will later resolve per-user token or scenario-driven logic.
const { scheduleActivities } = require('./activityScheduler')
const { createRNG } = require('./rng')
const { logInfo, logError } = require('./logging')
const EVENTS = require('./logEvents')
const { classifyError } = require('./errorClassification')
const { buildBullOptions } = require('./jobRetryConfig')
const aiGenerator = require('./aiDataGenerator')

// Secondary activity constants
// Primary queue is now sharded: simulation-jobs:<shard>
const PRIMARY_QUEUE_BASENAME = 'simulation-jobs'
const SECONDARY_QUEUE = 'simulation-secondary'
const DLQ_QUEUE = 'simulation-dlq'
const SECONDARY_TYPES = new Set(['note','call','task','ticket'])

// Segment expansion constants
const SEGMENTS_Z_PREFIX = 'sim:' // full key sim:<id>:segments
const SEGMENT_HASH_PREFIX = 'sim:' // sim:<id>:seg:<n>

function deriveShard(simId) {
  // Simple hash placeholder for future expansion; currently returns 0 to match orchestrator
  return 0
}

function queueNameFor(simId) {
  const shard = deriveShard(simId)
  // BullMQ disallows ':' in queue names; use '-' as shard separator
  return `${PRIMARY_QUEUE_BASENAME}-${shard}`
}

async function maybeExpandNextSegment(redis, simulationId, currentIndex, nowTs) {
  if (!redis) return
  try {
    const aborted = await redis.get(`sim:${simulationId}:aborted`)
    if (aborted === '1') return
  } catch {}
  const segmentsKey = `sim:${simulationId}:segments`
  // Find which segment contains currentIndex by scanning segment hashes (small number expected)
  let segIds
  try { segIds = await redis.zRange(segmentsKey, 0, -1) } catch { return }
  if (!Array.isArray(segIds) || !segIds.length) return
  let currentSegId = null
  let currentSeg = null
  for (const id of segIds) {
    const h = await redis.hGetAll(`sim:${simulationId}:${id}`)
    const first = parseInt(h.firstIdx,10)
    const last = parseInt(h.lastIdx,10)
    if (!isNaN(first) && !isNaN(last) && currentIndex-1 >= first && currentIndex-1 <= last) {
      currentSegId = id
      currentSeg = h
      break
    }
  }
  if (!currentSegId || !currentSeg) return
  const lastIdx = parseInt(currentSeg.lastIdx,10)
  if (currentIndex-1 !== lastIdx) return // not finished segment yet
  // Determine next segment
  const idx = segIds.indexOf(currentSegId)
  if (idx === -1 || idx === segIds.length -1) return // no next segment
  const nextSegId = segIds[idx+1]
  const nextSeg = await redis.hGetAll(`sim:${simulationId}:${nextSegId}`)
  const firstIdx = parseInt(nextSeg.firstIdx,10)
  const lastIdx2 = parseInt(nextSeg.lastIdx,10)
  if (isNaN(firstIdx) || isNaN(lastIdx2)) return
  // Prevent duplicate expansion using a marker
  const markerKey = `sim:${simulationId}:${nextSegId}:expanded`
  const set = await redis.set(markerKey, '1', { NX: true, EX: 3600 })
  if (!set) return
  // Need timestamps slice; prefer cached full array
  const sim = await knex('simulations').where({ id: simulationId }).first()
  if (!sim) return
  let timestamps = null
  try {
    const cached = await redis.get(`sim:${simulationId}:timestamps`)
    if (cached) {
      try { timestamps = JSON.parse(cached) } catch { timestamps = null }
    }
  } catch {}
  if (!timestamps) {
    const { expandDistribution } = require('./distributionUtil')
    timestamps = expandDistribution(sim.distribution_method, sim.total_records, sim.start_time, sim.end_time)
    // Best effort repopulate cache to reduce future recomputes
    try { await redis.set(`sim:${simulationId}:timestamps`, JSON.stringify(timestamps), { EX: 3 * 60 * 60 }) } catch {}
  }
  const queueName = queueNameFor(simulationId)
  const { Queue } = require('bullmq')
  const queue = new Queue(queueName, { connection: bullConnection })
  try {
    for (let i = firstIdx; i <= lastIdx2; i++) {
      const ts = timestamps[i]
      const delay = Math.max(0, ts - nowTs)
      await queue.add('create-record', { simulationId, user_id: sim.user_id, index: i + 1, scenario: sim.scenario, distribution_method: sim.distribution_method }, { delay })
    }
  } finally {
    await queue.close()
  }
}

function withTimeout(promise, ms, label = 'operation') {
  let to
  const timer = new Promise((_, reject) => { to = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms) })
  return Promise.race([promise, timer]).finally(() => clearTimeout(to))
}

// ---- Rate limiting & resilience (Phase 2) ----
const TOKEN_BUCKET_KEY_PREFIX = 'ratelimit:bucket:'
const HUBSPOT_COOLDOWN_KEY = 'ratelimit:hubspot:cooldown_until'
const CIRCUIT_TRIP_KEY = 'circuit:hubspot:tripped_until'
const CIRCUIT_FAIL_WINDOW_KEY = 'circuit:hubspot:fail_window' // list of timestamps
const CIRCUIT_MAX_WINDOW_MS = 60_000
const CIRCUIT_MAX_FAILURES = 8
const CIRCUIT_COOLDOWN_MS = 30_000

const DEFAULT_BUCKET_SIZES = { contact: 50, note: 40, call: 25, task: 30, ticket: 15 }
const BUCKET_REFILL_MS = 60_000 // refill per minute baseline

async function fetchScenarioCapacities(simulationId) {
  try {
    const sim = await knex('simulations').where({ id: simulationId }).first()
    if (!sim) return null
    const scenario = sim.scenario
    const { getScenarioParameters } = require('./scenarioParameters')
    const params = getScenarioParameters(scenario)
    return params?.bucketCapacities || null
  } catch { return null }
}

async function refillBucketsIfDue(redis, simulationId) {
  if (!redis) return
  const now = Date.now()
  const lastKey = 'ratelimit:bucket:last_refill'
  let last = await redis.get(lastKey)
  last = last ? parseInt(last,10) : 0
  if (isNaN(last) || (now - last) >= BUCKET_REFILL_MS) {
    const scenarioCaps = simulationId ? await fetchScenarioCapacities(simulationId) : null
    const caps = { ...DEFAULT_BUCKET_SIZES, ...(scenarioCaps || {}) }
    // validation: ensure non-negative ints
    for (const k of Object.keys(caps)) {
      const v = caps[k]
      if (typeof v !== 'number' || v < 0 || !Number.isFinite(v)) caps[k] = DEFAULT_BUCKET_SIZES[k] || 0
    }
    const multi = redis.multi()
    for (const [type, size] of Object.entries(caps)) {
      multi.set(TOKEN_BUCKET_KEY_PREFIX + type, size.toString())
    }
    multi.set(lastKey, now.toString())
    try { await multi.exec() } catch {}
  }
}

async function takeToken(redis, type) {
  if (!redis) return true // fallback allow
  try {
    const key = TOKEN_BUCKET_KEY_PREFIX + type
    const lua = `local v=redis.call('GET',KEYS[1]); if (not v) then return -1 end; local n=tonumber(v); if (not n) then return -2 end; if (n<=0) then return 0 else redis.call('DECR',KEYS[1]); return n-1 end`
    const remaining = await redis.eval(lua, { keys: [key], arguments: [] })
    if (remaining === 0) return false
    if (remaining === -1 || remaining === -2) return true
    return true
  } catch { return true }
}

async function cooldownActive(redis) {
  if (!redis) return false
  try { const v = await redis.get(HUBSPOT_COOLDOWN_KEY); if (!v) return false; return Date.now() < parseInt(v,10) } catch { return false }
}

async function circuitTripped(redis) {
  if (!redis) return false
  try { const v = await redis.get(CIRCUIT_TRIP_KEY); if (!v) return false; return Date.now() < parseInt(v,10) } catch { return false }
}

async function recordFailure(redis) {
  if (!redis) return
  try {
    const now = Date.now()
    await redis.zAdd(CIRCUIT_FAIL_WINDOW_KEY, [{ score: now, value: String(now) }])
    const cutoff = now - CIRCUIT_MAX_WINDOW_MS
    await redis.zRemRangeByScore(CIRCUIT_FAIL_WINDOW_KEY, 0, cutoff)
    const count = await redis.zCard(CIRCUIT_FAIL_WINDOW_KEY)
    if (count >= CIRCUIT_MAX_FAILURES) {
      await redis.set(CIRCUIT_TRIP_KEY, (now + CIRCUIT_COOLDOWN_MS).toString())
    }
  } catch {}
}

async function recordSuccess(redis) {
  if (!redis) return
  try {
    // On success we can optionally trim older failures (already trimmed by score) no further action.
    const now = Date.now()
    const cutoff = now - CIRCUIT_MAX_WINDOW_MS
    await redis.zRemRangeByScore(CIRCUIT_FAIL_WINDOW_KEY, 0, cutoff)
  } catch {}
}

async function processJob(job) {
  const { simulationId, index, user_id, scenario_params, phase = 'contact_created', type: secondaryType } = job.data
  // Primary job idempotency (only for create-record style primary path)
  if (job.name === 'create-record') {
    try {
      const key = idempotencyKey(simulationId, job.data?.override_version, index)
      const acquired = await acquireIdempotency(key)
      if (!acquired) {
        if (redisClient) { try { await redisClient.hIncrBy(`sim:${simulationId}:metrics`, 'idempotency_skipped', 1) } catch {} }
  logInfo({ eventId: EVENTS.IDEMPOTENCY_SKIP, msg: 'idempotency skip', simulationId, recordIndex: index, jobId: job.id, overrideVersion: job.data?.override_version })
        return { ok:true, skipped:true, index }
      }
    } catch {}
  }
  const startHr = process.hrtime.bigint()
  const sim = await knex('simulations').where({ id: simulationId }).first()
  if (!sim) {
    const latencyMs = Number(process.hrtime.bigint() - startHr) / 1e6
  logError({ eventId: EVENTS.JOB_FAILED, msg: 'simulation missing', simulationId, recordIndex: index, jobType: phase === 'secondary_activity' ? 'secondary' : 'primary', latencyMs, jobId: job.id, overrideVersion: job.data?.override_version })
    return { ok: false, error: 'simulation missing' }
  }

  // Resolve user HubSpot token if available
  let hubspotToken = null
  if (user_id) {
    // Look up active key id from users
    try {
      const userRow = await knex('users').where({ id: user_id }).first()
      if (userRow?.hubspot_active_key_id) {
        hubspotToken = await getDecryptedToken({ userId: user_id, id: userRow.hubspot_active_key_id })
      }
    } catch (e) {
      console.warn('Token resolution failed:', e.message) // eslint-disable-line no-console
    }
  }

  if (hubspotToken) {
    // In future: actually create objects in HubSpot using tools.
    try {
      if (USE_REDIS_PROGRESS && redisClient) {
        await refillBucketsIfDue(redisClient, simulationId)
        if (await cooldownActive(redisClient) || await circuitTripped(redisClient)) {
          // Skip external call path due to cooldown or circuit trip
        } else if (await takeToken(redisClient, phase === 'contact_created' ? 'contact' : (secondaryType || 'note'))) {
          const { setTelemetryHandlers } = require('./hubspotClient')
          const client = createClient({})
          // Attach telemetry handlers (scoped inside job for per-simulation metrics)
          setTelemetryHandlers({
            onRateLimit: async (attempt, retryAfter) => {
              if (redisClient) {
                try {
                  const mk = `sim:${simulationId}:metrics`
                  await redisClient.hIncrBy(mk, 'rate_limit_hits', 1)
                  if (retryAfter != null) await redisClient.hIncrBy(mk, 'rate_limit_total_delay_ms', retryAfter)
                  await redisClient.hSet(mk, { rate_limit_last_hit_at: Date.now().toString() })
                  const listKey = `sim:${simulationId}:ratelimit:events`
                  const evt = JSON.stringify({ ts: Date.now(), recordIndex: index, attempt, retryAfter })
                  await redisClient.lPush(listKey, evt)
                  await redisClient.lTrim(listKey, 0, 199)
                } catch {}
              }
            },
            onRetryScheduled: async (attempt, delay, status) => {
              if (redisClient) {
                try {
                  const mk = `sim:${simulationId}:metrics`
                  await redisClient.hIncrBy(mk, 'retries_total', 1)
                  if (status === 429) {
                    await redisClient.hIncrBy(mk, 'rate_limit_scheduled_delay_ms', delay)
                  }
                } catch {}
              }
            }
          })
          client.setToken(hubspotToken)
          const tools = createTools(client)

          // AI-powered record creation
          if (phase === 'contact_created') {
            // Primary phase: Generate and create contact + company
            const context = {
              index,
              scenario: sim.scenario,
              distribution_method: sim.distribution_method
            }
            const generatedData = await aiGenerator.generateContactAndCompany(context, redisClient, simulationId)

            // Create contact and company via orchestrator (includes property validation)
            const { createOrchestrator } = require('./orchestrator')
            const orchestrator = createOrchestrator({ apiToken: hubspotToken, redisClient })
            const result = await orchestrator.createContactWithCompany({
              contactProps: generatedData.contact,
              companyProps: generatedData.company,
              simId: simulationId
            })

            // Store created record IDs for secondary activities
            if (result && !result.simulated) {
              try {
                await redisClient.hSet(`sim:${simulationId}:rec:${index}:ids`, {
                  contactId: result.contact.id,
                  companyId: result.company.id
                })
              } catch (e) {
                console.warn('Failed to store record IDs:', e.message)
              }
            }
          } else if (phase === 'secondary_activity' && secondaryType) {
            // Secondary phase: Generate and create note/call/task/ticket
            let recordIds = null
            try {
              recordIds = await redisClient.hGetAll(`sim:${simulationId}:rec:${job.data.record_index}:ids`)
            } catch {}

            const context = {
              index: job.data.record_index,
              scenario: sim.scenario,
              contactData: null // Would need to fetch if needed
            }

            const { createOrchestrator } = require('./orchestrator')
            const orchestrator = createOrchestrator({ apiToken: hubspotToken, redisClient })

            switch (secondaryType) {
              case 'note':
                const noteData = await aiGenerator.generateNote(context, redisClient, simulationId)
                await orchestrator.createNoteWithAssociations({
                  noteProps: noteData,
                  contactId: recordIds?.contactId,
                  companyId: recordIds?.companyId,
                  simId: simulationId
                })
                break
              case 'call':
                const callData = await aiGenerator.generateCall(context, redisClient, simulationId)
                await orchestrator.createCallForContact({
                  callProps: callData,
                  contactId: recordIds?.contactId,
                  simId: simulationId
                })
                break
              case 'task':
                const taskData = await aiGenerator.generateTask(context, redisClient, simulationId)
                await orchestrator.createTaskForContact({
                  taskProps: taskData,
                  contactId: recordIds?.contactId,
                  simId: simulationId
                })
                break
              case 'ticket':
                // Note: Ticket creation not yet in orchestrator, would need to add
                const ticketData = await aiGenerator.generateTicket(context, redisClient, simulationId)
                // await tools.tickets.create({ properties: ticketData })
                break
            }
          }

          await recordSuccess(redisClient)
          // Success metrics depending on phase
          const metricsKey = `sim:${simulationId}:metrics`
          if (phase === 'contact_created') { try { await redisClient.hIncrBy(metricsKey, 'contacts_created_real', 1) } catch {} }
          else if (phase === 'secondary_activity' && secondaryType) {
            try { await redisClient.hIncrBy(metricsKey, `${secondaryType}s_created_real`, 1) } catch {}
          }
        }
      }
    } catch (e) {
      const cls = classifyError(e)
  logError({ eventId: EVENTS.HUBSPOT_OP_FAILED, msg: 'hubspot op failed', simulationId, recordIndex: index, error: e.message, category: cls.category, retryable: cls.retryable, jobId: job.id, overrideVersion: job.data?.override_version })
      if (USE_REDIS_PROGRESS && redisClient) {
        if (e.response?.status === 429) {
          try { await redisClient.set(HUBSPOT_COOLDOWN_KEY, (Date.now()+15000).toString(), { EX: 30 }) } catch {}
        }
        await recordFailure(redisClient)
        const metricsKey = `sim:${simulationId}:metrics`
        try { await redisClient.hIncrBy(metricsKey, phase === 'secondary_activity' ? 'secondary_failures' : 'create_failures', 1) } catch {}
      }
    }
  }

  // Memory usage monitoring (lightweight, every 50 jobs) – optional
  if (USE_REDIS_PROGRESS && redisClient && index % 50 === 0) {
    try {
      const info = await redisClient.info('memory')
      const usedMatch = info.match(/used_memory:(\d+)/)
      const maxMatch = info.match(/maxmemory:(\d+)/)
      const used = usedMatch ? parseInt(usedMatch[1],10) : null
      const max = maxMatch ? parseInt(maxMatch[1],10) : null
      if (used && max && max > 0) {
        const ratio = used / max
        if (ratio > 0.8) {
          console.warn(`Redis memory warning: ${(ratio*100).toFixed(1)}% used (${used}/${max})`) // eslint-disable-line no-console
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Secondary activity job path (no new scheduling, just bookkeeping & (future) HubSpot calls)
  if (phase === 'secondary_activity' && secondaryType && USE_REDIS_PROGRESS && redisClient) {
  const latencyMs = Number(process.hrtime.bigint() - startHr) / 1e6
  logInfo({ eventId: EVENTS.JOB_COMPLETED, msg: 'secondary job completed', simulationId, recordIndex: index, jobType: 'secondary', secondaryType, latencyMs, jobId: job.id, overrideVersion: job.data?.override_version })
    const metricsKey = `sim:${simulationId}:metrics`
    try { await redisClient.hIncrBy(metricsKey, `${secondaryType}s_created`, 1) } catch {}
    // Potential future: invoke HubSpot create note/call/task.
    return { ok: true, secondary: secondaryType, index }
  }

  // Initialize / update metrics & budgets in Redis (primary job path)
  if (USE_REDIS_PROGRESS && redisClient) {
    const metricsKey = `sim:${simulationId}:metrics`
    // Increment records_created metric (only on primary contact_created phase)
    if (phase === 'contact_created') {
      try { await redisClient.hIncrBy(metricsKey, 'records_created', 1) } catch {}
    }

    // Ensure global budgets hash initialized once (best effort)
    if (scenario_params?.interactions?.globalBudgets) {
      const budgetKey = `sim:${simulationId}:budget`
      // Use HSETNX like pattern: fetch one field to detect existence
      const existing = await redisClient.hGet(budgetKey, 'notes')
      if (existing === null) {
        const gb = scenario_params.interactions.globalBudgets
        const init = {}
        if (gb.notes != null) init.notes = gb.notes
        if (gb.calls != null) init.calls = gb.calls
        if (gb.tasks != null) init.tasks = gb.tasks
        if (gb.tickets != null) init.tickets = gb.tickets
        if (Object.keys(init).length) {
          try { await redisClient.hSet(budgetKey, init) } catch {}
        }
      }
    }

    // Per-record counts key (sparse)
    const recordCountsKey = `sim:${simulationId}:rec:${index}`

    // Prepare interactions scheduling (lazy secondary actions)
    let secondary = []
    if (scenario_params?.interactions && phase === 'contact_created') { // only generate from primary phase for now
      const interactions = scenario_params.interactions
      // Load budgets & record counts
      const budgetKey = `sim:${simulationId}:budget`
      const budgetVals = await redisClient.hGetAll(budgetKey)
      const recordVals = await redisClient.hGetAll(recordCountsKey)
      const parseIntMap = (obj) => Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, parseInt(v,10)]).filter(([,v]) => !isNaN(v)))
      const budget = parseIntMap(budgetVals)
      const recordCounts = parseIntMap(recordVals)
      const rng = createRNG(simulationId + ':' + index)
      secondary = scheduleActivities({ context: { phase, recordId: index, simulationId }, interactions, rng, budget, recordCounts })

      // Adaptive thinning (Phase 4)
      try {
        // Estimate pressure: primary queue depth + secondary queue depth
        const primaryQueueName = queueNameFor(simulationId)
        const { Queue: QTmp } = require('bullmq')
        const pq = new QTmp(primaryQueueName, { connection: bullConnection })
        const sq = new QTmp(SECONDARY_QUEUE, { connection: bullConnection })
        const [primaryWaiting, secondaryWaiting] = await Promise.all([
          pq.getWaitingCount().catch(()=>0),
          sq.getWaitingCount().catch(()=>0)
        ])
        await pq.close(); await sq.close()
        const totalWaiting = primaryWaiting + secondaryWaiting
        // Determine thinning factor
        let factor = 1
        if (await circuitTripped(redisClient)) factor *= 0.4
        if (totalWaiting > 5000) factor *= 0.5
        else if (totalWaiting > 2000) factor *= 0.7
        else if (totalWaiting > 1000) factor *= 0.85
        if (factor < 1) {
          const before = secondary.length
          secondary = secondary.filter(a => rng() < factor)
          if (before !== secondary.length) {
            logInfo({ eventId: EVENTS.ACTIVITY_THINNING_APPLIED, msg: 'activity thinning applied', simulationId, recordIndex: index, before, after: secondary.length, factor, totalWaiting, jobId: job.id, overrideVersion: job.data?.override_version })
            try {
              const listKey = `sim:${simulationId}:thinning:events`
              const event = JSON.stringify({ ts: Date.now(), recordIndex: index, before, after: secondary.length, factor, totalWaiting })
              await redisClient.lPush(listKey, event)
              await redisClient.lTrim(listKey, 0, 199) // keep last 200 events
            } catch {}
          }
        }
      } catch (e) {
  logError({ eventId: EVENTS.ACTIVITY_THINNING_ERROR, msg: 'activity thinning error', simulationId, recordIndex: index, error: e.message, jobId: job.id, overrideVersion: job.data?.override_version })
      }
      // Persist modified budgets & recordCounts after scheduling
      if (Object.keys(budget).length) {
        const toStore = {}
        for (const [k,v] of Object.entries(budget)) toStore[k] = v.toString()
        try { await redisClient.hSet(budgetKey, toStore) } catch {}
      }
      if (Object.keys(recordCounts).length) {
        const toStore = {}
        for (const [k,v] of Object.entries(recordCounts)) toStore[k] = v.toString()
        try { await redisClient.hSet(recordCountsKey, toStore) } catch {}
      }
      // Enqueue secondary jobs with idempotency markers
      for (const act of secondary) {
        if (!SECONDARY_TYPES.has(act.type)) continue
        const ord = act.ordinal || 1
        const markerKey = `sim:${simulationId}:sec:${index}:${act.type}:${ord}`
        let setOK = false
        try {
          // NX to ensure single enqueue per record/type; TTL 1h to avoid orphan persistence
            // For redis v4, options object form
          const res = await redisClient.set(markerKey, '1', { NX: true, EX: 60 * 60 })
          setOK = !!res
        } catch {}
        if (!setOK) continue
        try { await redisClient.hIncrBy(metricsKey, `${act.type}s_scheduled`, 1) } catch {}
        try {
          const q = new Queue(SECONDARY_QUEUE, { connection: bullConnection })
          const retryOpts = buildBullOptions(act.type || 'secondary')
          await q.add('secondary-activity', { simulationId, user_id, record_index: index, type: act.type, ordinal: ord, phase: 'secondary_activity', scenario_params }, { delay: act.delayMs || 0, ...retryOpts })
          await q.close()
        } catch (e) {
          console.warn('Enqueue secondary failed:', e.message) // eslint-disable-line no-console
        }
      }
    }

    // Legacy progress counter (records processed) retained below
    const key = `sim:${simulationId}:processed`
    const newVal = await redisClient.incr(key)
    // Every 10 increments flush to DB
    if (newVal % 10 === 0) {
      await flushProgress(simulationId)
    }
    if (newVal >= sim.total_records) {
      await flushProgress(simulationId)
      await knex('simulations').where({ id: simulationId }).update({ status: 'COMPLETED', finished_at: Date.now(), updated_at: Date.now() })
    }
    // Segment auto expansion attempt
    try { await maybeExpandNextSegment(redisClient, simulationId, index, Date.now()) } catch (e) { console.warn('Segment expansion error:', e.message) }
  } else {
    // Fallback direct DB increment
    await knex('simulations')
      .where({ id: simulationId })
      .increment('records_processed', 1)
      .update({ updated_at: Date.now() })
    const updated = await knex('simulations').where({ id: simulationId }).first()
    if (updated && updated.records_processed >= updated.total_records) {
      await knex('simulations')
        .where({ id: simulationId })
        .update({ status: 'COMPLETED', finished_at: Date.now(), updated_at: Date.now() })
    }
  }
  // Success (primary path)
  const latencyMs = Number(process.hrtime.bigint() - startHr) / 1e6
  if (redisClient) {
    const metricsKey = `sim:${simulationId}:metrics`
    try { await redisClient.hIncrBy(metricsKey, 'contacts_created', 1) } catch {}
    try { await redisClient.hIncrBy(metricsKey, 'contact_latency_count', 1) } catch {}
    try { await redisClient.hIncrBy(metricsKey, 'contact_latency_total_ms', Math.round(latencyMs)) } catch {}
    try { await redisClient.hSet(metricsKey, { last_progress_ts: Date.now().toString(), overrides_version: (job.data?.override_version || 0).toString() }) } catch {}
  }
  logInfo({ eventId: EVENTS.JOB_COMPLETED, msg: 'job completed', simulationId, recordIndex: index, jobType: 'primary', latencyMs, jobId: job.id, overrideVersion: job.data?.override_version })
  return { ok: true, index }
}

// Build BullMQ connection options from env
let bullConnection
if (process.env.REDIS_URL) {
  // BullMQ (ioredis) supports passing a connection object; we parse URL minimalistically for host/port/password
  try {
    const u = new URL(process.env.REDIS_URL)
    bullConnection = {
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
if (!bullConnection) {
  bullConnection = {
    host: process.env.REDIS_HOST || undefined,
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB,10) : undefined,
  }
}
Object.keys(bullConnection).forEach(k => bullConnection[k] === undefined && delete bullConnection[k])
// Spawn one primary worker per shard (default 1 shard)
const SHARDS = process.env.SIMCRM_QUEUE_SHARDS ? parseInt(process.env.SIMCRM_QUEUE_SHARDS,10) : 1
const primaryWorkers = []
for (let s=0; s<SHARDS; s++) {
  const qName = `${PRIMARY_QUEUE_BASENAME}-${s}`
  const w = new Worker(qName, (job) => withTimeout(processJob(job), 20000, 'primary job'), { connection: bullConnection })
  w.on('completed', (job, result) => {
  try { logInfo({ eventId: EVENTS.QUEUE_WORKER_COMPLETED, msg: 'queue worker completed', queue: qName, jobId: job.id, simulationId: job.data?.simulationId, recordIndex: job.data?.index, overrideVersion: job.data?.override_version, result }) } catch {}
  })
  w.on('failed', (job, err) => {
  try { logError({ eventId: EVENTS.QUEUE_WORKER_FAILED, msg: 'queue worker failed', queue: qName, jobId: job?.id, simulationId: job?.data?.simulationId, recordIndex: job?.data?.index, overrideVersion: job?.data?.override_version, error: err?.message }) } catch {}
  })
  primaryWorkers.push(w)
}
const secondaryWorker = new Worker(SECONDARY_QUEUE, (job) => withTimeout(processJob(job), 15000, 'secondary job'), { connection: bullConnection })
secondaryWorker.on('completed', (job, result) => {
  try { logInfo({ eventId: EVENTS.QUEUE_WORKER_COMPLETED, msg: 'queue worker completed', queue: SECONDARY_QUEUE, jobId: job.id, simulationId: job.data?.simulationId, recordIndex: job.data?.index, overrideVersion: job.data?.override_version, result }) } catch {}
})
secondaryWorker.on('failed', (job, err) => {
  try { logError({ eventId: EVENTS.QUEUE_WORKER_FAILED, msg: 'queue worker failed', queue: SECONDARY_QUEUE, jobId: job?.id, simulationId: job?.data?.simulationId, recordIndex: job?.data?.index, overrideVersion: job?.data?.override_version, error: err?.message }) } catch {}
})

// Dead Letter Queue (DLQ) routing logic
const { Queue: BullQueue } = require('bullmq')
const dlqQueue = new BullQueue(DLQ_QUEUE, { connection: bullConnection })

async function recordDLQ(job, err, queueName) {
  const simId = job?.data?.simulationId
  const cls = classifyError(err)
  // Persist lightweight counters & bounded sample list in Redis if available
  if (USE_REDIS_PROGRESS && redisClient && simId) {
    try {
      const countsKey = `sim:${simId}:dlq:counts`
      await redisClient.hIncrBy(countsKey, cls.category, 1)
      const listKey = `sim:${simId}:dlq:samples`
      const sample = JSON.stringify({ ts: Date.now(), category: cls.category, retryable: cls.retryable, msg: err?.message, queue: queueName, jobId: job.id, index: job.data?.index })
      await redisClient.lPush(listKey, sample)
      await redisClient.lTrim(listKey, 0, 24)
    } catch {}
  }
  try {
    await dlqQueue.add('dead-letter', {
      originalQueue: queueName,
      jobId: job.id,
      simulationId: simId,
      data: job.data,
      error: err?.message,
      category: cls.category,
      retryable: cls.retryable,
      failedAt: Date.now(),
      attemptsMade: job.attemptsMade,
    })
  } catch (e) {
  logError({ eventId: EVENTS.DLQ_ENQUEUE_FAILED, msg: 'dlq enqueue failed', error: e.message })
  }
}

function attachDLQHandlers(workerInstance, queueLabel) {
  workerInstance.on('failed', (job, err) => {
    // Only route to DLQ if non-retryable OR attempts exceeded threshold
    const attempts = job?.attemptsMade || 0
    const maxAttempts = job?.opts?.attempts || 1
    const cls = classifyError(err)
    const route = !cls.retryable || attempts >= maxAttempts
    if (route) {
      recordDLQ(job, err, queueLabel).catch(()=>{})
    }
  })
}

// Attach DLQ handlers after base handlers
for (const w of primaryWorkers) attachDLQHandlers(w, 'primary')
attachDLQHandlers(secondaryWorker, 'secondary')

async function gracefulShutdown() {
  console.log('Worker shutting down...') // eslint-disable-line no-console
  for (const w of primaryWorkers) {
    try { await w.close() } catch (e) { console.warn('Primary worker close error:', e.message) }
  }
  try { await secondaryWorker.close() } catch (e) { console.warn('Secondary worker close error:', e.message) }
  if (USE_REDIS_PROGRESS && redisClient) {
    // Flush all simulation counters that might exist (simplistic: scan)
    try {
      for await (const key of (async function* scanKeys(cursor=0){
        let cur = cursor
        do {
          const res = await redisClient.scan(cur, { MATCH: 'sim:*:processed', COUNT: 100 })
          cur = res.cursor
          for (const k of res.keys) yield k
        } while (cur !== 0)
      })()) {
        const simId = key.split(':')[1]
        await flushProgress(simId)
      }
    } catch (e) {
      console.warn('Flush scan error:', e.message)
    }
    try { await redisClient.quit() } catch {}
  }
  process.exit(0)
}

process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)
