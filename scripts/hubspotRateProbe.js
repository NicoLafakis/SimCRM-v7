#!/usr/bin/env node
/*
  HubSpot Rate Limit Calibration Script
  -------------------------------------
  Purpose: Probe selected HubSpot CRM endpoints at controlled concurrency and capture
  rate limit headers to derive sustainable throughput baselines.

  Usage:
    node scripts/hubspotRateProbe.js --token "$HUBSPOT_PRIVATE_APP_TOKEN" \
      --endpoints contacts,companies,deals --concurrency 3 --iterations 25 --delayMs 500

  Output:
    JSON summary of min/avg/max remaining, reset windows, error counts, 429 events.

  Notes:
    - Uses sequential iteration with limited parallel batches (Promise pool).
    - Does NOT retry on 429; records and backs off per --delayMs.
    - Safe to run in development; avoid very high concurrency in production tenants.
*/

const axios = require('axios')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

const argv = yargs(hideBin(process.argv))
  .option('token', { type: 'string', demandOption: true })
  .option('endpoints', { type: 'string', default: 'contacts' })
  .option('concurrency', { type: 'number', default: 2 })
  .option('iterations', { type: 'number', default: 20 })
  .option('delayMs', { type: 'number', default: 400 })
  .help().argv

const { buildPath } = require('../server/tools/hubspot/apiRegistry')

const HUBSPOT_BASE = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com'
const endpointMap = {
  contacts: `${HUBSPOT_BASE}${buildPath('crm.contacts.get')}?limit=1`,
  companies: `${HUBSPOT_BASE}${buildPath('crm.companies.get')}?limit=1`,
  deals: `${HUBSPOT_BASE}${buildPath('crm.deals.get')}?limit=1`
}

const selected = argv.endpoints.split(',').map(s => s.trim()).filter(Boolean)

const stats = {}
for (const ep of selected) {
  stats[ep] = { count: 0, successes: 0, errors: 0, r429: 0, remaining: [], reset: [], limits: [] }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function probeOne(ep) {
  const url = endpointMap[ep]
  if (!url) return { ep, skipped: true }
  try {
    const resp = await axios.get(url, { headers: { Authorization: `Bearer ${argv.token}` }, timeout: 8000 })
    const h = resp.headers || {}
    const rem = parseInt(h['x-ratelimit-remaining'], 10)
    const lim = parseInt(h['x-ratelimit-limit'], 10)
    const rst = parseInt(h['x-ratelimit-reset'], 10)
    const s = stats[ep]
    s.count++
    s.successes++
    if (!isNaN(rem)) s.remaining.push(rem)
    if (!isNaN(lim)) s.limits.push(lim)
    if (!isNaN(rst)) s.reset.push(rst)
    return { ep, status: resp.status }
  } catch (e) {
    const s = stats[ep]
    s.count++
    s.errors++
    const status = e.response?.status
    if (status === 429) s.r429++
    return { ep, error: e.message, status }
  }
}

async function run() {
  console.log('Starting HubSpot rate probe with config:', { endpoints: selected, concurrency: argv.concurrency, iterations: argv.iterations, delayMs: argv.delayMs })
  for (let i = 0; i < argv.iterations; i++) {
    const batch = []
    for (let c = 0; c < argv.concurrency; c++) {
      const ep = selected[(i + c) % selected.length]
      batch.push(probeOne(ep))
    }
    await Promise.all(batch)
    await sleep(argv.delayMs)
  }
  const summary = {}
  for (const [ep, s] of Object.entries(stats)) {
    function agg(arr) {
      if (!arr.length) return { min: null, avg: null, max: null }
      const min = Math.min(...arr)
      const max = Math.max(...arr)
      const avg = Math.round(arr.reduce((a,b)=>a+b,0) / arr.length)
      return { min, avg, max }
    }
    summary[ep] = {
      count: s.count,
      successes: s.successes,
      errors: s.errors,
      r429: s.r429,
      remaining: agg(s.remaining),
      limitObserved: agg(s.limits),
      resetObserved: agg(s.reset)
    }
  }
  console.log('\n=== Rate Probe Summary ===')
  console.log(JSON.stringify(summary, null, 2))
}

run().catch(e => { console.error('Probe failed:', e); process.exit(1) })
