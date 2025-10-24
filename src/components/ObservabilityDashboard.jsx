import React, { useEffect, useState, useRef } from 'react'

// Simple observability dashboard (Phase 5)
// Polls metrics summary + per-simulation metrics for a focused simulation.
// Palette & typography follow global rules.

const palette = {
  bg: '#e8e8e8', frame: '#6c7b7f', shell: '#8a8a8a', screen: '#8fbc8f', btn: '#8b0000', text: '#2d3e2d', title: '#1e3a5f'
}

export default function ObservabilityDashboard({ onExit, focusSimulationId }) {
  const [summary, setSummary] = useState({ loading: true, sims: [] })
  const [selected, setSelected] = useState(focusSimulationId || '')
  const [detail, setDetail] = useState({ loading: false, data: null })
  const [error, setError] = useState('')
  const [mode, setMode] = useState('table')
  const sseRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('/api/metrics/summary')
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'summary failed')
        if (!cancelled) setSummary({ loading:false, sims: j.simulations || [] })
      } catch (e) {
        if (!cancelled) { setSummary({ loading:false, sims: [] }); setError(e.message) }
      }
    }
    load()
    const id = setInterval(load, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    if (!selected) return
    setDetail(d => ({ ...d, loading: true }))
    let cancelled = false
    const loadDetail = async () => {
      try {
        const r = await fetch(`/api/simulations/${selected}/metrics`)
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'metrics failed')
        if (!cancelled) setDetail({ loading:false, data: j })
      } catch (e) {
        if (!cancelled) { setDetail({ loading:false, data:null }); setError(e.message) }
      }
    }
    loadDetail()
    const id = setInterval(loadDetail, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [selected])

  // Optional SSE for finer-grained updates when focused
  useEffect(() => {
    if (!selected) return
    try {
      const es = new EventSource(`/api/simulations/${selected}/stream`)
      sseRef.current = es
      es.addEventListener('metrics', ev => {
        try {
          const payload = JSON.parse(ev.data)
          setDetail({ loading:false, data: { simulationId: selected, metrics: payload.metrics, percentComplete: payload.percentComplete, status: payload.status, finished_at: payload.finished_at } })
        } catch {}
      })
      es.addEventListener('terminal', () => {
        // Leave SSE open a bit longer then close
        setTimeout(()=>{ es.close() }, 3000)
      })
      return () => { es.close() }
    } catch {}
  }, [selected])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background: palette.bg, color: palette.text, fontFamily:'"Press Start 2P", monospace' }}>
      <header style={{ padding:12, borderBottom:'4px solid '+palette.frame, background: palette.shell, display:'flex', alignItems:'center', gap:16 }}>
        <h1 style={{ fontSize:14, margin:0, color: palette.title }}>Observability</h1>
        <button onClick={onExit} style={btnStyle}>Exit</button>
        <div style={{ marginLeft:'auto', fontSize:10 }}>Mode:
          <select value={mode} onChange={e=>setMode(e.target.value)} style={{ marginLeft:6, fontSize:10, background: palette.screen, border:'3px solid '+palette.frame }}>
            <option value='table'>Table</option>
            <option value='bars'>Bars</option>
          </select>
        </div>
      </header>
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <aside style={{ width:300, borderRight:'4px solid '+palette.frame, padding:12, overflowY:'auto' }}>
          <h2 style={{ fontSize:12, margin:'4px 0', color: palette.title }}>Simulations</h2>
          {summary.loading && <div style={{ fontSize:10 }}>Loading...</div>}
          {!summary.loading && summary.sims.map(s => {
            const selectedRow = selected === s.simulationId
            const m = s.metrics || {}
            return (
              <div key={s.simulationId} onClick={()=>setSelected(s.simulationId)} style={{ cursor:'pointer', padding:6, marginBottom:6, background: selectedRow ? palette.screen : '#fff', border:'3px solid '+palette.frame, fontSize:9 }}>
                <div><strong>{s.simulationId.slice(0,8)}</strong> {Math.round((s.percentComplete||0)*100)}% <span style={{ color: palette.title }}>{s.status}</span></div>
                <div style={{ marginTop:2 }}>RL:{m.rate_limit_hits||0} R:{m.retries_total||0} F:{(m.create_failures||0)+(m.secondary_failures||0)}</div>
              </div>
            )
          })}
        </aside>
        <main style={{ flex:1, padding:16, overflowY:'auto' }}>
          {!selected && <div style={{ fontSize:12 }}>Select a simulation.</div>}
          {selected && detail.loading && <div style={{ fontSize:12 }}>Loading metrics...</div>}
          {selected && !detail.loading && detail.data && (
            <div>
              <h2 style={{ fontSize:12, color: palette.title, margin:'4px 0 12px' }}>Simulation {selected.slice(0,8)} Detail</h2>
              <ProgressBar percent={detail.data.percentComplete || 0} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginTop:16 }}>
                {renderStat('Records', `${detail.data.metrics.records_processed||0} / ${detail.data.metrics.total_records||0}`)}
                {renderStat('Avg Latency ms', detail.data.metrics.avg_contact_latency_ms || 0)}
                {renderStat('Rate Limit Hits', detail.data.metrics.rate_limit_hits || 0)}
                {renderStat('RL Delay ms', detail.data.metrics.rate_limit_total_delay_ms || 0)}
                {renderStat('RL Sched Delay ms', detail.data.metrics.rate_limit_scheduled_delay_ms || 0)}
                {renderStat('Retries', detail.data.metrics.retries_total || 0)}
                {renderStat('Failures (create)', detail.data.metrics.create_failures || 0)}
                {renderStat('Failures (secondary)', detail.data.metrics.secondary_failures || 0)}
                {renderStat('Idem Skipped', detail.data.metrics.idempotency_skipped || 0)}
              </div>
              {detail.data.aiGeneration && (
                <div style={{ marginTop:24 }}>
                  <h3 style={{ fontSize:11, color: palette.title, margin:'0 0 12px' }}>AI Generation Health</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
                    {renderAIStat('Success Rate', detail.data.aiGeneration.successRate ? (parseFloat(detail.data.aiGeneration.successRate) * 100).toFixed(1) + '%' : 'N/A', detail.data.aiGeneration.successRate >= 0.95 ? 'good' : detail.data.aiGeneration.successRate >= 0.8 ? 'warn' : 'error')}
                    {renderAIStat('AI Success', detail.data.aiGeneration.successCount || 0, 'neutral')}
                    {renderAIStat('Fallback', detail.data.aiGeneration.fallbackCount || 0, detail.data.aiGeneration.fallbackCount > 0 ? 'warn' : 'good')}
                    {renderAIStat('Avg Latency', detail.data.aiGeneration.avgLatencyMs ? detail.data.aiGeneration.avgLatencyMs + ' ms' : 'N/A', 'neutral')}
                    {renderAIStat('Total Tokens', detail.data.aiGeneration.totalTokens || 0, 'neutral')}
                    {renderAIStat('Est. Cost', detail.data.aiGeneration.estimatedCost || '$0.00', 'neutral')}
                  </div>
                  {detail.data.aiGeneration.lastErrorCategory && (
                    <div style={{ marginTop:12, padding:8, background:'#ffcc00', border:'3px solid '+palette.frame, fontSize:9 }}>
                      Last Error: {detail.data.aiGeneration.lastErrorCategory}
                    </div>
                  )}
                </div>
              )}
              {mode === 'bars' && (
                <div style={{ marginTop:20 }}>
                  <h3 style={{ fontSize:11, color: palette.title, margin:'0 0 8px' }}>Bar View</h3>
                  <BarRow label='Rate Limit Hits' value={detail.data.metrics.rate_limit_hits||0} max={maxCandidate(detail.data.metrics)} />
                  <BarRow label='Retries' value={detail.data.metrics.retries_total||0} max={maxCandidate(detail.data.metrics)} />
                  <BarRow label='Failures' value={(detail.data.metrics.create_failures||0)+(detail.data.metrics.secondary_failures||0)} max={maxCandidate(detail.data.metrics)} />
                  <BarRow label='Idem Skipped' value={detail.data.metrics.idempotency_skipped||0} max={maxCandidate(detail.data.metrics)} />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      {error && <div style={{ padding:8, fontSize:10, background: '#8b0000', color:'#fff' }}>Error: {error}</div>}
    </div>
  )
}

function renderStat(label, value) {
  return (
    <div style={{ background:'#fff', border:'3px solid '+palette.frame, padding:8, fontSize:9 }}>
      <div style={{ color: palette.title, fontSize:9 }}>{label}</div>
      <div style={{ marginTop:4, fontSize:11 }}>{value}</div>
    </div>
  )
}

function renderAIStat(label, value, status) {
  const statusColors = {
    good: '#4caf50',
    warn: '#ffaa00',
    error: '#ff4444',
    neutral: palette.text
  }
  const bgColors = {
    good: '#e8f5e9',
    warn: '#fff8e1',
    error: '#ffebee',
    neutral: '#fff'
  }
  return (
    <div style={{ background: bgColors[status] || '#fff', border:'3px solid '+palette.frame, padding:8, fontSize:9 }}>
      <div style={{ color: palette.title, fontSize:9 }}>{label}</div>
      <div style={{ marginTop:4, fontSize:11, color: statusColors[status] || palette.text, fontWeight: status !== 'neutral' ? 'bold' : 'normal' }}>{value}</div>
    </div>
  )
}

function ProgressBar({ percent }) {
  const p = Math.min(Math.max(percent,0),1)
  return (
    <div style={{ border:'4px solid '+palette.frame, background: palette.shell, height:24, position:'relative' }}>
      <div style={{ position:'absolute', top:0, left:0, bottom:0, width:(p*100)+'%', background: palette.screen }} />
      <div style={{ position:'relative', zIndex:2, textAlign:'center', lineHeight:'24px', fontSize:10 }}>{Math.round(p*100)}%</div>
    </div>
  )
}

function maxCandidate(m) {
  return Math.max(1, m.rate_limit_hits||0, m.retries_total||0, (m.create_failures||0)+(m.secondary_failures||0), m.idempotency_skipped||0)
}

function BarRow({ label, value, max }) {
  const widthPct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ fontSize:9, marginBottom:2 }}>{label}: {value}</div>
      <div style={{ height:16, border:'3px solid '+palette.frame, background: palette.shell, position:'relative' }}>
        <div style={{ position:'absolute', top:0, left:0, bottom:0, width: widthPct+'%', background: palette.btn }} />
      </div>
    </div>
  )
}

const btnStyle = { background: palette.btn, color:'#fff', border:'4px solid '+palette.frame, padding:'6px 10px', fontSize:10, cursor:'pointer' }
