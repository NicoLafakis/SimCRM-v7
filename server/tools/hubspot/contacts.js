const { buildPath } = require('./apiRegistry')
const { sanitizeProperties } = require('./sanitizeProperties')

module.exports = (client) => ({
  create: async (props) => {
    const { clean, stripped } = sanitizeProperties('contacts', props)
    if (stripped.length) {
      // non-fatal: record in logs (server logging system will pick this up where applicable)
      try { console.warn('hubspot:contacts: stripped properties', stripped) } catch {}
    }
    const body = { properties: clean }
    const url = buildPath('crm.contacts.create')
    const res = await client.post(url, body)
    return res.data
  },
  get: async (id, opts) => {
    const url = buildPath('crm.contacts.get', id)
    const res = await client.get(url, opts)
    return res.data
  },
  update: async (id, props) => {
    const body = { properties: props }
    const url = buildPath('crm.contacts.update', id)
    const res = await client.patch(url, body)
    return res.data
  },
  delete: async (id) => {
    const url = buildPath('crm.contacts.delete', id)
    const res = await client.del(url)
    return res.data
  },
  search: async (searchRequest) => {
    const url = buildPath('crm.contacts.search')
    const res = await client.post(url, searchRequest)
    return res.data
  },
  batchUpsert: async (inputs, idProperty = 'email') => {
    const body = { inputs: inputs.map(i => ({ id: i[idProperty], idProperty, properties: i.properties })) }
    const url = buildPath('crm.contacts.batchUpsert')
    const res = await client.post(url, body)
    return res.data
  }
})
