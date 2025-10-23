// Safe HubSpot connectivity check script
// Reads TOKEN_ENC_SECRET / HUBSPOT_API_TOKEN from environment (.env) and calls a set of read-only endpoints
// Does not log tokens. Prints minimal success info: endpoint key, HTTP status, and counts where applicable.

const axios = require('axios')
const dotenv = require('dotenv')
const { buildPath } = require('../server/tools/hubspot/apiRegistry')

dotenv.config()

const HUBSPOT_HOST = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com'
const TOKEN = process.env.HUBSPOT_API_TOKEN

if (!TOKEN) {
  console.error('HUBSPOT_API_TOKEN is not set in environment; aborting.')
  process.exit(2)
}

const client = axios.create({
  baseURL: HUBSPOT_HOST,
  headers: { Authorization: `Bearer ${TOKEN}` },
  timeout: 10000
})

async function probe(key, ...args) {
  try {
    const path = buildPath(key, ...args)
    const res = await client.get(path, { params: { limit: 2 } })
    const info = { key, path, status: res.status }
    if (Array.isArray(res.data?.results)) info.count = res.data.results.length
    if (Array.isArray(res.data?.pipelines)) info.count = res.data.pipelines.length
    if (Array.isArray(res.data?.owners)) info.count = res.data.owners.length
    console.log(JSON.stringify(info))
  } catch (err) {
    const status = err?.response?.status
    console.error(JSON.stringify({ key, error: err.message, status }))
  }
}

async function main() {
  console.log('Starting HubSpot connectivity check (read-only endpoints)')
  await probe('crm.contacts.validateProbe')
  await probe('crm.pipelines.deals.list')
  await probe('crm.owners.list')
  // users endpoint can be present but may be behind beta; handle failures gracefully
  await probe('crm.users.list')
  console.log('Done')
}

main()

