#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { createClient } = require('../server/hubspotClient')
const { buildPath } = require('../server/tools/hubspot/apiRegistry')

// If the process environment doesn't already have HUBSPOT_API_TOKEN (common when
// running the script directly), try to load the repo `.env` file as a fallback.
function loadDotEnvIfMissing() {
  const tokenKey = 'HUBSPOT_API_TOKEN'
  if (process.env[tokenKey]) return
  const envPath = path.resolve(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

loadDotEnvIfMissing()

async function main() {
  const token = process.env.HUBSPOT_API_TOKEN
  if (!token) {
    console.error(JSON.stringify({ ok: false, error: 'HUBSPOT_API_TOKEN not set in env' }))
    process.exit(2)
  }

  const client = createClient({})
  client.setToken(token)

  const targets = [
    { listKey: 'crm.pipelines.deals.list', stagesKey: 'crm.pipelines.deals.stages.list', name: 'deals' },
    { listKey: 'crm.pipelines.tickets.list', stagesKey: 'crm.pipelines.tickets.stages.list', name: 'tickets' },
  ]

  for (const t of targets) {
    try {
      const listPath = buildPath(t.listKey)
      const res = await client.get(listPath, { limit: 10 })
      console.log(JSON.stringify({ ok: true, type: t.name, listStatus: res.status, count: Array.isArray(res.data?.results) ? res.data.results.length : (res.data && res.data.results ? res.data.results.length : undefined) }))

      const pipelines = res.data && (res.data.results || res.data)
      if (Array.isArray(pipelines)) {
        for (const p of pipelines) {
          const pipelineId = p.id || p.pipelineId || p.pipeline || p.objectId || p.pipeline_id
          if (!pipelineId) {
            console.log(JSON.stringify({ ok: false, type: t.name, note: 'no-pipeline-id', pipeline: p }))
            continue
          }
          try {
            const stagesPath = buildPath(t.stagesKey, pipelineId)
            const sres = await client.get(stagesPath, { limit: 50 })
            const stages = sres.data && (sres.data.results || sres.data.stages || sres.data)
            const stageCount = Array.isArray(stages) ? stages.length : (stages && stages.length) || Object.keys(stages||{}).length || 0
            console.log(JSON.stringify({ ok: true, type: t.name, pipelineId, stagesStatus: sres.status, stageCount }))
          } catch (err) {
            console.log(JSON.stringify({ ok: false, type: t.name, pipelineId, error: err.message || String(err) }))
          }
        }
      } else {
        console.log(JSON.stringify({ ok: false, type: t.name, note: 'unexpected-list-shape', body: res.data }))
      }
    } catch (err) {
      console.log(JSON.stringify({ ok: false, type: t.name, error: err.message || String(err), stack: err.stack }))
    }
  }
}

if (require.main === module) {
  main().catch(e => { console.error(JSON.stringify({ ok: false, error: String(e), stack: e.stack })) ; process.exit(1) })
}
