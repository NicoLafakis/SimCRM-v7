// Simple structured logging helper.
// Usage: logInfo({...}), logError({...}) ensures consistent JSON fields.

const REQUIRED_ORDER = ['ts','level','eventId','msg','simulationId','jobId','recordIndex','overrideVersion']

function base(fields) {
  const out = {
    ts: Date.now(),
    pid: process.pid,
    ...fields,
  }
  return out
}

function serialize(obj) {
  // Ensure stable key ordering for primary fields to aid log ingestion tools
  const ordered = {}
  for (const k of REQUIRED_ORDER) if (obj[k] !== undefined) ordered[k] = obj[k]
  for (const [k,v] of Object.entries(obj)) if (!(k in ordered)) ordered[k] = v
  return JSON.stringify(ordered)
}

function logInfo(fields) {
  process.stdout.write(serialize(base({ level: 'info', ...fields })) + '\n')
}

function logError(fields) {
  process.stderr.write(serialize(base({ level: 'error', ...fields })) + '\n')
}

module.exports = { logInfo, logError }