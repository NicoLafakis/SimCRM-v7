import React from 'react'

export default function GamepadControls({ onLeft, onRight, onRotate, onHardDrop }) {
  return (
    <div className="tetris-gamepad" aria-hidden="false" role="group" aria-label="Touch controls">
      <div className="pad-left">
        <button type="button" className="pad-btn" onClick={onLeft}>
          ←
        </button>
        <button type="button" className="pad-btn" onClick={onRotate}>
          ↻
        </button>
        <button type="button" className="pad-btn" onClick={onHardDrop}>↓</button>
        <button type="button" className="pad-btn" onClick={onRight}>
          →
        </button>
      </div>
    </div>
  )
}
