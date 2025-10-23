import React, { useEffect, useState } from 'react'
import { Themes } from './themes'

// Theme selection page: 3 rows x 4 columns grid mirroring SaaS tile styling.
export default function ThemeSelection({ onSelect, onBack, playPlunk }) {
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => { playPlunk?.() /* fire entry sfx */ }, [])

  const handleSelect = (theme) => {
    setSelectedId(theme.id)
    playPlunk?.()
    onSelect?.(theme)
  }

  return (
    <div className="theme-select-page" role="main" aria-labelledby="theme-title">
      <h1 id="theme-title" className="saas-select-title">THEME SELECTION</h1>
      <p className="theme-back-wrap"><button type="button" className="hs-back-btn" onClick={() => { playPlunk?.(); onBack?.() }}>← Back to SaaS Selection</button></p>
      <div className="theme-grid" aria-label="Theme options">
        {Themes.map(t => {
          const isActive = t.id === selectedId
          return (
            <button
              key={t.id}
              type="button"
              className={`saas-tile${isActive ? ' is-active' : ''}`}
              data-theme={t.id}
              onClick={() => handleSelect(t)}
              aria-pressed={isActive}
              aria-label={`Select theme ${t.name}`}
            >
              <span className="saas-tile-name" style={{ textAlign:'center' }}>{t.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
