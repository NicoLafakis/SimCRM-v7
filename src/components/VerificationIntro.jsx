import React from 'react'

export default function VerificationIntro({ onStart, onBack }) {
  return (
    <div className="landing verification-intro">
      <div className="verification-card">
        <h1>Human Checkpoint</h1>
        <p className="intro-blurb">
          To keep the simulation free from bots, every new operator must clear <strong>one single line</strong> in our
          retro Tetris cabinet.
        </p>
        <section className="intro-section">
          <h2>How to play</h2>
          <ul className="intro-list">
            <li>Pieces fall one row at a time. Build a solid horizontal line to clear it.</li>
            <li>Only one line is required. Clear it and you are verified instantly.</li>
            <li>If the pieces stack to the top, you can restart the run.</li>
          </ul>
        </section>
        <section className="intro-section">
          <h2>Controls</h2>
          <div className="controls-grid">
            <div className="control-item">
              <span className="control-key">↑</span>
              <span>Rotate piece</span>
            </div>
            <div className="control-item">
              <span className="control-key">←</span>
              <span>Move left</span>
            </div>
            <div className="control-item">
              <span className="control-key">↓</span>
              <span>Soft drop</span>
            </div>
            <div className="control-item">
              <span className="control-key">→</span>
              <span>Move right</span>
            </div>
            <div className="control-item full">
              <span className="control-key">🕹️</span>
              <span>Touch users can tap the on-screen gamepad.</span>
            </div>
          </div>
        </section>
        <div className="intro-actions">
          <button className="btn btn-secondary" type="button" onClick={onBack}>Back</button>
          <button className="btn btn-primary" type="button" onClick={onStart}>
            Launch Tetris Challenge
          </button>
        </div>
      </div>
      <footer className="site-footer">©️2025 Black Maige. Game the simulation.</footer>
    </div>
  )
}
