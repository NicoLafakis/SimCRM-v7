import React, { useState, useEffect, useRef, useCallback } from 'react'
import SimulationSummary from '../SimulationSummary'
import SliderControl from '../ui/SliderControl'
import Tooltip from '../ui/Tooltip'
import SuccessNotification from '../ui/SuccessNotification'

/*
 * Timing & Quantities Selection Panel
 * Retro hardware style per ui-rules.
 * Props:
 *  - playPlunk: SFX callback
 *  - onBack: navigate back
 *  - onConfirm: ({ totalRecords, durationMinutes, batchSize, startDelaySec, jitterPct, maxConcurrency }) => void
 *  - initial: optional seed values
 */
export default function TimingQuantities({ playPlunk, onBack, onConfirm, initial, userId, hubspotKeyId, testImmediateLaunch }) {
  const allowImmediate = testImmediateLaunch && (typeof process !== 'undefined') && process.env.NODE_ENV === 'test'
  const [totalRecords, setTotalRecords] = useState(initial?.totalRecords ?? 100)
  const [durationMinutes, setDurationMinutes] = useState(initial?.durationMinutes ?? 60)
  // Derived split state for new duration inputs
  const [durationDays, setDurationDays] = useState(() => Math.floor((initial?.durationMinutes ?? 60) / 1440))
  const [durationHours, setDurationHours] = useState(() => Math.floor(((initial?.durationMinutes ?? 60) % 1440) / 60))
  // Hidden advanced sliders (retained in state for backend compatibility)
  const [batchSize, setBatchSize] = useState(initial?.batchSize ?? 20)
  const [batchConstraintAdjusted, setBatchConstraintAdjusted] = useState(false)
  const [startDelaySec, setStartDelaySec] = useState(initial?.startDelaySec ?? 5)
  const [jitterPct, setJitterPct] = useState(initial?.jitterPct ?? 10)
  const [maxConcurrency, setMaxConcurrency] = useState(initial?.maxConcurrency ?? 4)
  const [errors, setErrors] = useState({})
  // HubSpot dynamic data
  const [owners, setOwners] = useState([])
  const [pipelines, setPipelines] = useState([])
  const [selectedOwnerIds, setSelectedOwnerIds] = useState(initial?.ownerIds || [])
  const [pipelineId, setPipelineId] = useState(initial?.pipelineId || '')
  const [loadingHubSpot, setLoadingHubSpot] = useState(false)
  const [hubspotError, setHubspotError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  // Summary modal state
  const [showSummary, setShowSummary] = useState(false)
  const [summaryAccepted, setSummaryAccepted] = useState(false)
  const [scenarioOverrides, setScenarioOverrides] = useState(null)
  const triggerBtnRef = useRef(null)
  const modalPanelRef = useRef(null)
  const firstFieldRef = useRef(null)

  useEffect(() => { firstFieldRef.current?.focus() }, [])

  const validate = useCallback(() => {
    const e = {}
    if (totalRecords < 10 || totalRecords > 10000) e.totalRecords = '10 - 10000'
  // Cap duration at 14 days (20160 minutes) to align with endcap tick
  if (durationMinutes < 1 || durationMinutes > 20160) e.durationMinutes = '1 - 20160'
    if (batchSize < 1 || batchSize > totalRecords) e.batchSize = '1 - total'
    if (startDelaySec < 0 || startDelaySec > 3600) e.startDelaySec = '0 - 3600'
    if (jitterPct < 0 || jitterPct > 100) e.jitterPct = '0 - 100'
    if (maxConcurrency < 1 || maxConcurrency > 32) e.maxConcurrency = '1 - 32'
    // Only enforce HubSpot selections if we are in an authenticated HubSpot context
    if (userId && hubspotKeyId && !loadingHubSpot) {
      if (!pipelineId) e.pipelineId = 'Select pipeline'
      if (!selectedOwnerIds.length) e.ownerIds = 'Select ≥1 owner'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }, [totalRecords, durationMinutes, batchSize, startDelaySec, jitterPct, maxConcurrency, pipelineId, selectedOwnerIds, loadingHubSpot, userId, hubspotKeyId])
  // Manual pull handlers for HubSpot data
  const pullPipelines = async () => {
    console.log('[PULL PIPELINES] Button clicked')
    console.log('[PULL PIPELINES] userId:', userId)
    console.log('[PULL PIPELINES] hubspotKeyId:', hubspotKeyId)
    console.log('[PULL PIPELINES] loadingHubSpot:', loadingHubSpot)
    
    if (!userId || !hubspotKeyId || loadingHubSpot) {
      console.log('[PULL PIPELINES] BLOCKED - missing userId, hubspotKeyId, or already loading')
      return
    }
    
    console.log('[PULL PIPELINES] Starting fetch...')
    setLoadingHubSpot(true)
    setHubspotError(null)
    try {
      const url = `/api/hubspot/deal-pipelines?userId=${encodeURIComponent(userId)}&keyId=${encodeURIComponent(hubspotKeyId)}`
      console.log('[PULL PIPELINES] Fetching:', url)
      const resp = await fetch(url)
      console.log('[PULL PIPELINES] Response status:', resp.status)
      const js = await resp.json()
      console.log('[PULL PIPELINES] Response data:', js)
      
      if (js.ok) {
        console.log('[PULL PIPELINES] SUCCESS - Found', js.pipelines.length, 'pipelines')
        setPipelines(js.pipelines)
        if (!pipelineId && js.pipelines.length) setPipelineId(js.pipelines[0].id)
        setSuccessMessage(`Successfully loaded ${js.pipelines.length} pipeline(s)`)
      } else {
        console.error('[PULL PIPELINES] ERROR:', js.error)
        setHubspotError(js.error || 'pipelines fetch failed')
      }
    } catch (e) {
      console.error('[PULL PIPELINES] EXCEPTION:', e)
      setHubspotError(e.message)
    } finally { 
      setLoadingHubSpot(false) 
      console.log('[PULL PIPELINES] Done')
    }
  }
  const pullOwners = async () => {
    console.log('[PULL OWNERS] Button clicked')
    console.log('[PULL OWNERS] userId:', userId)
    console.log('[PULL OWNERS] hubspotKeyId:', hubspotKeyId)
    console.log('[PULL OWNERS] loadingHubSpot:', loadingHubSpot)
    
    if (!userId || !hubspotKeyId || loadingHubSpot) {
      console.log('[PULL OWNERS] BLOCKED - missing userId, hubspotKeyId, or already loading')
      return
    }
    
    console.log('[PULL OWNERS] Starting fetch...')
    setLoadingHubSpot(true)
    setHubspotError(null)
    try {
      const url = `/api/hubspot/owners?userId=${encodeURIComponent(userId)}&keyId=${encodeURIComponent(hubspotKeyId)}`
      console.log('[PULL OWNERS] Fetching:', url)
      const resp = await fetch(url)
      console.log('[PULL OWNERS] Response status:', resp.status)
      const js = await resp.json()
      console.log('[PULL OWNERS] Response data:', js)
      
      if (js.ok) {
        const mapped = (js.owners||[]).map(o => ({ id: o.id, firstName: o.firstName, lastName: o.lastName, email: o.email }))
        console.log('[PULL OWNERS] SUCCESS - Found', mapped.length, 'owners')
        setOwners(mapped)
        if (!selectedOwnerIds.length && mapped.length) setSelectedOwnerIds([mapped[0].id])
        setSuccessMessage(`Successfully loaded ${mapped.length} owner(s)`)
      } else {
        console.error('[PULL OWNERS] ERROR:', js.error)
        setHubspotError(js.error || 'owners fetch failed')
      }
    } catch (e) {
      console.error('[PULL OWNERS] EXCEPTION:', e)
      setHubspotError(e.message)
    } finally { 
      setLoadingHubSpot(false) 
      console.log('[PULL OWNERS] Done')
    }
  }

  // Auto-fetch HubSpot metadata on mount (and when user/key changes) so buttons act as manual refresh.
  useEffect(() => {
    if (!userId || !hubspotKeyId) return
    // Fire both in parallel; internal guards prevent overlap spinners from blocking.
    // We intentionally don't await to avoid delaying first paint.
    pullPipelines()
    pullOwners()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hubspotKeyId])

  const toggleOwner = (id) => {
    // No SFX here (owner pill toggles are silent per updated spec)
    setSelectedOwnerIds(prev => {
      const exists = prev.includes(id)
      return exists ? prev.filter(x => x !== id) : [...prev, id]
    })
  }

  const ownerDisplay = (o) => {
    const parts = [o.firstName, o.lastName].filter(Boolean)
    const name = parts.length ? parts.join(' ') : (o.email || o.id)
    return name
  }

  useEffect(() => { validate() }, [validate])

  // Range linking: ensure batchSize never exceeds totalRecords. If totalRecords
  // decreases below the current batchSize, auto-adjust batchSize and show a
  // transient visual cue.
  useEffect(() => {
    if (batchSize > totalRecords) {
      setBatchSize(Math.max(1, Math.min(totalRecords, 1)))
      setBatchConstraintAdjusted(true)
      const t = setTimeout(() => setBatchConstraintAdjusted(false), 1500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [totalRecords, batchSize])

  const stepSetter = (setter, step, min, max) => (delta) => {
    setter(v => {
      const next = Math.min(max, Math.max(min, v + (delta * step)))
      return next
    })
  }

  const handleKeySpin = (e, setter, step, min, max) => {
    if (e.key === 'ArrowUp' || e.key === '+') {
      e.preventDefault()
      stepSetter(setter, step, min, max)(1)
      playPlunk?.()
    } else if (e.key === 'ArrowDown' || e.key === '-') {
      e.preventDefault()
      stepSetter(setter, step, min, max)(-1)
      playPlunk?.()
    }
  }

  const launch = () => {
    const run = () => {
      // Validation bypass only when allowImmediate (test mode) is active; consolidates earlier testImmediateLaunch check.
      if (!validate() && !allowImmediate) return
      playPlunk?.()
      onConfirm?.({ totalRecords, durationMinutes, batchSize, startDelaySec, jitterPct, maxConcurrency, pipelineId, ownerIds: selectedOwnerIds })
    }
    // Use microtask so tests relying on async state (waitFor) observe invocation after DOM updates
    if (allowImmediate) {
      run()
    } else {
      if (typeof queueMicrotask === 'function') queueMicrotask(run); else setTimeout(run,0)
    }
  }

  const handlePrimaryButton = async () => {
    if (!summaryAccepted) {
      if (!validate()) return
      playPlunk?.()
      // Fetch overrides best-effort (assuming initial carries scenarioId)
      const scenarioId = initial?.scenarioId || 'b2b'
      try {
        const resp = await fetch(`/api/boss/config/scenario/${scenarioId}`, { headers: { 'x-user-id': initial?.userId || 'boss' } })
        if (resp.ok) {
          const js = await resp.json()
            if (js.ok) setScenarioOverrides(js)
        }
      } catch { /* ignore */ }
      setShowSummary(true)
      setTimeout(() => { modalPanelRef.current?.focus() }, 30)
    } else {
      launch()
    }
  }

  const closeSummary = () => { playPlunk?.(); setShowSummary(false); setTimeout(()=>triggerBtnRef.current?.focus(),30) }
  const acceptSummary = () => { playPlunk?.(); setSummaryAccepted(true); setShowSummary(false) }
  // TEST-ONLY: Auto-launch once summary accepted in test immediate mode.
  // This effect is guarded by allowImmediate (NODE_ENV === 'test' && testImmediateLaunch prop) so it never fires in production.
  // TODO(Remove): When confirm flow test is stabilized to explicitly click START after ACCEPT with deterministic microtask flush, remove this effect.
  useEffect(() => {
    if (allowImmediate && summaryAccepted && !showSummary) {
      // Defer one microtask to allow state flush
      if (typeof queueMicrotask === 'function') queueMicrotask(() => launch())
      else setTimeout(() => launch(), 0)
    }
  }, [allowImmediate, summaryAccepted, showSummary])

  const tooltips = {
    totalRecords: 'Total base contacts to seed before scenario multipliers.',
    durationMinutes: 'Simulation span (DD:HH:MM). Capped at 30 days.',
    batchSize: 'Hidden (auto-managed).',
    startDelaySec: 'Hidden (disabled).',
    jitterPct: 'Hidden (disabled).',
    maxConcurrency: 'Hidden (fixed).'
  }

  const slider = (label, value, setValue, name, opts={}) => {
    const { step=1, min=0, max=999999, ticks=null, valueFormatter=null, showNormalization=false, vertical=false, evenDistribution=false, editableValue=false } = opts
    return (
      <SliderControl
        key={name}
        id={name}
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(v)=>{ setValue(v); }}
        error={errors[name]}
        tooltip={<Tooltip text={tooltips[name]} />}
        ticks={ticks}
        valueFormatter={valueFormatter}
        showNormalization={showNormalization}
        vertical={vertical}
        evenDistribution={evenDistribution}
        editableValue={editableValue}
      />
    )
  }

  // Tick data
  // Revised tick sets (even distribution across track)
  const totalRecordTicks = [500,2500,5000,7500,10000].map(v => ({ value:v, label:String(v) }))
  // Duration ticks (endcap at 14d). Even distribution ensures 14d is right edge.
  const durationTickMap = [60, 24*60, 7*24*60, 14*24*60]
  const durationTicks = durationTickMap.map(v => (v < 1440 ? { value:v, label:(v/60)+'h' } : { value:v, label:(v/1440)+'d' }))
  const formatDuration = (mins) => {
    const clamped = Math.min(20160, Math.max(0, mins))
    const d = Math.floor(clamped / 1440)
    const h = Math.floor((clamped % 1440) / 60)
    return `${String(d).padStart(2,'0')}:${String(h).padStart(2,'0')}`
  }
  // Keep durationMinutes in sync when days/hours change
  useEffect(()=>{
    let d = Number(durationDays) || 0
    let h = Number(durationHours) || 0
    if (h >= 24) { d += Math.floor(h / 24); h = h % 24 }
    let total = d * 1440 + h * 60
    if (total < 0) total = 0
    if (total > 20160) { total = 20160; d = Math.floor(total / 1440); h = Math.floor((total % 1440)/60) }
    setDurationMinutes(total)
  }, [durationDays, durationHours])
  useEffect(()=>{ // clamp back into split if external change exceeds bounds
    if (durationMinutes > 20160) setDurationMinutes(20160)
    const d = Math.floor(durationMinutes / 1440)
    const h = Math.floor((durationMinutes % 1440) / 60)
    if (d !== durationDays) setDurationDays(d)
    if (h !== durationHours) setDurationHours(h)
  }, [durationMinutes])

  return (
    <div className="timing-shell">
      <div className="timing-frame">
        <h1 className="tq-title">TIMING & QUANTITIES</h1>
        {initial?.scenarioId && initial?.distributionMethod && (
          <div className="tq-context-line" aria-label="Selection context">
            <span className="ctx-item">SCENARIO: {initial.scenarioId.toUpperCase()}</span>
            <span className="ctx-item">DISTRIBUTION: {initial.distributionMethod.toUpperCase()}</span>
          </div>
        )}
        <div className="tq-panel" role="form" aria-label="Timing and Quantities">
          {slider('Total Records', totalRecords, setTotalRecords, 'totalRecords', { step:10, min:0, max:10000, showNormalization:true, ticks: totalRecordTicks, evenDistribution:true, editableValue:true })}
          <div className={`tq-row${errors.durationMinutes ? ' has-error' : ''}`}>
            <label className="tq-label" htmlFor="durationDays">Duration</label>
            <div className="duration-composite" role="group" aria-label="Duration Days and Hours">
              <div className="duration-part">
                <input
                  id="durationDays"
                  type="number"
                  className="tq-input duration-input"
                  min={0}
                  max={14}
                  value={durationDays}
                  onChange={(e)=>{ setDurationDays(e.target.value.replace(/[^0-9]/g,'').slice(0,3)) }}
                  onBlur={()=>{ if (durationDays > 14) setDurationDays(14) }}
                  aria-label="Days"
                />
                <span className="duration-suffix">D</span>
              </div>
              <div className="duration-part">
                <input
                  id="durationHours"
                  type="number"
                  className="tq-input duration-input"
                  min={0}
                  max={23}
                  value={durationHours}
                  onChange={(e)=>{ setDurationHours(e.target.value.replace(/[^0-9]/g,'').slice(0,2)) }}
                  onBlur={()=>{ if (durationHours > 23) setDurationHours(23) }}
                  aria-label="Hours"
                />
                <span className="duration-suffix">H</span>
              </div>
              <div className="duration-preview" aria-label="Formatted duration">{formatDuration(durationMinutes)}</div>
            </div>
            <div className="tq-meta">{errors.durationMinutes ? <span className="tq-err">{errors.durationMinutes}</span> : <span className="tq-ok">OK</span>}</div>
          </div>
          {/* Hidden advanced sliders removed from display: Batch Size, Start Delay, Jitter %, Max Concurrency */}

          <div className={`tq-row${errors.pipelineId ? ' has-error' : ''}`}>
            <label className="tq-label" htmlFor="pipelineId">Deal Pipeline</label>
            <select
              id="pipelineId"
              className="tq-input"
              value={pipelineId}
              onChange={(e) => { setPipelineId(e.target.value) }}
              disabled={loadingHubSpot || !pipelines.length}
              // Removed focus SFX
              aria-invalid={!!errors.pipelineId}
            >
              <option value="" disabled>{loadingHubSpot ? 'Loading...' : (pipelines.length ? 'Select pipeline' : (hubspotError ? 'Error' : 'No pipelines'))}</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.label || p.id}</option>)}
            </select>
            <div className="tq-meta">{errors.pipelineId ? <span id="pipelineId-err" className="tq-err">{errors.pipelineId}</span> : <span className="tq-ok"></span>}</div>
          </div>

          <div className={`tq-row owners-row${errors.ownerIds ? ' has-error' : ''}`}>
            <label className="tq-label" htmlFor="ownersBox">Owners (multi)</label>
            <div id="ownersBox" className="owners-box-list" role="group" aria-label="Owners Multi Select">
              {loadingHubSpot && <div className="owners-loading">Loading...</div>}
              {hubspotError && <div className="owners-error">{hubspotError}</div>}
              {!loadingHubSpot && !hubspotError && owners.length === 0 && <div className="owners-empty">No owners found</div>}
              {!loadingHubSpot && !hubspotError && owners.map(o => {
                const active = selectedOwnerIds.includes(o.id)
                return (
                  <label
                    key={o.id}
                    className={`owner-row${active ? ' active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="owner-checkbox"
                      checked={active}
                      onChange={() => toggleOwner(o.id)}
                      aria-label={ownerDisplay(o)}
                    />
                    <span className="owner-name">{ownerDisplay(o)}</span>
                  </label>
                )
              })}
              {!loadingHubSpot && !hubspotError && owners.length > 0 && (
                <div className="owners-hint">RNG assignment when multiple selected</div>
              )}
            </div>
            <div className="tq-meta">{errors.ownerIds ? <span id="ownerIds-err" className="tq-err">{errors.ownerIds}</span> : <span className="tq-ok"></span>}</div>
          </div>
          <div className="tq-row manual-pulls">
            <div className="pull-buttons-group" role="group" aria-label="Manual HubSpot Pulls">
              <button
                type="button"
                className="btn btn-small"
                onClick={()=>{ playPlunk?.(); pullPipelines() }}
                disabled={loadingHubSpot || !userId || !hubspotKeyId}
              >{loadingHubSpot ? 'WORKING...' : 'PULL PIPELINES'}</button>
              <button
                type="button"
                className="btn btn-small"
                onClick={()=>{ playPlunk?.(); pullOwners() }}
                disabled={loadingHubSpot || !userId || !hubspotKeyId}
              >{loadingHubSpot ? 'WORKING...' : 'PULL OWNERS'}</button>
            </div>
          </div>
        </div>
        <div className="tq-actions">
          <button type="button" className="btn btn-secondary" onClick={() => { playPlunk?.(); onBack?.() }}>BACK</button>
          <button
            data-testid="tq-start"
            type="button"
            className={`btn ${summaryAccepted ? 'btn-start-green' : 'btn-primary-maroon'}`}
            disabled={Object.keys(errors).length>0}
            onClick={handlePrimaryButton}
            ref={triggerBtnRef}
          >{summaryAccepted ? 'START SIMULATION' : 'VIEW SUMMARY'}</button>
        </div>
      </div>
      {showSummary && (
        <div className="summary-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="summary-modal-title" onKeyDown={(e)=>{ if(e.key==='Escape'){ e.stopPropagation(); closeSummary() } }}>
          <div className="summary-modal-panel" tabIndex={-1} ref={modalPanelRef}>
            <h2 id="summary-modal-title" className="summary-modal-head">SIMULATION SUMMARY</h2>
            <SimulationSummary
              scenario={{ id: initial?.scenarioId || 'b2b', name: (initial?.scenarioId || 'b2b').toUpperCase() }}
              distribution={{ id: initial?.distributionMethod || 'linear', name: (initial?.distributionMethod || 'linear').toUpperCase() }}
              baseTotalRecords={totalRecords}
              timing={{ durationMinutes, batchSize, startDelaySec, jitterPct, maxConcurrency }}
              playPlunk={playPlunk}
              onBack={closeSummary}
              onStart={() => {}}
              actionsHidden
              overrides={scenarioOverrides}
              extraLines={[
                pipelineId ? `Pipeline: ${pipelineId}` : null,
                selectedOwnerIds.length ? `Owners Selected: ${selectedOwnerIds.length}` : null
              ].filter(Boolean)}
            />
            <div className="summary-modal-actions">
              <button type="button" className="modal-btn modal-btn-back" onClick={closeSummary}>GO BACK</button>
              <button type="button" className="modal-btn modal-btn-accept" onClick={acceptSummary}>ACCEPT</button>
            </div>
          </div>
        </div>
      )}
      {successMessage && (
        <SuccessNotification 
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  )
}
