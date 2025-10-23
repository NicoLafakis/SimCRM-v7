// Exhaustive read-only probe for HubSpot API registry
// - Iterates registry keys, filters GET endpoints, and issues safe GETs
// - Skips obvious risky keys (batch create/update/archive, post/put/patch/delete)
// - For function paths that require IDs, attempts a call with no args and
//   tolerates 400/404/403 responses; avoids sending bodies or performing writes.
// - Prints JSON lines: { key, path, status, ok, note }

const axios = require('axios')
const dotenv = require('dotenv')
const { listKeys, getEndpoint, buildPath } = require('../server/tools/hubspot/apiRegistry')

dotenv.config()

const HUBSPOT_HOST = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com'
const TOKEN = process.env.HUBSPOT_API_TOKEN

if (!TOKEN) {
  console.error('HUBSPOT_API_TOKEN is not set; aborting.')
  process.exit(2)
}

const client = axios.create({ baseURL: HUBSPOT_HOST, headers: { Authorization: `Bearer ${TOKEN}` }, timeout: 10000 })

function isReadOnly(ep) {
  return ep && ep.method && ep.method.toLowerCase() === 'get'
}

// Heuristic skip list for keys that look risky even if method is GET (none expected)
const skipKeys = new Set([
  // No immediate entries; reserved for future overrides
])

async function probeKey(key) {
  const ep = getEndpoint(key)
  if (!isReadOnly(ep)) return { key, skipped: true, reason: 'not-get' }
  if (skipKeys.has(key)) return { key, skipped: true, reason: 'skiplist' }

  // Attempt to build a path safely. If path is a function, call with no args; many v3 list endpoints accept none.
  let path
  try {
    path = buildPath(key)
  } catch (err) {
    // buildPath may throw if function requires args; mark as skipped but report
    return { key, skipped: true, reason: 'buildPath-error', message: err.message }
  }

  try {
    // Use conservative params to limit results when applicable
    const params = { limit: 2 }
    const res = await client.get(path, { params })
    const info = { key, path, status: res.status, ok: res.status >= 200 && res.status < 300 }
    // best-effort counts
    if (Array.isArray(res.data?.results)) info.count = res.data.results.length
    if (Array.isArray(res.data?.owners)) info.count = res.data.owners.length
    if (Array.isArray(res.data?.pipelines)) info.count = res.data.pipelines.length
    if (Array.isArray(res.data?.objects)) info.count = res.data.objects.length
    return info
  } catch (err) {
    const status = err?.response?.status
    return { key, path, status, ok: false, error: err.message }
  }
}

async function main() {
  console.log('Starting HubSpot registry read-only probe')
  const keys = listKeys()
  for (const key of keys) {
    try {
      const out = await probeKey(key)
      console.log(JSON.stringify(out))
    } catch (err) {
      console.error(JSON.stringify({ key, error: err.message }))
    }
  }
  console.log('Completed probe')
}

main()
