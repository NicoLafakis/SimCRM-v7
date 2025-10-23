import React, { useEffect, useState } from 'react'
import { Scenarios } from './scenarioOptions'

export default function ScenarioSelection({ onSelect, onBack, playPlunk }) {
  const [active, setActive] = useState(null)
  useEffect(() => { playPlunk?.() }, [])

  function choose(scn) {
    setActive(scn.id)
    playPlunk?.()
    onSelect?.(scn)
  }

  return (
    <div className="scenario-select-page" role="main" aria-labelledby="scenario-title">
      <h1 id="scenario-title" className="saas-select-title">CHOOSE YOUR SCENARIO</h1>
      <p className="scenario-back-wrap"><button type="button" className="hs-back-btn" onClick={() => { playPlunk?.(); onBack?.() }}>← Back to Distribution Selection</button></p>
      <div className="scenario-grid" aria-label="Scenario options">
        {Scenarios.map(s => {
          const isActive = s.id === active
          return (
            <button
              key={s.id}
              type="button"
              className={`saas-tile scenario-tile${isActive ? ' is-active' : ''}`}
              onClick={() => choose(s)}
              aria-pressed={isActive}
              aria-label={`Select scenario ${s.name}`}
              data-scenario={s.id}
            >
              <span className="saas-tile-name" style={{ textAlign:'center' }}>{s.name}</span>
              <span className="scenario-desc" aria-hidden="true">{s.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
