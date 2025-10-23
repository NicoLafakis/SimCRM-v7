import React, { useState } from 'react'

export default function ConfirmButton({ onConfirm, children, confirmText = 'Confirm', disabled = false }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <span>
        <button onClick={() => { setConfirming(false); onConfirm() }} disabled={disabled}>{confirmText}</button>
        <button onClick={() => setConfirming(false)} style={{ marginLeft:8 }}>Cancel</button>
      </span>
    )
  }
  return <button onClick={() => setConfirming(true)} disabled={disabled}>{children}</button>
}
