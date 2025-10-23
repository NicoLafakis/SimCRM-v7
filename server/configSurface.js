// Runtime configuration surface for adjustable simulation parameters.
// Focus: budgets & probabilities, deal win rate, per-record caps.
// In-memory only (per-process) until persistence layer is added.

const { getScenarioParameters } = require('./scenarioParameters')

// overrides structure: { [scenarioId]: { dealWinRateBase?, interactions: { probabilities?, perRecordCaps?, globalBudgets? } } }
const overrides = {}
const overrideVersions = {} // { scenarioId: { version: number, hash: string } }
const versionHistory = {} // { scenarioId: [ { version, hash, ts } ] }

const PROB_KEYS = [
  'initialNote','firstCallOnMQL','followUpTaskIfNoCall','nurtureNoteOnRegression','postWinNote','lostDealTicket'
]
// Helper to deeply merge (limited shape)
function deepMerge(base, over) {
  if (!over) return { ...base }
  const out = JSON.parse(JSON.stringify(base))
  if (over.dealWinRateBase != null) out.dealWinRateBase = over.dealWinRateBase
  if (over.interactions) {
    out.interactions = out.interactions || {}
    if (over.interactions.probabilities) {
      out.interactions.probabilities = { ...out.interactions.probabilities, ...over.interactions.probabilities }
    }
    if (over.interactions.perRecordCaps) {
      out.interactions.perRecordCaps = { ...out.interactions.perRecordCaps, ...over.interactions.perRecordCaps }
    }
    if (over.interactions.globalBudgets) {
      out.interactions.globalBudgets = { ...out.interactions.globalBudgets, ...over.interactions.globalBudgets }
    }
  }
  return out
}

function validateOverrides(partial) {
  if (partial.dealWinRateBase != null) {
    const v = partial.dealWinRateBase
    if (typeof v !== 'number' || v < 0 || v > 1) throw new Error('dealWinRateBase must be number 0..1')
  }
  const interactions = partial.interactions || {}
  if (interactions.probabilities) {
    for (const [k,v] of Object.entries(interactions.probabilities)) {
      if (!PROB_KEYS.includes(k)) throw new Error(`probability key not adjustable: ${k}`)
      if (typeof v !== 'number' || v < 0 || v > 1) throw new Error(`probability ${k} must be number 0..1`)
    }
  }
  if (interactions.perRecordCaps) {
    for (const [k,v] of Object.entries(interactions.perRecordCaps)) {
      if (typeof v !== 'number' || v < 0) throw new Error(`perRecordCaps ${k} must be positive number`)
    }
  }
  if (interactions.globalBudgets) {
    for (const [k,v] of Object.entries(interactions.globalBudgets)) {
      if (typeof v !== 'number' || v < 0) throw new Error(`globalBudgets ${k} must be positive number`)
    }
  }
}

function setScenarioOverrides(scenarioId, partial) {
function computeHash(obj) {
  try {
    const json = JSON.stringify(obj)
    let h = 0x811c9dc5
    for (let i=0;i<json.length;i++) {
      h ^= json.charCodeAt(i)
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
    }
    return h.toString(16)
  } catch { return null }
}

  if (!scenarioId) throw new Error('scenario required')
  validateOverrides(partial)
  if (!overrides[scenarioId]) overrides[scenarioId] = {}
  // merge into existing overrides (deep limited)
  overrides[scenarioId] = deepMerge(overrides[scenarioId], partial)
  // version bump
  const current = overrideVersions[scenarioId]?.version || 0
  const nextVersion = current + 1
  const hash = computeHash(overrides[scenarioId])
  overrideVersions[scenarioId] = { version: nextVersion, hash }
  if (!versionHistory[scenarioId]) versionHistory[scenarioId] = []
  versionHistory[scenarioId].push({ version: nextVersion, hash, ts: Date.now() })
  return overrides[scenarioId]
}

function resetScenarioOverrides(scenarioId) {
  delete overrides[scenarioId]
  delete overrideVersions[scenarioId]
  delete versionHistory[scenarioId]
}

function getScenarioOverrides(scenarioId) {
  return overrides[scenarioId] || null
}

function getMergedScenario(scenarioId) {
  const base = getScenarioParameters(scenarioId)
  if (!base) return null
  return deepMerge(base, overrides[scenarioId])
}

function getOverrideVersionInfo(scenarioId) {
  return overrideVersions[scenarioId] || { version: 0, hash: null }
}

function getOverrideVersionHistory(scenarioId) {
  return versionHistory[scenarioId] || []
}

function listAdjustableKeys() {
  return {
    dealWinRateBase: 'number 0..1',
    probabilities: PROB_KEYS.reduce((a,k)=>{a[k] = 'number 0..1'; return a}, {}),
    perRecordCaps: 'positive integers',
    globalBudgets: 'positive integers'
  }
}

module.exports = {
  setScenarioOverrides,
  resetScenarioOverrides,
  getScenarioOverrides,
  getMergedScenario,
  listAdjustableKeys,
  getOverrideVersionInfo,
  getOverrideVersionHistory,
}
