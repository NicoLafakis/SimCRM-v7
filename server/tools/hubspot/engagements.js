const { buildPath } = require('./apiRegistry')

// Use the v3 engagements-like endpoints for notes, calls, tasks
module.exports = (client) => ({
  createNote: async ({ subject, body, associations = [] }) => {
    const data = {
      engagement: { type: 'NOTE' },
      metadata: { body },
      associations: associations.map(id => ({ to: { id } }))
    }
    const res = await client.post(buildPath('engagements.create'), data).catch(e => {
      // fallback to timeline events if engagements endpoint not available
      throw e
    })
    return res.data
  },
  // Calls and tasks can be created via the engagements or dedicated endpoints
  createCall: async (payload) => {
    // payload should contain engagement, metadata, associations
    const res = await client.post(buildPath('engagements.create'), payload)
    return res.data
  },
  createTask: async (payload) => {
    const res = await client.post(buildPath('engagements.create'), payload)
    return res.data
  }
})
