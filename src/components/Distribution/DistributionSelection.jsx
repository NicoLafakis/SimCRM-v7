import React, { useState, useEffect } from 'react'
import { DistributionMethods } from './distributionOptions'

// 3x3 distribution selection; CUSTOM tile sits at middle index (4)
export default function DistributionSelection({ onSelect, onBack, playPlunk }) {
  const [active, setActive] = useState(null)

  useEffect(() => { playPlunk?.() }, [])

  function handleSelect(method) {
    setActive(method.id)
    playPlunk?.()
    onSelect?.(method)
  }

  return (
    <div className="distribution-select-page" role="main" aria-labelledby="distribution-title">
      <h1 id="distribution-title" className="saas-select-title">SELECT A DISTRIBUTION METHOD</h1>
      <p className="distribution-back-wrap"><button type="button" className="hs-back-btn" onClick={() => { playPlunk?.(); onBack?.() }}>← Back to Theme Selection</button></p>
      <div className="distribution-grid" aria-label="Distribution methods">
        {DistributionMethods.map((m, idx) => {
          const isActive = m.id === active
          const extra = m.id === 'custom' ? ' dist-custom' : ''
          return (
            <button
              key={m.id}
              type="button"
              className={`saas-tile dist-tile${isActive ? ' is-active' : ''}${extra}`}
              data-dist={m.id}
              onClick={() => handleSelect(m)}
              aria-pressed={isActive}
              aria-label={`Select distribution ${m.name}`}
            >
              <span className="saas-tile-name" style={{ textAlign:'center' }}>{m.name}</span>
              <span className="dist-desc" aria-hidden="true">{m.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
