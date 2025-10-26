const { buildPath } = require('./apiRegistry')
const { sanitizeProperties } = require('./sanitizeProperties')

module.exports = (client) => ({
  create: async (props, associations = []) => {
    const { clean, stripped } = sanitizeProperties('deals', props)
    if (stripped.length) { try { console.warn('hubspot:deals: stripped properties', stripped) } catch {} }
    const body = { properties: clean }
    if (associations.length) body.associations = associations
    const res = await client.post(buildPath('crm.deals.create'), body)
    return res.data
  },
  get: async (id, opts) => {
    const res = await client.get(buildPath('crm.deals.get', id), opts)
    return res.data
  },
  update: async (id, props) => {
    const res = await client.patch(buildPath('crm.deals.update', id), { properties: props })
    return res.data
  },
  delete: async (id) => {
    const res = await client.del(buildPath('crm.deals.delete', id))
    return res.data
  },
  search: async (searchRequest) => {
    const res = await client.post(buildPath('crm.deals.search'), searchRequest)
    return res.data
  }
})
