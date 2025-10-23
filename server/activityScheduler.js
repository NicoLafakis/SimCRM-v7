// activityScheduler: decides secondary CRM activities based on scenario interactions.
// Inputs:
// - context: { phase: 'contact_created' | 'mql' | 'sql' | 'deal_won' | 'deal_lost' | 'regression', recordId, simulationId }
// - interactions: scenarioParams.interactions
// - rng: deterministic RNG { chance(), nextFloat(), nextInt() }
// - budget: object with remaining global budgets { notes, calls, tasks, tickets }
// - recordCounts: existing per-record counts { notes, calls, tasks, tickets }
// Output: array of { type: 'note'|'call'|'task'|'ticket', delayMs, ordinal }

function randomDelay(rng, spec) {
  if (!spec) return 0
  if (spec.meanMin) { // mean + jitter
    const base = spec.meanMin
    const jitter = spec.jitter || 0
    const offset = (rng.nextFloat() * 2 - 1) * jitter
    return Math.max(0, Math.round((base + offset) * 60 * 1000))
  }
  if (spec.rangeMin != null && spec.rangeMax != null) {
    const mins = rng.nextInt(spec.rangeMin, spec.rangeMax)
    return mins * 60 * 1000
  }
  return 0
}

function scheduleActivities({ context, interactions, rng, budget, recordCounts }) {
  if (!interactions) return []
  const { probabilities, perRecordCaps, delays } = interactions
  const out = []

  function can(type) {
    if (!budget || budget[type] <= 0) return false
    if (perRecordCaps && recordCounts && perRecordCaps[type] != null) {
      const used = recordCounts[type] || 0
      if (used >= perRecordCaps[type]) return false
    }
    return true
  }

  function attempt(type, probKey, delayKey) {
    if (!can(type)) return
    const p = probabilities?.[probKey]
    if (p == null) return
    if (!rng.chance(p)) return
    const nextOrdinal = (recordCounts[type] || 0) + 1
    out.push({ type, delayMs: randomDelay(rng, delays?.[delayKey]), ordinal: nextOrdinal })
    budget[type] -= 1
    recordCounts[type] = nextOrdinal
  }

  switch (context.phase) {
    case 'contact_created':
      attempt('note', 'initialNote', null)
      break
    case 'mql':
      attempt('call', 'firstCallOnMQL', 'firstCallOnMQL')
      attempt('task', 'followUpTaskIfNoCall', 'followUpTaskIfNoCall')
      break
    case 'regression':
      attempt('note', 'nurtureNoteOnRegression', 'nurtureNoteOnRegression')
      break
    case 'deal_won':
      attempt('note', 'postWinNote', 'postWinNote')
      break
    case 'deal_lost':
      attempt('ticket', 'lostDealTicket', 'lostDealTicket')
      break
    default:
      break
  }

  return out
}

module.exports = { scheduleActivities }
