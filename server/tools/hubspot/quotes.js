const { buildPath } = require('./apiRegistry')

module.exports = (client) => ({
  create: async (props, associations = []) => {
    const body = { properties: props }
    if (associations.length) body.associations = associations
    const res = await client.post(buildPath('crm.quotes.create'), body)
    return res.data
  },
  get: async (id, opts) => {
    const res = await client.get(buildPath('crm.quotes.get', id), opts)
    return res.data
  },
  update: async (id, props) => {
    const res = await client.patch(buildPath('crm.quotes.update', id), { properties: props })
    return res.data
  }
})
