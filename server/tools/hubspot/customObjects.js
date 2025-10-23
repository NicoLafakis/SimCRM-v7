const { buildPath } = require('./apiRegistry')

module.exports = (client) => ({
  // For custom objects, clients must provide the objectType in the path
  create: async (objectType, props) => {
    const res = await client.post(buildPath('crm.custom.create', objectType), { properties: props })
    return res.data
  },
  get: async (objectType, id, opts) => {
    const res = await client.get(buildPath('crm.custom.get', objectType, id), opts)
    return res.data
  },
  update: async (objectType, id, props) => {
    const res = await client.patch(buildPath('crm.custom.update', objectType, id), { properties: props })
    return res.data
  }
})
