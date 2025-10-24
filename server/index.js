require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const { createOrchestrator } = require('./orchestrator')
const { listKeys, createKey, deleteKey, getDecryptedToken } = require('./hubspotKeyStore')
const { pool } = require('./db')
const axios = require('axios')
const { authMiddleware, issueToken } = require('./auth')
const { v4: uuidv4 } = require('uuid')
const { Queue, Job } = require('bullmq')
const { logInfo, logError } = require('./logging')
const EVENTS = require('./logEvents')
const { buildBullOptions, getRetryConfig } = require('./jobRetryConfig')
const { setScenarioOverrides, getScenarioOverrides, getMergedScenario, listAdjustableKeys, resetScenarioOverrides, getOverrideVersionInfo } = require('./configSurface')
const { expandDistribution } = require('./distributionUtil')

const PORT = process.env.PORT || 4000
const API_TOKEN = process.env.HUBSPOT_API_TOKEN // optional now
if (!API_TOKEN) console.log('Info: HUBSPOT_API_TOKEN not set at startup (expected: per-user tokens will be used).')

const orchestrator = createOrchestrator({ apiToken: API_TOKEN })

const app = express()
app.use(bodyParser.json())

// Auth middleware: JWT + optional dev bypass (APP_ALLOW_DEV_HEADER=1)
app.use(authMiddleware)

function requireBoss(req,res,next) {
  if (!req.user || req.user.role !== 'boss') return res.status(403).json({ error: 'forbidden', requiredRole: 'boss' })
  next()
}

// Boss-only: read-only exposure of current retry/backoff configuration (env-derived)
// Future: add PUT /api/boss/retry-config with validation, versioning, and audit logging.
app.get('/api/boss/retry-config', requireBoss, (req, res) => {
  try {
    const { getRetryConfig } = require('./jobRetryConfig')
    const config = getRetryConfig()
    res.json({ ok: true, version: 1, source: 'env', config })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Boss-only: configuration surface (runtime in-memory overrides)
app.get('/api/boss/config/adjustable', requireBoss, (req,res) => {
  res.json({ ok:true, adjustable: listAdjustableKeys() })
})

app.get('/api/boss/config/scenario/:id', requireBoss, (req,res) => {
  const id = req.params.id
  const merged = getMergedScenario(id)
  if (!merged) return res.status(404).json({ ok:false, error:'scenario_not_found' })
  const overrides = getScenarioOverrides(id)
  const vInfo = getOverrideVersionInfo(id)
  res.json({ ok:true, scenarioId: id, merged, overrides: overrides || {}, overrideVersion: vInfo.version, overridesHash: vInfo.hash })
})

app.post('/api/boss/config/scenario/:id', requireBoss, (req,res) => {
  const id = req.params.id
  try {
    const applied = setScenarioOverrides(id, req.body || {})
    const merged = getMergedScenario(id)
    const vInfo = getOverrideVersionInfo(id)
    res.json({ ok:true, scenarioId: id, overrides: applied, merged, overrideVersion: vInfo.version, overridesHash: vInfo.hash })
  } catch (e) {
    res.status(400).json({ ok:false, error: e.message })
  }
})

app.delete('/api/boss/config/scenario/:id', requireBoss, (req,res) => {
  const id = req.params.id
  resetScenarioOverrides(id)
  const merged = getMergedScenario(id)
  if (!merged) return res.status(404).json({ ok:false, error:'scenario_not_found' })
  res.json({ ok:true, scenarioId: id, overrides: {}, merged, overrideVersion: 0, overridesHash: null })
})

// Helper sleep used by association test sequence
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Boss-only: HubSpot readiness quick-check (pipelines + stages for deals & tickets)
app.get('/api/boss/hubspot-readiness', requireBoss, async (req, res) => {
  try {
    const { createClient } = require('./hubspotClient')
    const { buildPath } = require('./tools/hubspot/apiRegistry')
    const token = process.env.HUBSPOT_API_TOKEN || null
    const client = createClient({})
    if (token) client.setToken(token)
    // If no global token, we still allow check — per-user tokens may be used in production.
    const result = { ok: true, timestamp: Date.now(), checks: {} }
    const targets = [
      { name: 'deals', listKey: 'crm.pipelines.deals.list', stagesKey: 'crm.pipelines.deals.stages.list' },
      { name: 'tickets', listKey: 'crm.pipelines.tickets.list', stagesKey: 'crm.pipelines.tickets.stages.list' }
    ]
    for (const t of targets) {
      try {
        const listPath = buildPath(t.listKey)
        const lres = await client.get(listPath, { limit: 5 })
        const pipelines = lres.data && (lres.data.results || lres.data)
        result.checks[t.name] = { listStatus: lres.status, pipelines: [] }
        if (Array.isArray(pipelines)) {
          for (const p of pipelines.slice(0,5)) {
            const pid = p.id || p.pipelineId || p.pipeline || String(p.id)
            try {
              const stagesPath = buildPath(t.stagesKey, pid)
              const sres = await client.get(stagesPath, { limit: 50 })
              result.checks[t.name].pipelines.push({ pipelineId: pid, stagesStatus: sres.status, stageCount: Array.isArray(sres.data?.results) ? sres.data.results.length : (sres.data?.stages ? sres.data.stages.length : null) })
            } catch (e) {
              result.checks[t.name].pipelines.push({ pipelineId: pid, error: e.message })
            }
          }
        }
      } catch (e) {
        result.checks[t.name] = { error: e.message }
      }
    }
    res.json(result)
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Boss-only: run a sequence of HubSpot creates and associations to validate flows.
// This performs read/write operations against HubSpot and will use the global HUBSPOT_API_TOKEN
// configured for the server. Use cautiously in production.
app.post('/api/boss/hubspot-association-test', requireBoss, async (req,res) => {
  const out = { ok: false, steps: [], errors: [] }
  try {
    const { createClient } = require('./hubspotClient')
    const { buildPath } = require('./tools/hubspot/apiRegistry')
    const token = process.env.HUBSPOT_API_TOKEN
    if (!token) return res.status(400).json({ ok:false, error: 'HUBSPOT_API_TOKEN not configured on server' })
    const client = createClient({})
    client.setToken(token)

    // Helper to POST and record result
    async function postAndRecord(keyOrPath, body, note) {
      const path = keyOrPath && keyOrPath.startsWith ? (keyOrPath.startsWith('/') ? keyOrPath : buildPath(keyOrPath)) : buildPath(keyOrPath)
      try {
        const r = await client.post(path, body)
        out.steps.push({ note, status: r.status, body: r.data })
        return r.data
      } catch (e) {
        const info = { message: e.message }
        try { info.status = e.response?.status } catch {};
        try { info.responseData = e.response?.data } catch {};
        out.steps.push({ note, error: info })
        out.errors.push({ step: note, error: info })
        return null
      }
    }

    try {
      // 1) Create Company
      const companyBody = { properties: { name: `TestCo ${Date.now()}`, domain: `test-${Date.now()}.local` } }
      const companyRes = await postAndRecord('crm.companies.create', companyBody, 'create_company')
      const companyId = companyRes && (companyRes.id || (companyRes.results && companyRes.results[0] && companyRes.results[0].id))
      await sleep(3000)

      // 2) Create Contact and associate to Company
      const contactBody = { properties: { email: `test+${Date.now()}@example.local`, firstname: 'Assoc', lastname: 'Tester' } }
      const contactRes = await postAndRecord('crm.contacts.create', contactBody, 'create_contact')
      const contactId = contactRes && (contactRes.id || (contactRes.results && contactRes.results[0] && contactRes.results[0].id))
      // Associate contact -> company
      try {
        const assocPath = buildPath('crm.associations.create', 'contacts', contactId, 'companies', companyId)
        try {
          const ares = await client.put(assocPath)
          out.steps.push({ note: 'associate_contact_company', status: ares.status, body: ares.data })
        } catch (e) { const info = { message: e.message, status: e.response?.status, data: e.response?.data }; out.steps.push({ note: 'associate_contact_company', error: info }); out.errors.push({ step: 'associate_contact_company', error: info }) }
      } catch (e) { out.steps.push({ note: 'associate_contact_company', error: e.message }); out.errors.push({ step: 'associate_contact_company', error: e.message }) }
      await sleep(3000)

      // 3) Create Invoice and associate to Company (invoices are v3 objects)
      const invoiceBody = { properties: { hs_title: `Invoice ${Date.now()}`, hs_amount: '100.00' } }
      const invoiceRes = await postAndRecord('crm.invoices.create', invoiceBody, 'create_invoice')
      const invoiceId = invoiceRes && (invoiceRes.id || (invoiceRes.results && invoiceRes.results[0] && invoiceRes.results[0].id))
      try {
        const assocInvPath = buildPath('crm.associations.create', 'invoices', invoiceId, 'companies', companyId)
        try {
          const iar = await client.put(assocInvPath)
          out.steps.push({ note: 'associate_invoice_company', status: iar.status, body: iar.data })
        } catch (e) { const info = { message: e.message, status: e.response?.status, data: e.response?.data }; out.steps.push({ note: 'associate_invoice_company', error: info }); out.errors.push({ step: 'associate_invoice_company', error: info }) }
      } catch (e) { out.steps.push({ note: 'associate_invoice_company', error: e.message }); out.errors.push({ step: 'associate_invoice_company', error: e.message }) }
      await sleep(3000)

      // 4) Create Ticket and associate to Company owner (we'll use company.ownerId if present)
      const ticketBody = { properties: { subject: `Ticket ${Date.now()}`, content: 'Assoc test ticket' } }
      const ticketRes = await postAndRecord('crm.tickets.create', ticketBody, 'create_ticket')
      const ticketId = ticketRes && (ticketRes.id || (ticketRes.results && ticketRes.results[0] && ticketRes.results[0].id))
      const companyOwnerId = companyRes?.properties?.hubspot_owner_id || companyRes?.properties?.ownerId || null
      if (companyOwnerId) {
        try {
          const assocTicketOwner = buildPath('crm.associations.create', 'tickets', ticketId, 'owners', companyOwnerId)
          try {
            const tor = await client.put(assocTicketOwner)
            out.steps.push({ note: 'associate_ticket_owner', status: tor.status, body: tor.data })
          } catch (e) { const info = { message: e.message, status: e.response?.status, data: e.response?.data }; out.steps.push({ note: 'associate_ticket_owner', error: info }); out.errors.push({ step: 'associate_ticket_owner', error: info }) }
        } catch (e) { out.steps.push({ note: 'associate_ticket_owner', error: e.message }); out.errors.push({ step: 'associate_ticket_owner', error: e.message }) }
      } else {
        out.steps.push({ note: 'associate_ticket_owner', warning: 'company_owner_not_found' })
      }
      await sleep(3000)

      // 5) Create Deal and associate to Company and Contact
      const dealBody = { properties: { dealname: `Deal ${Date.now()}`, amount: '250' } }
      const dealRes = await postAndRecord('crm.deals.create', dealBody, 'create_deal')
      const dealId = dealRes && (dealRes.id || (dealRes.results && dealRes.results[0] && dealRes.results[0].id))
      try {
        const assocDealCompany = buildPath('crm.associations.create', 'deals', dealId, 'companies', companyId)
        try {
          const dcr = await client.put(assocDealCompany)
          out.steps.push({ note: 'associate_deal_company', status: dcr.status, body: dcr.data })
        } catch (e) { const info = { message: e.message, status: e.response?.status, data: e.response?.data }; out.steps.push({ note: 'associate_deal_company', error: info }); out.errors.push({ step: 'associate_deal_company', error: info }) }
      } catch (e) { out.steps.push({ note: 'associate_deal_company', error: e.message }); out.errors.push({ step: 'associate_deal_company', error: e.message }) }
      try {
        const assocDealContact = buildPath('crm.associations.create', 'deals', dealId, 'contacts', contactId)
        try {
          const dcr2 = await client.put(assocDealContact)
          out.steps.push({ note: 'associate_deal_contact', status: dcr2.status, body: dcr2.data })
        } catch (e) { const info = { message: e.message, status: e.response?.status, data: e.response?.data }; out.steps.push({ note: 'associate_deal_contact', error: info }); out.errors.push({ step: 'associate_deal_contact', error: info }) }
      } catch (e) { out.steps.push({ note: 'associate_deal_contact', error: e.message }); out.errors.push({ step: 'associate_deal_contact', error: e.message }) }
      await sleep(3000)

      // 6) Create Call (engagement) and associate to Deal and Contact
      const engagementBody = { engagement: { active: true, type: 'CALL', timestamp: Date.now() }, associations: { dealIds: [dealId], contactIds: [contactId] }, metadata: { body: 'Test call' } }
      try {
        try {
          const er = await client.post(buildPath('engagements.create'), engagementBody)
          out.steps.push({ note: 'create_call', status: er.status, body: er.data })
        } catch (e) { const info = { message: e.message, status: e.response?.status, data: e.response?.data }; out.steps.push({ note: 'create_call', error: info }); out.errors.push({ step: 'create_call', error: info }) }
      } catch (e) { out.steps.push({ note: 'create_call', error: e.message }); out.errors.push({ step: 'create_call', error: e.message }) }
      await sleep(3000)

      // 7) Create Note and associate to Contact, Deal, Company
      const noteBody = { engagement: { active: true, type: 'NOTE', timestamp: Date.now() }, associations: { contactIds: [contactId], dealIds: [dealId], companyIds: [companyId] }, metadata: { body: 'Test note' } }
      try {
        try {
          const nr = await client.post(buildPath('engagements.create'), noteBody)
          out.steps.push({ note: 'create_note', status: nr.status, body: nr.data })
        } catch (e) { const info = { message: e.message, status: e.response?.status, data: e.response?.data }; out.steps.push({ note: 'create_note', error: info }); out.errors.push({ step: 'create_note', error: info }) }
      } catch (e) { out.steps.push({ note: 'create_note', error: e.message }); out.errors.push({ step: 'create_note', error: e.message }) }
      await sleep(3000)

      // 8) Create Task and associate to Company owner (if owner found earlier)
      const taskBody = { engagement: { active: true, type: 'TASK', timestamp: Date.now() }, associations: {}, metadata: { body: 'Test task' } }
      if (companyOwnerId) taskBody.associations.ownerIds = [companyOwnerId]
      try {
        try {
          const tr = await client.post(buildPath('engagements.create'), taskBody)
          out.steps.push({ note: 'create_task', status: tr.status, body: tr.data })
        } catch (e) { const info = { message: e.message, status: e.response?.status, data: e.response?.data }; out.steps.push({ note: 'create_task', error: info }); out.errors.push({ step: 'create_task', error: info }) }
      } catch (e) { out.steps.push({ note: 'create_task', error: e.message }); out.errors.push({ step: 'create_task', error: e.message }) }
    } catch (inner) {
      out.errors.push({ step: 'sequence_failed', error: inner.message || String(inner) })
    }

    out.ok = out.errors.length === 0
    return res.json(out)
  } catch (e) {
    out.errors.push({ step: 'handler_failed', error: e.message })
    return res.status(500).json(out)
  }
})

// Health endpoint: reports Redis configuration state and progress capability
app.get('/api/health', async (req, res) => {
  const redisHost = process.env.REDIS_HOST
  const redisPort = process.env.REDIS_PORT
  const progressEnabled = process.env.REDIS_PROGRESS === '1'
  let rate = {}
  let qDepth = null
  let dlqDepth = null
  let pendingSegments = null
  let dlqCountsAggregate = null
  if (progressEnabled) {
    try {
      const r = await getRedis()
      if (r) {
        const [cool, trip, contactB, noteB, callB, taskB, ticketB] = await Promise.all([
          r.get('ratelimit:hubspot:cooldown_until'),
          r.get('circuit:hubspot:tripped_until'),
          r.get('ratelimit:bucket:contact'),
          r.get('ratelimit:bucket:note'),
          r.get('ratelimit:bucket:call'),
          r.get('ratelimit:bucket:task'),
          r.get('ratelimit:bucket:ticket')
        ])
        rate = {
          hubspotCooldownActive: cool ? Date.now() < parseInt(cool,10) : false,
          hubspotCircuitTripped: trip ? Date.now() < parseInt(trip,10) : false,
          buckets: {
            contact: contactB != null ? parseInt(contactB,10) : null,
            note: noteB != null ? parseInt(noteB,10) : null,
            call: callB != null ? parseInt(callB,10) : null,
            task: taskB != null ? parseInt(taskB,10) : null,
            ticket: ticketB != null ? parseInt(ticketB,10) : null,
          }
        }
        try {
          // Primary queue depth (single shard for now) using BullMQ internal keys pattern
          const primaryWait = await r.zCard('bull:simulation-jobs-0:waiting')
          const primaryDelayed = await r.zCard('bull:simulation-jobs-0:delayed')
          const primaryActive = await r.sCard('bull:simulation-jobs-0:active')
          qDepth = { waiting: primaryWait, delayed: primaryDelayed, active: primaryActive }
        } catch {}
        try {
          dlqDepth = await r.zCard('bull:simulation-dlq:waiting')
        } catch {}
        // Optional simulationId param for segment + dlq counts snapshot focusing a single simulation
        const simId = req.query.simulationId
        if (simId) {
          try {
            pendingSegments = await r.zCard(`sim:${simId}:segments`)
          } catch {}
          try {
            const h = await r.hGetAll(`sim:${simId}:dlq:counts`)
            dlqCountsAggregate = h || {}
          } catch {}
        }
      }
    } catch (e) {
      rate.error = e.message
    }
  }
  // AI generation health status
  const aiGenerator = require('./aiDataGenerator')
  const aiHealth = aiGenerator.getHealthStatus()

  // We don't open a connection here (worker/orchestrator handle that); just reflect env presence.
  // Frontend can interpret redisConfigured=true && progressEnabled for advanced polling strategy.
  res.json({
    ok: true,
    timestamp: Date.now(),
    redis: {
      configured: !!(redisHost && redisPort),
      host: redisHost || null,
      port: redisPort ? parseInt(redisPort, 10) : null,
      progressEnabled,
    },
    ai: aiHealth,
    rate,
    queues: qDepth ? { primary: qDepth, dlqWaiting: dlqDepth } : undefined,
    segments: pendingSegments != null ? { pending: pendingSegments } : undefined,
    dlqCounts: dlqCountsAggregate || undefined
  })
})

// DLQ reconciliation endpoint (Phase 4)
app.get('/api/simulations/:id/dlq', requireBoss, async (req,res) => {
  const simId = req.params.id
  try {
    const sim = await knex('simulations').where({ id: simId }).first()
    if (!sim) return res.status(404).json({ error: 'not_found' })
    const r = await getRedis()
    if (!r) return res.json({ simulationId: simId, counts: {}, samples: [], source: 'redis-disabled' })
    const countsKey = `sim:${simId}:dlq:counts`
    const listKey = `sim:${simId}:dlq:samples`
    let counts = {}
    try { counts = await r.hGetAll(countsKey) || {} } catch {}
    let samplesRaw = []
    try { samplesRaw = await r.lRange(listKey, 0, 24) } catch {}
    const samples = samplesRaw.map(s => { try { return JSON.parse(s) } catch { return null } }).filter(Boolean)
    res.json({ simulationId: simId, counts, samples, source: 'redis' })
  } catch (e) {
    res.status(500).json({ error: 'internal', message: e.message })
  }
})

// DLQ Replay Endpoint (Phase 5)
// Contract: POST /api/simulations/:id/dlq/replay
// Body: { jobIds?, categories?, limit?, dryRun?, maxPerCategory?, strategy? }
// Rate limiting: basic per-user (or IP) guard to avoid accidental rapid-fire replays.
// Window: 30s; Max: 5 calls (including dry runs). Exceed -> 429.
async function checkReplayRateLimit(req) {
  try {
    const r = await getRedis()
    const now = Date.now()
    const userKey = req.user?.id ? `user:${req.user.id}` : null
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
    const ident = userKey || `ip:${ip}`
    const key = `rl:replay:${ident}`
    const WINDOW_MS = 30_000
    const MAX_CALLS = 5
    if (r) {
      // Use Redis atomic incr with expiry
      const count = await r.incr(key)
      if (count === 1) {
        try { await r.pexpire(key, WINDOW_MS) } catch {}
      }
      if (count > MAX_CALLS) return { allowed: false, retryAfterMs: await r.pttl(key) }
      return { allowed: true }
    } else {
      // In-memory fallback (per process)
      if (!global.__replayRL) global.__replayRL = new Map()
      const m = global.__replayRL
      const rec = m.get(ident) || { ts: now, count: 0 }
      if ((now - rec.ts) > WINDOW_MS) { rec.ts = now; rec.count = 0 }
      rec.count++
      m.set(ident, rec)
      if (rec.count > MAX_CALLS) return { allowed: false, retryAfterMs: WINDOW_MS - (now - rec.ts) }
      return { allowed: true }
    }
  } catch {
    return { allowed: true }
  }
}
app.post('/api/simulations/:id/dlq/replay', requireBoss, async (req,res) => {
  const rl = await checkReplayRateLimit(req)
  if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retryAfterMs: rl.retryAfterMs })
  const simulationId = req.params.id
  const {
    jobIds = [],
    categories = [],
    limit: rawLimit,
    dryRun = true,
    maxPerCategory,
    strategy = 'oldest',
    useFullRetry = false
  } = req.body || {}
  const limit = Math.min(Math.max(parseInt(rawLimit || 25,10),1), 100)
  if (!Array.isArray(jobIds) || !Array.isArray(categories)) return res.status(400).json({ error: 'invalid_payload' })
  if (!jobIds.length && !categories.length) return res.status(400).json({ error: 'must_provide_selector' })
  if (!dryRun && limit > 50) return res.status(400).json({ error: 'limit_exceeds_non_dry_run_cap' })
  if (useFullRetry && dryRun) return res.status(400).json({ error: 'useFullRetry_not_applicable_dryRun' })
  try {
    const sim = await knex('simulations').where({ id: simulationId }).first()
    if (!sim) return res.status(404).json({ error: 'not_found' })
    // Pull DLQ jobs
    const dlqQueue = new Queue('simulation-dlq', { connection: await (async () => { const r = await getRedis(); return r ? { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT,10):6379 } : {} })() })
    // We consider only waiting jobs (they should all be waiting)
    const waiting = await dlqQueue.getWaiting(0, 1000)
    let candidates = waiting
      .filter(j => j?.data?.simulationId === simulationId)
    if (jobIds.length) {
      const jobSet = new Set(jobIds)
      candidates = candidates.filter(j => jobSet.has(String(j.id)))
    }
    if (categories.length) {
      const catSet = new Set(categories)
      candidates = candidates.filter(j => catSet.has(j.data?.category))
    }
  const totalCandidates = candidates.length
  // Dedupe setup (batch + recent)
  const r = await getRedis()
  const batchId = uuidv4()
  const batchSeenKey = r ? `sim:${simulationId}:dlq:replay:seen:${batchId}` : null
  const recentKey = r ? `sim:${simulationId}:dlq:replayed_recent` : null
  const chosenOriginalIds = new Set()
    // Sort per strategy
    if (strategy === 'oldest') {
      candidates.sort((a,b) => (a.data.failedAt||a.timestamp) - (b.data.failedAt||b.timestamp))
    } else if (strategy === 'newest') {
      candidates.sort((a,b) => (b.data.failedAt||b.timestamp) - (a.data.failedAt||a.timestamp))
    } else if (strategy === 'random') {
      for (let i=candidates.length-1;i>0;i--) { const k = Math.floor(Math.random()*(i+1)); [candidates[i], candidates[k]] = [candidates[k], candidates[i]] }
    }
    // Fair share cap
    let byCategory = {}
    for (const c of candidates) {
      const cat = c.data?.category || 'unknown'
      byCategory[cat] = (byCategory[cat]||0)+1
    }
    if (maxPerCategory && parseInt(maxPerCategory,10) > 0) {
      const m = parseInt(maxPerCategory,10)
      const reduced = []
      const catCounts = {}
      for (const j of candidates) {
        const cat = j.data?.category || 'unknown'
        catCounts[cat] = (catCounts[cat]||0)
        if (catCounts[cat] < m) {
          reduced.push(j)
          catCounts[cat]++
        }
      }
      candidates = reduced
    }
    // Trim to limit
    let chosen = candidates.slice(0, limit)
    let skippedDuplicate = []
    let alreadyRecent = []
    if (r) {
      const filtered = []
      for (const j of chosen) {
        const origId = String(j.id)
        // Batch dedupe
        let isDup = false
        if (batchSeenKey) {
          try {
            const added = await r.sAdd(batchSeenKey, origId)
            if (added === 0) isDup = true
          } catch {}
        }
        if (isDup) { skippedDuplicate.push(origId); continue }
        // Recent dedupe
        let isRecent = false
        if (recentKey) {
          try {
            const member = await r.sIsMember(recentKey, origId)
            if (member) isRecent = true
          } catch {}
        }
        if (isRecent) { alreadyRecent.push(origId); continue }
        filtered.push(j)
      }
      chosen = filtered
      // TTL for batch & add all chosen to recent set
      try { if (batchSeenKey) await r.expire(batchSeenKey, 300) } catch {}
      if (recentKey && chosen.length) {
        try { await r.sAdd(recentKey, ...chosen.map(j => String(j.id))) } catch {}
        try { await r.expire(recentKey, 600) } catch {}
      }
    }
    const selectionCatDist = {}
    for (const j of chosen) selectionCatDist[j.data?.category || 'unknown'] = (selectionCatDist[j.data?.category || 'unknown']||0)+1
    let replayed = 0
    const newJobIds = []
    if (!dryRun) {
      for (const j of chosen) {
        const origQ = j.data?.originalQueue
        if (!['primary','secondary','simulation-jobs-0','secondary'].includes(origQ)) continue
        let destQueueName
        if (origQ === 'primary' || origQ === 'simulation-jobs-0') {
          destQueueName = 'simulation-jobs-0' // current single shard
        } else if (origQ === 'secondary') {
          destQueueName = 'simulation-secondary'
        } else continue
        const destQ = new Queue(destQueueName, { connection: dlqQueue.client?.options || dlqQueue.opts?.connection })
        const payload = { ...j.data?.data }
        delete payload.failedAt
        try {
          const type = payload?.phase === 'secondary_activity' ? (payload.type || 'secondary') : 'contact'
          let opts = { attempts: 1 }
            if (useFullRetry) {
              const retryOpts = buildBullOptions(type)
              // buildBullOptions may return {} if attempts <=1; we still want at least attempts=1
              opts = { ...opts, ...retryOpts }
            }
          const added = await destQ.add(j.name || 'replayed', payload, opts)
          newJobIds.push(added.id)
          replayed++
          await destQ.close()
        } catch (e) { /* swallow individual failure */ }
      }
    }
    // Audit logging
    try {
      const auditId = uuidv4()
      await knex('dlq_replay_audit').insert({
        id: auditId,
        user_id: req.user?.id || 'unknown',
        simulation_id: simulationId,
        dry_run: !!dryRun,
        total_candidates: totalCandidates,
        selected_count: chosen.length,
        replayed_count: replayed,
        filters_json: JSON.stringify({ jobIds, categories, limit, dryRun, maxPerCategory, strategy, useFullRetry }),
        created_at: Date.now()
      })
    } catch {}
    try { logInfo({ eventId: EVENTS.DLQ_REPLAY, msg: 'dlq replay', simulationId, dryRun, useFullRetry, selection: { totalCandidates, chosen: chosen.length, byCategory: selectionCatDist }, replayed }) } catch {}
    res.json({ ok: true, dryRun: !!dryRun, useFullRetry: !!useFullRetry, selection: { totalCandidates, chosen: chosen.length, byCategory: selectionCatDist }, replayed, newJobIds, skippedDuplicate, alreadyRecent, batchId })
  } catch (e) {
    res.status(500).json({ error: 'internal', message: e.message })
  }
})

// DLQ aggregate summary (boss-only): returns counts for all simulations (from Redis pattern scan)
app.get('/api/dlq/summary', requireBoss, async (req,res) => {
  try {
    const r = await getRedis()
    if (!r) return res.json({ ok:true, source:'redis-disabled', simulations: [] })
    // Planned pagination / filtering parameters
    const { cursor: cursorParam, limit: limitParam, simIdContains, category } = req.query
    const limit = Math.min(Math.max(parseInt(limitParam || '200',10), 1), 500)
    let cursor = cursorParam ? parseInt(cursorParam,10) : 0
    const pattern = 'sim:*:dlq:counts'
    const sims = {}
    let scanned = 0
    do {
      const reply = await r.scan(cursor, { MATCH: pattern, COUNT: 200 })
      cursor = parseInt(reply.cursor,10)
      for (const key of reply.keys) {
        const simId = key.split(':')[1]
        if (simIdContains && !simId.includes(simIdContains)) continue
        if (!sims[simId]) sims[simId] = { simulationId: simId, counts: {} }
        try {
          const h = await r.hGetAll(key)
          if (category && !Object.prototype.hasOwnProperty.call(h, category)) continue
          sims[simId].counts = h || {}
        } catch {}
        scanned++
        if (scanned >= limit) break
      }
      if (scanned >= limit) break
    } while (cursor !== 0)
    // Next cursor semantics: if cursor returned 0 we are done; else return that cursor
    const out = Object.values(sims)
    res.json({ ok:true, source:'redis', simulations: out, nextCursor: cursor === 0 ? null : cursor })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Thinning events endpoint (boss-only)
app.get('/api/simulations/:id/thinning-events', requireBoss, async (req,res) => {
  const id = req.params.id
  try {
    const sim = await knex('simulations').where({ id }).first()
    if (!sim) return res.status(404).json({ ok:false, error:'not_found' })
    const r = await getRedis()
    if (!r) return res.json({ ok:true, simulationId: id, events: [], source:'redis-disabled' })
    const listKey = `sim:${id}:thinning:events`
    let raw = []
    try { raw = await r.lRange(listKey, 0, 99) } catch {}
    const events = raw.map(s => { try { return JSON.parse(s) } catch { return null } }).filter(Boolean)
    res.json({ ok:true, simulationId: id, events, source:'redis' })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Enhanced metrics endpoint with fallback (Phase 4)
app.get('/api/simulations/:id/metrics2', async (req,res) => {
  const id = req.params.id
  try {
    const sim = await knex('simulations').where({ id }).first()
    if (!sim) return res.status(404).json({ error: 'not_found' })
    const r = await getRedis()
    let source = 'redis'
    let out = {}
    if (r) {
      try {
        const key = `sim:${id}:metrics`
        const metrics = await r.hGetAll(key)
        for (const [k,v] of Object.entries(metrics || {})) {
          const n = parseInt(v,10); if (!isNaN(n)) out[k] = n
        }
      } catch (e) {
        source = 'redis-error'
      }
    } else {
      source = 'redis-disabled'
    }
    if (!Object.keys(out).length) {
      out.records_created = sim.records_processed
      source = source.startsWith('redis') ? (source + '+db-fallback') : 'db-only'
    } else {
      if (out.records_created == null) out.records_created = sim.records_processed
    }
    res.json({ simulationId: id, ...out, source })
  } catch (e) {
    res.status(500).json({ error: 'internal', message: e.message })
  }
})

app.post('/api/create-contact-company', async (req, res) => {
  try {
    const { contactProps = {}, companyProps = {} } = req.body
    const result = await orchestrator.createContactWithCompany({ contactProps, companyProps })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data || null })
  }
})

app.post('/api/create-deal', async (req, res) => {
  try {
    const { contactId, companyId, dealProps } = req.body
    const result = await orchestrator.createDealForContact({ contactId, companyId, dealProps })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data || null })
  }
})

app.post('/api/create-note', async (req, res) => {
  try {
    const { noteProps, contactId, companyId, dealId, ticketId } = req.body
    const result = await orchestrator.createNoteWithAssociations({ noteProps, contactId, companyId, dealId, ticketId })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data || null })
  }
})

app.post('/api/create-call', async (req, res) => {
  try {
    const { callProps, contactId } = req.body
    const result = await orchestrator.createCallForContact({ callProps, contactId })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data || null })
  }
})

app.post('/api/create-task', async (req, res) => {
  try {
    const { taskProps, contactId } = req.body
    const result = await orchestrator.createTaskForContact({ taskProps, contactId })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data || null })
  }
})

// ---- Simulation APIs ----
const knexConfig = require('../knexfile')
const Knex = require('knex')
const knex = Knex(knexConfig.development || knexConfig)

// Lazy Redis client for metrics (read-only path) if env enables progress
let metricsRedis = null
async function getRedis() {
  if (metricsRedis) return metricsRedis
  if (process.env.REDIS_PROGRESS !== '1') return null
  const { createClient } = require('redis')
  const opts = process.env.REDIS_URL ? { url: process.env.REDIS_URL } : {
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT,10) : 6379,
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB,10) : undefined,
  }
  metricsRedis = createClient(opts)
  metricsRedis.on('error', e => console.warn('Metrics redis error:', e.message))
  try { await metricsRedis.connect() } catch (e) { console.warn('Metrics redis connect failed:', e.message) }
  return metricsRedis
}

app.post('/api/simulations', async (req, res) => {
  try {
    const { userId, scenario, distributionMethod, totalRecords, startTime, endTime, hubspot, uiConfig } = req.body || {}
    if (!userId) return res.status(400).json({ ok:false, error:'userId required' })
    const scenarioLc = (scenario||'').toLowerCase()
    const allowedScenarios = ['b2b','b2c']
    if (!allowedScenarios.includes(scenarioLc)) return res.status(400).json({ ok:false, error:'scenario invalid (b2b|b2c)' })
    if (!distributionMethod) return res.status(400).json({ ok:false, error:'distributionMethod required' })
    let total = parseInt(totalRecords,10)
    if (isNaN(total) || total <= 0) return res.status(400).json({ ok:false, error:'totalRecords > 0 required' })
    const MAX_RECORDS = 50_000
    if (total > MAX_RECORDS) total = MAX_RECORDS
    const now = Date.now()
    const start = startTime ? parseInt(startTime,10) : now
    const end = endTime ? parseInt(endTime,10) : (start + 60*60*1000)
    if (isNaN(start) || isNaN(end)) return res.status(400).json({ ok:false, error:'startTime/endTime invalid' })
    if (end <= start) return res.status(400).json({ ok:false, error:'endTime must be greater than startTime' })
    const MAX_HORIZON_MS = 1000*60*60*24*7 // 7 days
    if ((end - start) > MAX_HORIZON_MS) return res.status(400).json({ ok:false, error:'simulation horizon exceeds 7 days' })
    const methodSanitized = String(distributionMethod).toLowerCase()
    const allowedMethods = ['linear','bell_curve','front_loaded','back_loaded','surge_mid']
    if (!allowedMethods.includes(methodSanitized)) return res.status(400).json({ ok:false, error:'distributionMethod invalid' })
    // Compute overrides hash (stable JSON string hash) if provided in uiConfig.overrides
    let overridesHash = null
    if (uiConfig?.overrides) {
      try {
        const json = JSON.stringify(uiConfig.overrides)
        // Simple FNV-1a 32-bit hash
        let h = 0x811c9dc5
        for (let i=0;i<json.length;i++) {
          h ^= json.charCodeAt(i)
          h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
        }
        overridesHash = h.toString(16)
      } catch {}
    }
    const sim = {
      id: uuidv4(),
      user_id: userId,
      status: 'QUEUED',
      scenario: scenarioLc,
      distribution_method: methodSanitized,
      total_records: total,
      records_processed: 0,
      start_time: start,
      end_time: end,
      created_at: now,
      updated_at: now,
      config_json: uiConfig ? JSON.stringify(uiConfig) : null,
      overrides_hash: overridesHash,
      override_version: uiConfig?.overrideVersion || 0,
    }
    if (hubspot?.pipelineId) sim.hubspot_pipeline_id = String(hubspot.pipelineId)
    if (Array.isArray(hubspot?.ownerIds) && hubspot.ownerIds.length) sim.hubspot_owner_ids = JSON.stringify(hubspot.ownerIds.map(String))
    await knex('simulations').insert(sim)
    res.json({ ok: true, simulation: sim })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Preview endpoint: compute derived values for summary modal without inserting simulation
// Body: { scenario, distributionMethod, totalRecords, startTime, endTime }
app.post('/api/simulations/preview', async (req,res) => {
  try {
    const { scenario, distributionMethod, totalRecords, startTime, endTime } = req.body || {}
    const scenarioLc = (scenario||'').toLowerCase()
    const allowedScenarios = ['b2b','b2c']
    if (!allowedScenarios.includes(scenarioLc)) return res.status(400).json({ ok:false, error:'scenario invalid (b2b|b2c)' })
    if (!distributionMethod) return res.status(400).json({ ok:false, error:'distributionMethod required' })
    let total = parseInt(totalRecords,10)
    if (isNaN(total) || total <= 0) return res.status(400).json({ ok:false, error:'totalRecords > 0 required' })
    const methodSanitized = String(distributionMethod).toLowerCase()
    const allowedMethods = ['linear','bell_curve','front_loaded','back_loaded','surge_mid']
    if (!allowedMethods.includes(methodSanitized)) return res.status(400).json({ ok:false, error:'distributionMethod invalid' })
    const now = Date.now()
    const start = startTime ? parseInt(startTime,10) : now
    const end = endTime ? parseInt(endTime,10) : (start + 60*60*1000)
    if (isNaN(start) || isNaN(end)) return res.status(400).json({ ok:false, error:'startTime/endTime invalid' })
    if (end <= start) return res.status(400).json({ ok:false, error:'endTime must be greater than startTime' })
    // Scenario params + effective total (pre-multiplier logic)
    const { getScenarioParameters } = require('./scenarioParameters')
    const merged = getMergedScenario(scenarioLc) || getScenarioParameters(scenarioLc)
    let effectiveTotal = total
    if (merged?.leadVolumeMultiplier) {
      effectiveTotal = Math.max(1, Math.round(effectiveTotal * merged.leadVolumeMultiplier))
    }
    // Build distribution timestamps (only counts needed)
    const timestamps = expandDistribution(methodSanitized, effectiveTotal, start, end)
    // First segment (mirrors orchestrator 1h segmentation)
    const SEGMENT_HOURS = 1
    const firstSegEnd = start + SEGMENT_HOURS * 60 * 60 * 1000
    let firstSegmentCount = 0
    for (const ts of timestamps) {
      if (ts < firstSegEnd) firstSegmentCount++
      else break
    }
    // Version info (runtime overrides)
    const vInfo = getOverrideVersionInfo(scenarioLc)
    res.json({ ok:true, scenario: scenarioLc, distributionMethod: methodSanitized, requestedTotal: total, effectiveTotal, start, end, firstSegmentCount, overrideVersion: vInfo.version, overridesHash: vInfo.hash, scenarioParams: merged ? {
      avgSalesCycleDays: merged.avgSalesCycleDays,
      dealWinRateBase: merged.dealWinRateBase,
      contactToCompanyRatio: merged.contactToCompanyRatio,
      interactions: merged.interactions ? {
        probabilities: merged.interactions.probabilities,
        perRecordCaps: merged.interactions.perRecordCaps,
        globalBudgets: merged.interactions.globalBudgets,
      } : null,
    } : null })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

app.post('/api/simulations/:id/start', async (req, res) => {
  try {
    const { id } = req.params
    // Defensive: ensure simulation exists and not modifying snapshot post-start
    const sim = await knex('simulations').where({ id }).first()
    if (!sim) return res.status(404).json({ ok:false, error:'not found' })
    if (sim.status !== 'QUEUED' && sim.status !== 'RUNNING') {
      return res.status(400).json({ ok:false, error:'invalid status for start' })
    }
    // If already running just return scheduled=0 alreadyRunning
    if (sim.status === 'RUNNING') {
      return res.json({ ok:true, scheduled: 0, alreadyRunning: true })
    }
    // Snapshot immutability is implicit (we never update config fields after insert)
    const out = await orchestrator.startSimulation(id)
    res.json({ ok: true, ...out })
  } catch (e) {
    res.status(400).json({ ok:false, error: e.message })
  }
})

// Abort simulation: soft stop (prevents new segments). Existing queued jobs continue.
app.post('/api/simulations/:id/abort', async (req,res) => {
  try {
    const { id } = req.params
    const { force = false } = req.body || {}
    const sim = await knex('simulations').where({ id }).first()
    if (!sim) return res.status(404).json({ ok:false, error:'not found' })
    if (!['QUEUED','RUNNING'].includes(sim.status)) return res.status(400).json({ ok:false, error:'invalid_state' })
  await knex('simulations').where({ id }).update({ status: 'ABORTED', finished_at: Date.now(), updated_at: Date.now() })
    const r = await getRedis()
    if (r) {
      try { await r.set(`sim:${id}:aborted`, '1', { EX: 6 * 60 * 60 }) } catch {}
    }
    let purged = { primary:0, secondary:0, dlq:0 }
    if (force) {
      // Attempt queue clean/removal scoped to this simulation's jobs
      const { Queue } = require('bullmq')
      const conn = r ? { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT,10):6379 } : {}
      async function purgeQueue(qName) {
        const q = new Queue(qName, { connection: conn })
        try {
          const waiting = await q.getWaiting(0, 500)
          const delayed = await q.getDelayed(0, 500)
          const target = waiting.concat(delayed).filter(j => j?.data?.simulationId === id)
          for (const j of target) { try { await q.remove(j.id) } catch {} }
          return target.length
        } finally { try { await q.close() } catch {} }
      }
  try { purged.primary += await purgeQueue('simulation-jobs-0') } catch {}
      try { purged.secondary += await purgeQueue('simulation-secondary') } catch {}
      try { purged.dlq += await purgeQueue('simulation-dlq') } catch {}
    }
  try { logInfo({ eventId: force ? EVENTS.ABORT_FORCE : EVENTS.ABORT_SOFT, msg: 'simulation aborted', simulationId: id, force, purged }) } catch {}
  res.json({ ok:true, status: 'ABORTED', force, purged })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

app.get('/api/simulations', async (req, res) => {
  try {
    const userId = req.query.userId
    if (!userId) return res.status(400).json({ ok:false, error: 'userId required' })
    const rows = await knex('simulations').where({ user_id: userId }).orderBy('created_at', 'desc').limit(50)
    res.json({ ok: true, simulations: rows })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

app.get('/api/simulations/:id', async (req, res) => {
  try {
    const { id } = req.params
    const row = await knex('simulations').where({ id }).first()
    if (!row) return res.status(404).json({ ok:false, error: 'not found' })
    res.json({ ok: true, simulation: row })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Upsert user simulation profile (stores last UI selections)
app.post('/api/user/simulation-profile', async (req,res) => {
  try {
    if (!req.user) return res.status(401).json({ ok:false, error:'auth required' })
    const { scenarioId, distributionId, themeId, hubspotKeyId, overridesHash, overrideVersion, config } = req.body || {}
    const now = Date.now()
    const row = {
      user_id: req.user.id,
      scenario_id: scenarioId || null,
      distribution_id: distributionId || null,
      theme_id: themeId || null,
      hubspot_key_id: hubspotKeyId || null,
      overrides_hash: overridesHash || null,
      override_version: overrideVersion || 0,
      last_config_json: config ? JSON.stringify(config) : null,
      updated_at: now
    }
    // Try update, if zero rows then insert
    const updated = await knex('user_simulation_profiles').where({ user_id: req.user.id }).update(row)
    if (!updated) await knex('user_simulation_profiles').insert(row)
    res.json({ ok:true })
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message })
  }
})

// Metrics endpoint: aggregates Redis hash + DB row fallback
app.get('/api/simulations/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params
    const sim = await knex('simulations').where({ id }).first()
    if (!sim) return res.status(404).json({ ok:false, error:'not found' })
    const r = await getRedis()
    let metrics = {}
    if (r) {
      try { metrics = await r.hGetAll(`sim:${id}:metrics`) || {} } catch {}
    }
    // Normalize numeric
    const numMetrics = {}
    for (const [k,v] of Object.entries(metrics)) {
      const n = parseInt(v,10)
      if (!isNaN(n)) numMetrics[k] = n
    }
    // Always include records_processed (DB source of truth) & total_records
    numMetrics.records_processed = sim.records_processed
    numMetrics.total_records = sim.total_records
    const percentComplete = sim.total_records > 0 ? sim.records_processed / sim.total_records : 0
    // Derive averages
    if (numMetrics.contact_latency_total_ms && numMetrics.contact_latency_count) {
      numMetrics.avg_contact_latency_ms = Math.round(numMetrics.contact_latency_total_ms / Math.max(1, numMetrics.contact_latency_count))
    }
    // Ensure rate limit telemetry defaults (explicit zeros help UI rendering)
    const rlDefaults = ['rate_limit_hits','rate_limit_total_delay_ms','rate_limit_scheduled_delay_ms','retries_total']
    for (const k of rlDefaults) if (numMetrics[k] == null) numMetrics[k] = 0

    // AI generation metrics (Phase: AI Integration)
    const aiSuccess = numMetrics.ai_generation_success || 0
    const aiFallback = numMetrics.ai_generation_fallback || 0
    const aiTotal = aiSuccess + aiFallback
    const aiGeneration = {
      successCount: aiSuccess,
      fallbackCount: aiFallback,
      totalCount: aiTotal,
      successRate: aiTotal > 0 ? (aiSuccess / aiTotal).toFixed(3) : null,
      avgLatencyMs: numMetrics.ai_generation_total_latency_ms && aiSuccess > 0
        ? Math.round(numMetrics.ai_generation_total_latency_ms / aiSuccess)
        : null,
      totalTokens: numMetrics.ai_generation_total_tokens || 0,
      estimatedCost: numMetrics.ai_generation_total_tokens
        ? '$' + ((numMetrics.ai_generation_total_tokens / 1000000) * 0.80).toFixed(4) // Haiku pricing: $0.80 per MTok
        : null,
      lastErrorCategory: metrics.ai_last_error_category || null
    }

    res.json({
      ok: true,
      simulationId: id,
      metrics: numMetrics,
      aiGeneration,
      percentComplete,
      status: sim.status,
      finished_at: sim.finished_at || null
    })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Aggregated metrics summary for all (recent) simulations (boss-only for now)
app.get('/api/metrics/summary', requireBoss, async (req,res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50',10),1),200)
    const sims = await knex('simulations').orderBy('created_at','desc').limit(limit)
    const r = await getRedis()
    const out = []
    for (const s of sims) {
      let metrics = {}
      if (r) {
        try { metrics = await r.hGetAll(`sim:${s.id}:metrics`) || {} } catch {}
      }
      const num = {}
      for (const [k,v] of Object.entries(metrics)) { const n = parseInt(v,10); if (!isNaN(n)) num[k]=n }
      num.records_processed = s.records_processed
      num.total_records = s.total_records
      if (num.contact_latency_total_ms && num.contact_latency_count) {
        num.avg_contact_latency_ms = Math.round(num.contact_latency_total_ms / Math.max(1, num.contact_latency_count))
      }
      const rlDefaults = ['rate_limit_hits','rate_limit_total_delay_ms','rate_limit_scheduled_delay_ms','retries_total']
      for (const k of rlDefaults) if (num[k] == null) num[k] = 0
      out.push({ simulationId: s.id, status: s.status, percentComplete: s.total_records>0 ? s.records_processed / s.total_records : 0, finished_at: s.finished_at || null, metrics: num })
    }
    res.json({ ok:true, simulations: out })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Segment status endpoint
app.get('/api/simulations/:id/segments', async (req, res) => {
  try {
    const { id } = req.params
    const sim = await knex('simulations').where({ id }).first()
    if (!sim) return res.status(404).json({ ok:false, error:'not found' })
    const r = await getRedis()
    if (!r) return res.json({ ok:true, simulationId: id, segments: [] })
    const zkey = `sim:${id}:segments`
    let segIds = []
    try { segIds = await r.zRange(zkey, 0, -1) } catch {}
    const segments = []
    for (const segId of segIds) {
      try {
        const h = await r.hGetAll(`sim:${id}:${segId}`)
        if (h && Object.keys(h).length) {
          const expanded = !!(await r.get(`sim:${id}:${segId}:expanded`))
          segments.push({
            id: segId,
            start: h.start ? parseInt(h.start,10) : null,
            end: h.end ? parseInt(h.end,10) : null,
            firstIndex: h.firstIdx ? (parseInt(h.firstIdx,10)+1) : null,
            lastIndex: h.lastIdx ? (parseInt(h.lastIdx,10)+1) : null,
            expanded
          })
        }
      } catch {}
    }
    res.json({ ok:true, simulationId: id, segments })
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Real-time SSE endpoint for simulation progress
app.get('/api/simulations/:id/stream', async (req,res) => {
  const { id } = req.params
  try {
    const sim = await knex('simulations').where({ id }).first()
    if (!sim) return res.status(404).json({ ok:false, error:'not found' })
  } catch (e) { return res.status(500).json({ ok:false, error: e.message }) }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  let closed = false
  req.on('close', () => { closed = true; clearInterval(interval) })
  const r = await getRedis()
  async function snapshot() {
    const sim = await knex('simulations').where({ id }).first()
    if (!sim) return null
    let metrics = {}
    if (r) {
      try { metrics = await r.hGetAll(`sim:${id}:metrics`) || {} } catch {}
    }
    const numeric = {}
    for (const [k,v] of Object.entries(metrics)) { const n = parseInt(v,10); if (!isNaN(n)) numeric[k]=n }
    numeric.records_processed = sim.records_processed
    numeric.total_records = sim.total_records
    const percentComplete = sim.total_records > 0 ? sim.records_processed / sim.total_records : 0
    if (numeric.contact_latency_total_ms && numeric.contact_latency_count) {
      numeric.avg_contact_latency_ms = Math.round(numeric.contact_latency_total_ms / Math.max(1, numeric.contact_latency_count))
    }
    let rlEvents = []
    if (r) {
      try {
        const listKey = `sim:${id}:ratelimit:events`
        const raw = await r.lRange(listKey, 0, 24)
        rlEvents = raw.map(s => { try { return JSON.parse(s) } catch { return null } }).filter(Boolean)
      } catch {}
    }
    return { status: sim.status, finished_at: sim.finished_at || null, percentComplete, metrics: numeric, rateLimitRecent: rlEvents }
  }
  function sendEvt(event, dataObj) {
    if (closed) return
    try {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(dataObj)}\n\n`)
    } catch {}
  }
  // Initial snapshot
  try {
    const snap = await snapshot()
    if (snap) sendEvt('snapshot', snap)
  } catch {}
  let lastHash = null
  const interval = setInterval(async () => {
    if (closed) return
    try {
      const snap = await snapshot()
      if (!snap) return
      const h = JSON.stringify(snap)
      if (h !== lastHash) {
        lastHash = h
        sendEvt('metrics', snap)
        if (snap.status === 'COMPLETED' || snap.status === 'FAILED' || snap.status === 'ABORTED') {
          sendEvt('terminal', { status: snap.status })
          clearInterval(interval)
        }
      }
    } catch {}
  }, 2000)
})

// HubSpot API key management (user scoping placeholder: using playerName or provided userId from body)
app.get('/api/hubspot/keys', async (req, res) => {
  try {
    const userId = req.query.userId
    const saas = req.query.saas || 'hubspot'
    if (!userId) return res.status(400).json({ ok:false, error: 'userId required' })
    const keys = await listKeys(userId, { saas })
    res.json({ ok: true, keys })
  } catch (e) {
    const msg = e.message.includes('TOKEN_ENC_SECRET') ? 'Server missing TOKEN_ENC_SECRET; cannot decrypt tokens.' : e.message
    res.status(500).json({ ok: false, error: msg })
  }
})

app.post('/api/hubspot/keys', async (req, res) => {
  try {
    const { userId, label, token, saas = 'hubspot' } = req.body || {}
    if (!userId) return res.status(400).json({ ok:false, error: 'userId required' })
    if (!label || !token) return res.status(400).json({ ok:false, error: 'label and token required' })
    const key = await createKey({ userId, label, token, saas })
    res.json({ ok: true, key })
  } catch (e) {
    const msg = e.message.includes('TOKEN_ENC_SECRET') ? 'Server missing TOKEN_ENC_SECRET; cannot encrypt token.' : e.message
    res.status(500).json({ ok: false, error: msg })
  }
})

app.delete('/api/hubspot/keys/:id', async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.query.userId
    if (!userId) return res.status(400).json({ ok:false, error: 'userId required' })
    await deleteKey({ userId, id })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.post('/api/hubspot/validate', async (req, res) => {
  try {
    const { userId, keyId } = req.body || {}
    if (!userId) return res.status(400).json({ ok:false, error: 'userId required' })
    if (!keyId) return res.status(400).json({ ok:false, error: 'keyId required' })
    const token = await getDecryptedToken({ userId, id: keyId })
    if (!token) return res.status(404).json({ ok:false, error: 'Key not found' })
    const { requireHubSpotClient } = require('./requireHubSpotClient')
    const { buildPath } = require('./tools/hubspot/apiRegistry')
    const client = requireHubSpotClient(token)
    try {
      // Use validate probe endpoint (limit applied via params)
      const resp = await client.get(buildPath('crm.contacts.validateProbe'), { limit: 1, properties: 'firstname' })
      if (resp.status >= 200 && resp.status < 300) {
        if (pool) {
          try { await pool.query('UPDATE users SET hubspot_active_key_id = ?, hubspot_connected_at = ? WHERE id = ? LIMIT 1', [keyId, Date.now(), userId]) } catch (e) { console.warn('Failed to update user hubspot columns:', e.message) }
        }
        return res.json({ ok: true })
      }
      return res.status(400).json({ ok:false, error: 'Unexpected status from HubSpot: ' + resp.status })
    } catch (apiErr) {
      const status = apiErr.response?.status
      if (status === 401 || status === 403) return res.status(401).json({ ok:false, error: 'HubSpot token unauthorized (401/403). Check scopes.' })
      return res.status(400).json({ ok:false, error: 'Validation request failed: ' + (apiErr.message || 'unknown error') })
    }
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message })
  }
})

// Fetch HubSpot owners (multi-select support for simulation assignment)
app.get('/api/hubspot/owners', async (req, res) => {
  try {
    const { userId, keyId } = req.query || {}
    if (!userId) return res.status(400).json({ ok:false, error:'userId required' })
    if (!keyId) return res.status(400).json({ ok:false, error:'keyId required' })
    const token = await getDecryptedToken({ userId, id: keyId })
    if (!token) return res.status(404).json({ ok:false, error:'key not found' })
    const { requireHubSpotClient } = require('./requireHubSpotClient')
    const { buildPath } = require('./tools/hubspot/apiRegistry')
    const client = requireHubSpotClient(token)
    const owners = []
    let after = undefined
    let pageCount = 0
    do {
      const params = { limit: 100, archived: false }
      if (after) params.after = after
      const resp = await client.get(buildPath('crm.owners.list'), params)
      if (Array.isArray(resp.data?.results)) owners.push(...resp.data.results)
      after = resp.data?.paging?.next?.after
      pageCount++
      if (pageCount > 20) break // safety guard
    } while (after)
    const mapped = owners.map(o => ({ id: o.id || o.ownerId || o.userId, email: o.email || o.userEmail, firstName: o.firstName, lastName: o.lastName }))
    res.json({ ok:true, owners: mapped })
  } catch (e) {
    const status = e.response?.status
    if (status === 401 || status === 403) return res.status(401).json({ ok:false, error:'unauthorized token (owners)' })
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Fetch HubSpot deal pipelines (root + stages) - only need pipeline root; we'll pick first stage automatically client-side
app.get('/api/hubspot/deal-pipelines', async (req, res) => {
  try {
    const { userId, keyId } = req.query || {}
    if (!userId) return res.status(400).json({ ok:false, error:'userId required' })
    if (!keyId) return res.status(400).json({ ok:false, error:'keyId required' })
    const token = await getDecryptedToken({ userId, id: keyId })
    if (!token) return res.status(404).json({ ok:false, error:'key not found' })
    const { requireHubSpotClient } = require('./requireHubSpotClient')
    const { buildPath } = require('./tools/hubspot/apiRegistry')
    const client = requireHubSpotClient(token)
  // Updated to use standardized registry key (crm.pipelines.deals.list)
  const resp = await client.get(buildPath('crm.pipelines.deals.list'))
    const pipelines = Array.isArray(resp.data?.results) ? resp.data.results : []
    const mapped = pipelines.map(p => ({ id: p.id, label: p.label, active: p.active, stages: (p.stages||[]).map(s => ({ id: s.id, label: s.label, displayOrder: s.displayOrder })) }))
    res.json({ ok:true, pipelines: mapped })
  } catch (e) {
    const status = e.response?.status
    if (status === 401 || status === 403) return res.status(401).json({ ok:false, error:'unauthorized token (pipelines)' })
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Fetch HubSpot users (Public Beta) - manual pull for now
app.get('/api/hubspot/users', async (req, res) => {
  try {
    const { userId, keyId } = req.query || {}
    if (!userId) return res.status(400).json({ ok:false, error:'userId required' })
    if (!keyId) return res.status(400).json({ ok:false, error:'keyId required' })
    const token = await getDecryptedToken({ userId, id: keyId })
    if (!token) return res.status(404).json({ ok:false, error:'key not found' })
    const { requireHubSpotClient } = require('./requireHubSpotClient')
    const { buildPath } = require('./tools/hubspot/apiRegistry')
    const client = requireHubSpotClient(token)
    const users = []
    let after = undefined
    let pageCount = 0
    do {
      const params = { limit: 100, archived: false }
      if (after) params.after = after
      const resp = await client.get(buildPath('crm.users.list'), params)
      if (Array.isArray(resp.data?.results)) users.push(...resp.data.results)
      after = resp.data?.paging?.next?.after
      pageCount++
      if (pageCount > 20) break
    } while (after)
    const mapped = users.map(u => ({ id: u.id || u.userId, email: u.email, firstName: u.firstName, lastName: u.lastName, roleId: u.roleId }))
    res.json({ ok:true, users: mapped })
  } catch (e) {
    const status = e.response?.status
    if (status === 401 || status === 403) return res.status(401).json({ ok:false, error:'unauthorized token (users)' })
    res.status(500).json({ ok:false, error: e.message })
  }
})

// Auth endpoints (migrated from dev-auth; now using unified users table)
try {
  const devAuth = require('./devAuthStore')
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { playerName, passcode, email, companyName } = req.body || {}
      const out = await devAuth.signup({ playerName, passcode, email, companyName })
      const token = issueToken(out)
      res.json({ ok: true, user: out, token })
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message })
    }
  })

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { identifier, passcode } = req.body || {}
      const out = await devAuth.login({ identifier, passcode })
      const token = issueToken(out.user || out)
      res.json({ ...out, token })
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message })
    }
  })

  // Admin endpoints: list/reset users (still convenience; protect in production)
  app.get('/api/auth/users', async (req, res) => {
    try {
      const rows = await devAuth.listUsers()
      res.json({ ok: true, users: rows })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  app.post('/api/auth/reset', async (req, res) => {
    try {
      await devAuth.resetUsers()
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })
} catch (e) {
  console.warn('Dev auth store not available:', e.message)
}

app.listen(PORT, () => console.log(`Server listening ${PORT}`))
