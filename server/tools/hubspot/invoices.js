const { buildPath } = require('./apiRegistry')
const { sanitizeProperties } = require('./sanitizeProperties')

module.exports = (client) => ({
  create: async (props) => {
    const { clean, stripped } = sanitizeProperties('invoices', props)
    if (stripped.length) { try { console.warn('hubspot:invoices: stripped properties', stripped) } catch {} }
    const res = await client.post(buildPath('crm.invoices.create'), { properties: clean })
    return res.data
  },
  get: async (id, opts) => {
    const res = await client.get(buildPath('crm.invoices.get', id), opts)
    return res.data
  },
  update: async (id, props) => {
    const res = await client.patch(buildPath('crm.invoices.update', id), { properties: props })
    return res.data
  }
})
