import React, { useRef, useEffect, useState } from 'react'

/**
 * SliderControl
 *
 * Accessible horizontal slider used as an EQ-style controller in the Timing UI.
 * It supports pointer and keyboard interactions and emits a numeric value via
 * onChange. The component intentionally keeps visuals and behavior minimal to
 * avoid external dependencies.
 *
 * Props
 *  - id: string
 *  - label: string
 *  - value: number
 *  - min/max/step: number
 *  - onChange(number): function
 *  - onPlunk(): optional tactile/audio callback
 *  - error: string (validation)
 *  - tooltip: React node (optional help trigger)
 */
export default function SliderControl({
  id,
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onPlunk,
  error,
  tooltip,
  vertical = false,
  showNormalization = false,
  ticks = null, // optional [{ value:number, label:string }]
  valueFormatter = null, // optional (value:number)=>string for badge display
  evenDistribution = false, // when true tick positions are index-based not value-scaled
  // snapToTicks removed (no snapping behavior)
  editableValue = false, // show input on click for manual edit
}) {
  const trackRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const pct = ((value - min) / (max - min)) * 100
  const normPct = Math.round(pct)

  useEffect(()=>{ if (value < min) onChange?.(min); else if (value > max) onChange?.(max) }, [value, min, max, onChange])

  const clamp = v => Math.min(max, Math.max(min, v))

  const tickValues = Array.isArray(ticks) && ticks.length ? ticks.map(t => t.value) : []

  const commit = v => {
    const snapped = clamp(Math.round(v / step) * step)
    if (snapped !== value) onChange?.(snapped)
  }

  const handleKey = (e) => {
    if (['ArrowLeft','ArrowDown','-'].includes(e.key)) { e.preventDefault(); commit(value - step) }
    else if (['ArrowRight','ArrowUp','+','='].includes(e.key)) { e.preventDefault(); commit(value + step) }
    else if (e.key === 'Home') { e.preventDefault(); commit(min) }
    else if (e.key === 'End') { e.preventDefault(); commit(max) }
  }

  const handlePointer = (e) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    let ratio
    if (vertical) {
      const y = (e.clientY || (e.touches && e.touches[0]?.clientY)) - rect.top
      ratio = 1 - (y / rect.height) // invert for vertical: top=high
    } else {
      const x = (e.clientX || (e.touches && e.touches[0]?.clientX)) - rect.left
      ratio = x / rect.width
    }
    commit(min + ratio * (max - min))
  }

  const displayed = valueFormatter ? valueFormatter(value) : value
  const ariaValueText = displayed

  const finishEdit = (apply) => {
    if (apply) {
      const numeric = Number(draft)
      if (!Number.isNaN(numeric)) commit(clamp(numeric))
    }
    setEditing(false)
  }

  const renderTicks = () => {
    if (!ticks || !ticks.length || vertical) return null
    const lastIndex = ticks.length - 1
    return (
      <div className="slider-ticks" aria-hidden="true">
        {ticks.map((t, i) => {
          const pos = evenDistribution ? (i / lastIndex) * 100 : ((t.value - min) / (max - min)) * 100
          return (
            <div key={t.value} className="slider-tick" style={{ left: pos + '%' }}>
              <div className="slider-tick-dot" />
              {t.label && <div className="slider-tick-label">{t.label}</div>}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`slider-row${error ? ' has-error' : ''}${vertical ? ' slider-vertical' : ''}`}>
      <div className="slider-label-wrap">
        <label id={`${id}-lbl`} htmlFor={`${id}-focus-proxy`} className="slider-label">{label}</label>
        {tooltip}
      </div>
      <div className="slider-shell">
        <div
          id={id}
          role="slider"
          aria-label={label}
          tabIndex={0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={ariaValueText}
          aria-labelledby={`${id}-lbl`}
          className={`slider-track${vertical ? ' vertical' : ''}`}
          ref={trackRef}
          onClick={handlePointer}
          onKeyDown={handleKey}
          onPointerDown={(e)=>{ e.preventDefault(); handlePointer(e); }}
          onTouchStart={handlePointer}
      onFocus={()=>{ /* plunk disabled for sliders */ }}
          data-testid={`${id}-slider`}
        >
          <div className="slider-fill" style={ vertical ? { height: pct + '%' } : { width: pct + '%' } } />
          <div className="slider-thumb" style={ vertical ? { bottom: pct + '%' } : { left: pct + '%' } } />
          {renderTicks()}
        </div>
        <div className="slider-value-badge" onClick={() => { if (editableValue) { setDraft(String(value)); setEditing(true) } }}>
          {editableValue && editing ? (
            <input
              data-testid={`${id}-edit`}
              autoFocus
              type="number"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={() => finishEdit(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); finishEdit(true) }
                else if (e.key === 'Escape') { e.preventDefault(); finishEdit(false) }
              }}
              style={{ width:'100%', background:'transparent', border:'none', textAlign:'center', font:'inherit', outline:'none' }}
            />
          ) : displayed}
        </div>
        {showNormalization && <div className="normalization-wrap"><div className="normalization-bar"><div className="normalization-fill" style={{ width: normPct + '%' }} /></div><div className="normalization-label">{normPct}%</div></div>}
        <div className="slider-meta">{error ? <span className="tq-err">{error}</span> : <span className="tq-ok"></span>}</div>
        {/* Focus proxy input for label association (hidden) */}
        <input id={`${id}-focus-proxy`} readOnly tabIndex={-1} aria-hidden="true" style={{ position:'absolute', width:0, height:0, opacity:0, pointerEvents:'none' }} />
      </div>
    </div>
  )
}
