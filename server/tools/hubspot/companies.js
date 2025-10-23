const { buildPath } = require('./apiRegistry')
const { sanitizeProperties } = require('./sanitizeProperties')

module.exports = (client) => ({
  create: async (props) => {
    const { clean, stripped } = sanitizeProperties('companies', props)
    if (stripped.length) { try { console.warn('hubspot:companies: stripped properties', stripped) } catch {} }
    const res = await client.post(buildPath('crm.companies.create'), { properties: clean })
    return res.data
  },
  get: async (id, opts) => {
    const res = await client.get(buildPath('crm.companies.get', id), opts)
    return res.data
  },
  update: async (id, props) => {
    const res = await client.patch(buildPath('crm.companies.update', id), { properties: props })
    return res.data
  },
  delete: async (id) => {
    const res = await client.del(buildPath('crm.companies.delete', id))
    return res.data
  }
})
