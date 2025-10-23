import React, { useEffect, useState } from 'react'
import { SaaSCategories, getAppsByCategory } from './apps'

// SaaS selection grid used after verification. Provides internal highlight state
// but also fires onSelect upward for future navigation / simulation start.
export default function SaaSSelection({ onSelect, playPlunk }) {
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    playPlunk?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelect = (app) => {
    setSelectedId(app.id)
    playPlunk?.()
    onSelect?.(app)
  }

  return (
    <div className="saas-select-page" role="main" aria-labelledby="saas-title">
      <h1 id="saas-title" className="saas-select-title">SELECT A SAAS TOOL</h1>
      <div className="saas-groups">
        {SaaSCategories.map(cat => (
          <section key={cat.id} className="saas-group" aria-labelledby={`group-${cat.id}`}> 
            <h2 id={`group-${cat.id}`} className="saas-group-title">{cat.label}</h2>
            <div className="saas-grid">
              {getAppsByCategory(cat.id).map(app => {
                const isActive = app.id === selectedId
                return (
                  <button
                    key={app.id}
                    type="button"
                    className={`saas-tile${isActive ? ' is-active' : ''}`}
                    data-app={app.slug}
                    onClick={() => handleSelect(app)}
                    aria-pressed={isActive}
                    aria-label={`Select ${app.name}`}
                  >
                    <span className="saas-tile-icon" aria-hidden="true">{app.icon || '⚙︎'}</span>
                    <span className="saas-tile-name">{app.name}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}