import React, { useEffect, useState, useRef } from 'react'

export default function SimulationProgress({ simulationId, onBack, playPlunk }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    playPlunk?.()
    function fetchStatus() {
      fetch(`/api/simulations/${simulationId}`)
        .then(r => r.json())
        .then(json => {
          if (!json.ok) throw new Error(json.error || 'status error')
          setData(json.simulation)
          if (json.simulation.status === 'COMPLETED' || json.simulation.status === 'FAILED') {
            if (timerRef.current) clearInterval(timerRef.current)
          }
        })
        .catch(e => setError(e.message))
    }
    fetchStatus()
    timerRef.current = setInterval(fetchStatus, 2500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [simulationId, playPlunk])

  const pct = data ? Math.min(100, Math.round((data.records_processed / data.total_records) * 100)) : 0

  return (
    <div className="simulation-progress" role="main" aria-live="polite">
      <h1 className="saas-select-title">SIMULATION PROGRESS</h1>
      <p className="scenario-back-wrap"><button type="button" className="hs-back-btn" onClick={() => { playPlunk?.(); onBack?.() }}>← Back</button></p>
      {!data && !error && <p>Loading status...</p>}
      {error && <p className="error-text">Error: {error}</p>}
      {data && (
        <div className="progress-panel">
          <p><strong>ID:</strong> {data.id}</p>
          <p><strong>Status:</strong> {data.status}</p>
          <p><strong>Processed:</strong> {data.records_processed} / {data.total_records} ({pct}%)</p>
          <div className="progress-bar-shell" aria-label="Progress bar">
            <div className="progress-bar-fill" style={{ width: pct + '%' }} />
          </div>
          {data.status === 'COMPLETED' && <p className="success-text">Simulation complete.</p>}
        </div>
      )}
    </div>
  )
}
