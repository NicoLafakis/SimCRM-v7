// Helper to create a HubSpot API client with enforced token requirement.
// Centralizes creation for route handlers replacing raw axios usage.
const { createClient } = require('./hubspotClient')

function requireHubSpotClient(token) {
  if (!token) throw new Error('HubSpot token required')
  const client = createClient()
  client.setToken(token)
  return client
}

module.exports = { requireHubSpotClient }
