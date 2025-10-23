// Centralized job retry & backoff configuration (Phase 5)
// Reads environment variables to allow per-type attempts & backoff sequence overrides.
// Defaults chosen to be conservative to avoid hammering external APIs.

function parseIntList(str) {
  return str.split(',').map(s => parseInt(s.trim(),10)).filter(n => !isNaN(n) && n>=0)
}

const DEFAULTS = {
  contact: { attempts: 3, backoff: [1000, 3000, 9000] },
  note: { attempts: 2, backoff: [2000, 6000] },
  call: { attempts: 2, backoff: [2000, 6000] },
  task: { attempts: 2, backoff: [2000, 6000] },
  ticket: { attempts: 2, backoff: [2000, 6000] },
  secondary: { attempts: 2, backoff: [1500, 4500] },
}

// Support dual naming conventions for env overrides:
// Legacy: ATTEMPTS_CONTACT=3, BACKOFF_CONTACT=100,200,500
// New: CONTACT_ATTEMPTS=3, CONTACT_BACKOFF_MS=100,200,500
// Precedence rules (highest first): New explicit > Legacy > Default.
function resolveAttempts(typeUpper, defAttempts) {
  const newVar = process.env[`${typeUpper}_ATTEMPTS`]
  const legacyVar = process.env[`ATTEMPTS_${typeUpper}`]
  const chosen = (newVar !== undefined ? newVar : legacyVar)
  if (chosen == null) return defAttempts
  const n = parseInt(chosen,10)
  return (Number.isFinite(n) && n > 0) ? n : defAttempts
}

function resolveBackoff(typeUpper, defBackoff) {
  const newVar = process.env[`${typeUpper}_BACKOFF_MS`]
  const legacyVar = process.env[`BACKOFF_${typeUpper}`]
  const chosen = (newVar !== undefined ? newVar : legacyVar)
  if (!chosen) return defBackoff
  const list = parseIntList(chosen)
  return list.length ? list : defBackoff
}

function loadConfig() {
  const cfg = {}
  for (const [type, def] of Object.entries(DEFAULTS)) {
    const upper = type.toUpperCase()
    const newAttemptsVar = process.env[`${upper}_ATTEMPTS`]
    const legacyAttemptsVar = process.env[`ATTEMPTS_${upper}`]
    const newBackoffVar = process.env[`${upper}_BACKOFF_MS`]
    const legacyBackoffVar = process.env[`BACKOFF_${upper}`]
    let attempts = resolveAttempts(upper, def.attempts)
    let backoff = resolveBackoff(upper, def.backoff)
    const bothNamingPresent = (newAttemptsVar !== undefined && legacyAttemptsVar !== undefined) || (newBackoffVar !== undefined && legacyBackoffVar !== undefined)
    // Normalization rule: extend only when (a) deficit > 0 AND (b) not both naming conventions present simultaneously
    if (!bothNamingPresent && backoff.length < attempts - 1) {
      const last = backoff[backoff.length - 1] || 1000
      while (backoff.length < attempts - 1) backoff.push(last)
    }
    cfg[type] = { attempts, backoff }
  }
  return cfg
}

let cached = null
function getRetryConfig() {
  if (!cached) cached = loadConfig()
  return cached
}

function buildBullOptions(type) {
  const cfg = getRetryConfig()[type] || DEFAULTS.contact
  if (!cfg.attempts || cfg.attempts <= 1) return {}
  // Use custom backoff strategy by providing a backoff function through 'settings.backoffStrategies'
  // Simpler: map to BullMQ built-in 'exponential' approximate by using first delay; but we prefer explicit schedule via attemptsMade hook.
  return { attempts: cfg.attempts, backoff: { type: 'fixed', delay: cfg.backoff[0] } }
}

// For explicit schedule we expose helper
function computeNextDelay(type, attemptsMade) {
  const cfg = getRetryConfig()[type] || DEFAULTS.contact
  return cfg.backoff[attemptsMade] || cfg.backoff[cfg.backoff.length-1] || 1000
}

module.exports = { getRetryConfig, buildBullOptions, computeNextDelay }
