import React, { useMemo } from 'react'

// Simple estimation logic using scenario + base record count and probabilities
export default function SimulationSummary({
  scenario, // { id, name, description }
  distribution, // { id, name }
  baseTotalRecords, // user-selected raw count
  timing, // optional timing params { durationMinutes, batchSize, startDelaySec, jitterPct, maxConcurrency }
  onBack,
  onStart,
  playPlunk,
  actionsHidden = false,
  overrides = null, // { merged, overrides } from boss config endpoint (optional)
}) {
  const est = useMemo(() => {
    if (!scenario || !baseTotalRecords) return null
    // Pull rough multipliers based on scenario id (should mirror backend scenarioParameters)
    const scenarioDefaults = {
      b2b: { leadVolumeMultiplier: 0.8, dealWinRateBase: 0.6, probs: { postWinNote: 0.55, lostDealTicket: 0.15 }, caps: { notes:5, calls:3, tasks:6, tickets:1 } },
      b2c: { leadVolumeMultiplier: 1.8, dealWinRateBase: 0.42, probs: { postWinNote: 0.4, lostDealTicket: 0.05 }, caps: { notes:3, calls:1, tasks:3, tickets:1 } },
    }[scenario.id] || { leadVolumeMultiplier:1, dealWinRateBase:0.5, probs:{ postWinNote:0.5, lostDealTicket:0.1 }, caps:{ notes:3, calls:1, tasks:3, tickets:1 } }

    const effectiveContacts = Math.round(baseTotalRecords * scenarioDefaults.leadVolumeMultiplier)
    // Approx company ratio (simple heuristic)
    const companyRatio = scenario.id === 'b2b' ? 0.25 : 0.75 // B2B: multi contacts per company; B2C: many solo contacts
    const companies = Math.max(1, Math.round(effectiveContacts * companyRatio))
    const deals = Math.round(effectiveContacts * scenarioDefaults.dealWinRateBase)
    // Secondary activity rough estimates: scale by deals & contacts
    const notes = Math.round(effectiveContacts * 0.9) + Math.round(deals * scenarioDefaults.probs.postWinNote)
    const calls = Math.round(effectiveContacts * (scenario.id === 'b2b' ? 0.4 : 0.1))
    const tasks = Math.round(effectiveContacts * (scenario.id === 'b2b' ? 0.35 : 0.2))
    const tickets = Math.round(deals * scenarioDefaults.probs.lostDealTicket)
    return { effectiveContacts, companies, deals, notes, calls, tasks, tickets }
  }, [scenario, baseTotalRecords])

  // Notes: estimation is intentionally simple and deterministic so the UI can
  // show predictable numbers without backend calls. For production we mirror
  // these heuristics server-side in the orchestrator to avoid surprises.

  // Derive override diffs & budget warnings
  const overrideInfo = useMemo(() => {
    if (!overrides || !overrides.merged) return null
    const merged = overrides.merged
    // Extract budgets & probabilities if present
    const probs = merged?.interactions?.probabilities || {}
    const budgets = merged?.interactions?.globalBudgets || {}
    const caps = merged?.interactions?.perRecordCaps || {}
    return { probs, budgets, caps }
  }, [overrides])

  const budgetOverruns = useMemo(() => {
    if (!overrideInfo || !est) return []
    const suggestions = []
    const { budgets } = overrideInfo
    const mapping = [
      ['notes','notes'], ['calls','calls'], ['tasks','tasks'], ['tickets','tickets']
    ]
    for (const [metricKey, budgetKey] of mapping) {
      if (budgets[budgetKey] != null && est[metricKey] != null && est[metricKey] > budgets[budgetKey]) {
        suggestions.push({ type: metricKey, projected: est[metricKey], budget: budgets[budgetKey] })
      }
    }
    return suggestions
  }, [overrideInfo, est])

  if (!scenario || !distribution) return null

  function back() { playPlunk?.(); onBack?.() }
  function start() { playPlunk?.(); onStart?.(est) }

  return (
    <div className="simulation-summary-page" role="dialog" aria-labelledby="summary-title">
      <h1 id="summary-title" className="saas-select-title">SIMULATION SUMMARY</h1>
      <p className="summary-sub">Review projected objects before launch.</p>
      <div className="summary-block olive-panel">
        <dl className="summary-metrics">
          <div><dt>Scenario</dt><dd>{scenario.name}</dd></div>
          <div><dt>Distribution</dt><dd>{distribution.name}</dd></div>
          <div><dt>Base Contacts Input</dt><dd>{baseTotalRecords}</dd></div>
          {est && <>
            <div><dt>Effective Contacts</dt><dd>{est.effectiveContacts}</dd></div>
            <div><dt>Companies (est)</dt><dd>{est.companies}</dd></div>
            <div><dt>Deals (est)</dt><dd>{est.deals}</dd></div>
            <div><dt>Notes (est)</dt><dd>{est.notes}</dd></div>
            <div><dt>Calls (est)</dt><dd>{est.calls}</dd></div>
            <div><dt>Tasks (est)</dt><dd>{est.tasks}</dd></div>
            <div><dt>Tickets (est)</dt><dd>{est.tickets}</dd></div>
          </>}
          {timing && (() => {
            const mins = Math.min(43200, Math.max(0, timing.durationMinutes || 0))
            const d = Math.floor(mins / 1440)
            const h = Math.floor((mins % 1440) / 60)
            const pretty = `${String(d).padStart(2,'0')}:${String(h).padStart(2,'0')}`
            return <div><dt>Duration</dt><dd>{pretty}</dd></div>
          })()}
        </dl>
        {overrideInfo && (
          <div className="summary-overrides">
            <h3 className="summary-subhead">OVERRIDES / LIMITS</h3>
            <div className="override-grid">
              {Object.entries(overrideInfo.probs).map(([k,v]) => (
                <div key={k} className="ovr-item"><span className="ovr-label">{k}</span><span className="ovr-val">{v}</span></div>
              ))}
              {Object.entries(overrideInfo.budgets).map(([k,v]) => (
                <div key={k} className="ovr-item"><span className="ovr-label">budget:{k}</span><span className="ovr-val">{v}</span></div>
              ))}
              {Object.entries(overrideInfo.caps).map(([k,v]) => (
                <div key={k} className="ovr-item"><span className="ovr-label">cap:{k}</span><span className="ovr-val">{v}</span></div>
              ))}
            </div>
            {!!budgetOverruns.length && (
              <div className="budget-warnings" role="alert" aria-label="Budget overruns projected">
                {budgetOverruns.map(b => (
                  <div key={b.type} className="budget-warn-row">Projected {b.type} ({b.projected}) exceeds budget {b.budget}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {!actionsHidden && (
        <div className="summary-actions">
          <button type="button" className="hs-back-btn" onClick={back}>← Back</button>
          <button type="button" className="primary-launch-btn" onClick={start}>LAUNCH SIMULATION</button>
        </div>
      )}
    </div>
  )
}
