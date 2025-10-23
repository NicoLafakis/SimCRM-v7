import React, { useEffect, useState } from 'react'
import ConfirmButton from './ConfirmButton'

export default function BossDashboard({ user, onExit }) {
  const [tab, setTab] = useState('dlq')
  const [dlqSummary, setDlqSummary] = useState({ loading: true, sims: [] })
  const [thinning, setThinning] = useState({ loading: false, events: [], simulationId: '' })
  const [selectedSim, setSelectedSim] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user || user.role !== 'boss') return
    let cancelled = false
    const load = async () => {
      setDlqSummary(s => ({ ...s, loading: true }))
      try {
        const r = await fetch('/api/dlq/summary')
        const j = await r.json()
        if (!cancelled) setDlqSummary({ loading: false, sims: j.simulations || [] })
      } catch (e) {
        if (!cancelled) setDlqSummary({ loading: false, sims: [] })
      }
    }
    load()
    const id = setInterval(load, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [user?.id, user?.role])

  const loadThinning = async (simId) => {
    if (!simId) return
    setThinning(t => ({ ...t, loading: true, simulationId: simId }))
    try {
      const r = await fetch(`/api/simulations/${simId}/thinning-events`)
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'failed')
      setThinning({ loading: false, simulationId: simId, events: j.events || [] })
    } catch (e) {
      setError(e.message)
      setThinning(t => ({ ...t, loading: false }))
    }
  }

  if (!user || user.role !== 'boss') {
    return (
      <div style={{ padding: 40 }}>
        <h2>Access Restricted</h2>
        <p>You are not a boss. This panel is limited to operator roles.</p>
        <button onClick={onExit}>Back</button>
      </div>
    )
  }

  const palette = {
    bg: '#e8e8e8', frame: '#6c7b7f', shell: '#8a8a8a', screen: '#8fbc8f', btn: '#8b0000', text: '#2d3e2d', title: '#1e3a5f'
  }

  return (
    <div style={{ display:'flex', height: 'calc(100vh - 40px)', background: palette.bg, color: palette.text, fontFamily: '"Press Start 2P", monospace' }}>
      <aside style={{ width: 260, borderRight: '4px solid '+palette.frame, padding: 16 }}>
        <h2 style={{ color: palette.title, fontSize: 14, lineHeight: '18px' }}>Boss Console</h2>
        <nav style={{ marginTop: 12, display:'flex', flexDirection:'column', gap: 8 }}>
          <button style={navBtnStyle(tab==='dlq', palette)} onClick={()=>setTab('dlq')}>DLQ</button>
          <button style={navBtnStyle(tab==='thin', palette)} onClick={()=>setTab('thin')}>Thinning</button>
          <button style={navBtnStyle(tab==='metrics', palette)} onClick={()=>setTab('metrics')}>Metrics</button>
          <button style={navBtnStyle(tab==='help', palette)} onClick={()=>setTab('help')}>Help</button>
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <button style={exitBtnStyle(palette)} onClick={onExit}>Exit</button>
        </div>
      </aside>
      <main style={{ flex:1, padding: 16 }}>
        {tab === 'dlq' && (
          <DLQPanel summary={dlqSummary} palette={palette} />
        )}
        {tab === 'thin' && (
          <ThinningPanel palette={palette} thinning={thinning} selectedSim={selectedSim} setSelectedSim={setSelectedSim} onLoad={loadThinning} dlqSummary={dlqSummary} />
        )}
        {tab === 'metrics' && (
          <div>
            <MetricsPanel palette={palette} />
            <HubSpotReadinessPanel palette={palette} />
          </div>
        )}
        {tab === 'help' && (
          <HelpPanel palette={palette} />
        )}
        {error && <div style={{ marginTop:12, color:'#8b0000' }}>Error: {error}</div>}
      </main>
    </div>
  )
}

function navBtnStyle(active, palette) {
  return {
    background: active ? palette.shell : palette.screen,
    border: '3px solid '+palette.frame,
    padding: '8px 6px',
    fontSize: 10,
    cursor: 'pointer',
    textAlign: 'left',
    color: palette.text,
    boxShadow: active ? '2px 2px 0 '+palette.frame : 'none'
  }
}
function exitBtnStyle(palette){
  return { background: palette.btn, color: '#fff', border: '4px solid '+palette.frame, padding: '10px 12px', fontSize: 10, cursor:'pointer', width:'100%', marginTop:24 }
}

function DLQPanel({ summary, palette }) {
  const [activeSim, setActiveSim] = React.useState('')
  const [form, setForm] = React.useState({ categories: '', limit: 10, maxPerCategory: '', strategy: 'oldest', dryRun: true, useFullRetry: false })
  const [result, setResult] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState('')

  if (summary.loading) return <div>Loading DLQ summary...</div>
  if (!summary.sims.length) return <div>No DLQ data.</div>

  const onReplay = async () => {
    if (!activeSim) return
    setLoading(true); setErr(''); setResult(null)
    try {
      const cats = form.categories.split(',').map(c=>c.trim()).filter(Boolean)
      const body = { categories: cats, limit: parseInt(form.limit,10), dryRun: form.dryRun, strategy: form.strategy }
      if (form.maxPerCategory) body.maxPerCategory = parseInt(form.maxPerCategory,10)
      if (!form.dryRun && form.useFullRetry) body.useFullRetry = true
      const r = await fetch(`/api/simulations/${activeSim}/dlq/replay`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'replay failed')
      setResult(j)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h3 style={{ color: palette.title, fontSize:12 }}>Dead Letter Queues</h3>
      <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', marginTop:8 }}>
        <thead>
          <tr style={{ background: palette.shell }}>
            <th style={thStyle}>Select</th>
            <th style={thStyle}>Simulation</th>
            <th style={thStyle}>Categories</th>
            <th style={thStyle}>Total</th>
          </tr>
        </thead>
        <tbody>
          {summary.sims.map(s => {
            const cats = Object.entries(s.counts).map(([k,v])=>`${k}:${v}`).join(' ')
            const total = Object.values(s.counts).reduce((a,b)=>a+parseInt(b,10),0)
            const selected = activeSim === s.simulationId
            return (
              <tr key={s.simulationId} style={{ background:selected ? palette.screen : '#fff' }}>
                <td style={tdStyle}><input type='radio' checked={selected} onChange={()=>setActiveSim(s.simulationId)} /></td>
                <td style={tdStyle}>{s.simulationId.slice(0,8)}</td>
                <td style={tdStyle}>{cats}</td>
                <td style={tdStyle}>{total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ marginTop:12, padding:8, border:'3px solid '+palette.frame, background: palette.shell }}>
        <h4 style={{ margin:0, fontSize:11, color: palette.title }}>Replay Controls</h4>
        {!activeSim && <div style={{ fontSize:10, marginTop:6 }}>Select a simulation above.</div>}
        {activeSim && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:8, marginTop:8, fontSize:10 }}>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>Categories
              <input value={form.categories} onChange={e=>setForm(f=>({...f,categories:e.target.value}))} placeholder="comma list" style={inpStyle(palette)} />
            </label>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>Limit
              <input type='number' value={form.limit} onChange={e=>setForm(f=>({...f,limit:e.target.value}))} style={inpStyle(palette)} />
            </label>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>Max/Category
              <input type='number' value={form.maxPerCategory} onChange={e=>setForm(f=>({...f,maxPerCategory:e.target.value}))} style={inpStyle(palette)} />
            </label>
            <label style={{ display:'flex', flexDirection:'column', gap:4 }}>Strategy
              <select value={form.strategy} onChange={e=>setForm(f=>({...f,strategy:e.target.value}))} style={inpStyle(palette)}>
                <option value='oldest'>oldest</option>
                <option value='newest'>newest</option>
                <option value='random'>random</option>
              </select>
            </label>
            <label style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:4, marginTop:4 }}>Dry Run
              <input type='checkbox' checked={form.dryRun} onChange={e=>setForm(f=>({...f,dryRun:e.target.checked, useFullRetry: e.target.checked ? false : f.useFullRetry}))} />
            </label>
            <label style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:4, marginTop:4 }} title='Applies full retry profile to replayed jobs (unsafe for broad validation errors)'>Full Retry
              <input type='checkbox' checked={form.useFullRetry} disabled={form.dryRun} onChange={e=>setForm(f=>({...f,useFullRetry:e.target.checked}))} />
            </label>
            <div style={{ display:'flex', alignItems:'center' }}>
              <button onClick={onReplay} disabled={loading} style={{ ...inpStyle(palette), cursor:'pointer', background: palette.btn, color:'#fff' }}>{loading? 'Running...' : (form.dryRun ? 'Dry Run' : 'Execute')}</button>
            </div>
          </div>
        )}
        {err && <div style={{ fontSize:10, color:'#8b0000', marginTop:6 }}>Error: {err}</div>}
        {result && (
          <div style={{ marginTop:8, fontSize:10 }}>
            <strong>Result:</strong> selected {result.selection?.chosen} of {result.selection?.totalCandidates}; replayed {result.replayed}
            <div>Categories: {Object.entries(result.selection?.byCategory||{}).map(([k,v])=>`${k}:${v}`).join(' ') || 'n/a'}</div>
            {result.useFullRetry && !result.dryRun && <div style={{ color: palette.title }}>Full retry active</div>}
          </div>
        )}
      </div>
      <p style={{ fontSize:9, marginTop:8 }}>Tip: always dry-run before executing real replay; enable Full Retry only for transient categories (e.g., rate_limit, network).</p>
    </div>
  )
}

function ThinningPanel({ thinning, onLoad, selectedSim, setSelectedSim, dlqSummary, palette }) {
  const sims = dlqSummary.sims
  return (
    <div>
      <h3 style={{ color: palette.title, fontSize:12 }}>Adaptive Thinning Events</h3>
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
        <label style={{ fontSize:10 }}>Simulation:</label>
        <select value={selectedSim} onChange={e=>{ setSelectedSim(e.target.value); onLoad(e.target.value) }} style={{ fontSize:10, padding:4, background: palette.screen, border:'3px solid '+palette.frame }}>
          <option value="">-- select --</option>
          {sims.map(s => <option key={s.simulationId} value={s.simulationId}>{s.simulationId.slice(0,8)}</option>)}
        </select>
        <button onClick={()=>onLoad(selectedSim)} style={{ fontSize:10, padding:'6px 8px', border:'3px solid '+palette.frame, background: palette.shell }}>Refresh</button>
      </div>
      {thinning.loading && <div>Loading events...</div>}
      {!thinning.loading && thinning.events.length === 0 && <div style={{ fontSize:10 }}>No events.</div>}
      {!thinning.loading && thinning.events.length > 0 && (
        <table style={{ width:'100%', fontSize:9, borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background: palette.shell }}>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>RecIdx</th>
              <th style={thStyle}>Before</th>
              <th style={thStyle}>After</th>
              <th style={thStyle}>Factor</th>
              <th style={thStyle}>Backlog</th>
            </tr>
          </thead>
          <tbody>
            {thinning.events.map((e,i)=>(
              <tr key={i} style={{ background:'#fff' }}>
                <td style={tdStyle}>{new Date(e.ts).toLocaleTimeString()}</td>
                <td style={tdStyle}>{e.recordIndex}</td>
                <td style={tdStyle}>{e.before}</td>
                <td style={tdStyle}>{e.after}</td>
                <td style={tdStyle}>{e.factor}</td>
                <td style={tdStyle}>{e.totalWaiting}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function HelpPanel({ palette }) {
  return (
    <div>
      <h3 style={{ color: palette.title, fontSize:12 }}>Help & Notes</h3>
      <ul style={{ fontSize:10, lineHeight:'16px' }}>
        <li>DLQ updates every 8s.</li>
        <li>Thinning events retained last 200 per simulation.</li>
        <li>Replay actions require selecting target simulation (coming soon).</li>
      </ul>
    </div>
  )
}

function MetricsPanel({ palette }) {
  const [text, setText] = React.useState('')
  const [ts, setTs] = React.useState(null)
  const [err, setErr] = React.useState('')
  const load = async () => {
    setErr('')
    try {
      const r = await fetch('/metrics')
      if (!r.ok) throw new Error('metrics fetch failed')
      const t = await r.text()
      setText(t.slice(0,8000)) // cap
      setTs(new Date())
    } catch (e) { setErr(e.message) }
  }
  React.useEffect(()=>{ load(); const id = setInterval(load, 15000); return ()=>clearInterval(id) },[])
  return (
    <div>
      <h3 style={{ color: palette.title, fontSize:12 }}>Prometheus Metrics</h3>
      <div style={{ fontSize:10, marginBottom:8 }}>Auto-refresh 15s. Shows first 8KB.</div>
      <button onClick={load} style={{ ...inpStyle(palette), width:'auto', cursor:'pointer', background: palette.shell }}>Refresh</button>
      {ts && <span style={{ fontSize:9, marginLeft:8 }}>Last: {ts.toLocaleTimeString()}</span>}
      {err && <div style={{ fontSize:10, color:'#8b0000', marginTop:6 }}>Error: {err}</div>}
      <pre style={{ marginTop:8, maxHeight:300, overflow:'auto', background:'#fff', padding:8, border:'3px solid '+palette.frame, fontSize:9 }}>{text || 'No data yet.'}</pre>
      <p style={{ fontSize:9, marginTop:6 }}>If this remains empty, exporter may be disabled (set METRICS_PROM_ENABLED=1) or running on another port.</p>
    </div>
  )
}

const thStyle = { padding:'4px 6px', border:'1px solid #6c7b7f' }
const tdStyle = { padding:'4px 6px', border:'1px solid #6c7b7f', verticalAlign:'top' }
function inpStyle(palette){
  return { background: palette.screen, border:'3px solid '+palette.frame, padding:4, fontSize:10, width:'100%' }
}

function HubSpotReadinessPanel({ palette }) {
  const [data, setData] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [assocRunning, setAssocRunning] = React.useState(false)
  const [assocResult, setAssocResult] = React.useState(null)

  const load = async () => {
    setLoading(true); setAssocResult(null)
    try {
      const r = await fetch('/api/boss/hubspot-readiness')
      const j = await r.json()
      setData(j)
    } catch (e) { setData({ error: e.message }) }
    setLoading(false)
  }
  React.useEffect(()=>{ load(); const id = setInterval(load, 15000); return ()=>clearInterval(id) }, [])

  const runAssocTest = async () => {
    setAssocRunning(true); setAssocResult(null)
    try {
      const r = await fetch('/api/boss/hubspot-association-test', { method: 'POST' })
      const j = await r.json()
      setAssocResult(j)
    } catch (e) { setAssocResult({ error: e.message }) }
    setAssocRunning(false)
    load()
  }

  return (
    <div style={{ marginTop:12, padding:12, border:'3px solid '+palette.frame, background: '#fff' }}>
      <h4 style={{ margin:0, fontSize:12, color: palette.title }}>HubSpot Readiness</h4>
      <div style={{ fontSize:10, marginTop:8 }}>
        <button onClick={load} style={{ ...inpStyle(palette), width:'auto', cursor:'pointer' }}>{loading ? 'Checking...' : 'Refresh'}</button>
        <span style={{ marginLeft:12, fontSize:10 }}>{data ? `Last: ${new Date(data.timestamp||Date.now()).toLocaleTimeString()}` : ''}</span>
      </div>
      {!data && <div style={{ marginTop:8, fontSize:10 }}>No data yet.</div>}
      {data && data.checks && Object.keys(data.checks).map(k => (
        <div key={k} style={{ marginTop:8, fontSize:10 }}>
          <strong>{k}</strong>: {data.checks[k].listStatus ? `list ${data.checks[k].listStatus}` : (data.checks[k].error || 'no-data')}
          <div style={{ marginLeft:8 }}>
            {(data.checks[k].pipelines || []).map(p => (
              <div key={p.pipelineId} style={{ fontSize:10 }}>- {p.pipelineId}: {p.stagesStatus ? `stages ${p.stagesStatus} (${p.stageCount})` : (p.error || '')}</div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ marginTop:12 }}>
        <ConfirmButton onConfirm={runAssocTest} confirmText='Run Test' disabled={assocRunning}>{assocRunning ? 'Running Association Test...' : 'Run Association Test'}</ConfirmButton>
      </div>
      {assocResult && <pre style={{ marginTop:8, maxHeight:240, overflow:'auto', background:'#f8f8f8', padding:8 }}>{JSON.stringify(assocResult, null, 2)}</pre>}
    </div>
  )
}

