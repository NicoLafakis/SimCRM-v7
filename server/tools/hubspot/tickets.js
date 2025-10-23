const { buildPath } = require('./apiRegistry')
const { sanitizeProperties } = require('./sanitizeProperties')

module.exports = (client) => ({
  create: async (props, associations = []) => {
    const { clean, stripped } = sanitizeProperties('tickets', props)
    if (stripped.length) { try { console.warn('hubspot:tickets: stripped properties', stripped) } catch {} }
    const body = { properties: clean }
    if (associations.length) body.associations = associations
    const res = await client.post(buildPath('crm.tickets.create'), body)
    return res.data
  },
  get: async (id, opts) => {
    const res = await client.get(buildPath('crm.tickets.get', id), opts)
    return res.data
  },
  update: async (id, props) => {
    return (await client.patch(buildPath('crm.tickets.update', id), { properties: props })).data
  },
  delete: async (id) => {
    return (await client.del(buildPath('crm.tickets.delete', id))).data
  }
})
