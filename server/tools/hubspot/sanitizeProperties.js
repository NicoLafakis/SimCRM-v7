const whitelist = require('./creationWhitelist')

function sanitizeProperties(objectType, props = {}) {
  const allowed = whitelist[objectType]
  if (!allowed) return { clean: props, stripped: [] }
  const clean = {}
  const stripped = []
  for (const k of Object.keys(props || {})) {
    if (allowed.includes(k)) clean[k] = props[k]
    else stripped.push(k)
  }
  return { clean, stripped }
}

module.exports = { sanitizeProperties }
