import React, { useState, useId } from 'react'

/**
 * Tooltip
 *
 * Minimal, accessible tooltip for short help text. Shows on hover and focus.
 * Keep copy concise (one or two short sentences).
 */
export default function Tooltip({ text, children }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="tq-tip-wrapper" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        className="tip-icon"
        onFocus={()=>setOpen(true)}
        onBlur={()=>setOpen(false)}
      >i</button>
      {open && (
        <span role="tooltip" id={id} className="tip-bubble">{text}</span>
      )}
      {children}
    </span>
  )
}
