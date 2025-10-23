import React, { useEffect, useRef } from 'react'
import { useAudio } from '../audio/AudioContext'

// Collapsible 8-bit styled audio player (initial shell only)
export default function BoomboxPlayer() {
  const audio = useAudio()
  if (!audio) return null
  const { expanded, toggleExpanded, isPlaying, togglePlay, track, volume, changeVolume, next, prev, playlist, index, muted, toggleMute, pinned, togglePinned, time, duration } = audio

  const viewportRef = useRef(null)
  const trackRef = useRef(null)

  // Measure track text width vs viewport to decide if we need scrolling and set distance/duration
  useEffect(() => {
    if (!expanded) return; // only when visible
    const el = trackRef.current
    const vp = viewportRef.current
    if (!el || !vp) return

    const apply = () => {
      // Reset any prior animation class to re-trigger
      el.classList.remove('scrolling')
      el.style.removeProperty('--scroll-distance')
      el.style.removeProperty('--scroll-duration')

      // Force reflow so removing class takes effect before re-adding (ensures restart)
      void el.offsetWidth
      const textWidth = el.scrollWidth
      const viewportWidth = vp.clientWidth
      const distance = textWidth - viewportWidth
      if (distance > 0) {
        // Scroll distance so last letter becomes flush right at end state
        el.style.setProperty('--scroll-distance', distance + 'px')
        // Speed ~40px/sec with bounds 6s-28s
        const duration = Math.min(28, Math.max(6, distance / 40))
        el.style.setProperty('--scroll-duration', duration + 's')
        // Defer adding class to next frame for smoother restart
        requestAnimationFrame(() => el.classList.add('scrolling'))
      }
    }

    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [track?.title, expanded])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return
      const key = e.key.toLowerCase()
      if (key === 'p') { e.preventDefault(); togglePlay() }
      else if (key === 'f') { e.preventDefault(); next() }
      else if (key === 'r') { e.preventDefault(); prev() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); changeVolume(Math.min(1, volume + 0.05)) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); changeVolume(Math.max(0, volume - 0.05)) }
      else if (e.key === 'Escape' && expanded) { e.preventDefault(); toggleExpanded() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, next, prev, changeVolume, volume, expanded, toggleExpanded])

  return (
    <div className={`boombox ${expanded ? ' is-open' : ''}${pinned ? ' is-pinned' : ''}`}> 
      <button className="boombox-toggle" onClick={toggleExpanded} aria-expanded={expanded} aria-label={expanded ? 'Collapse player' : 'Expand player'}>
        ♫{expanded ? '▾' : '▸'}
      </button>
      {expanded && (
        <div className="boombox-body">
          <div className="boombox-screen">
            <div className="boombox-track-viewport" ref={viewportRef}>
              <span ref={trackRef} className="boombox-track" aria-live="polite">{track?.title || (playlist.length ? 'NO TRACK LOADED' : 'NO TRACKS')}</span>
            </div>
          </div>
          <div className="boombox-controls">
            <button className="bb-btn" onClick={prev} aria-label="Previous track" disabled={!playlist.length}>«</button>
            <button className="bb-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} disabled={!playlist.length}>{isPlaying ? '❚❚' : '▶'}</button>
            <button className="bb-btn" onClick={next} aria-label="Next track" disabled={!playlist.length}>»</button>
            <button className="bb-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</button>
            <button className="bb-btn" onClick={togglePinned} aria-label={pinned ? 'Unpin player' : 'Pin player'}>{pinned ? '📌' : '📍'}</button>
          </div>
          <div className="boombox-volume">
            <label className="bb-vol-label" htmlFor="bb-volume">VOL</label>
            <input
              id="bb-volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              aria-label="Volume"
              className="bb-vol"
              disabled={!playlist.length || muted}
            />
            <div className="bb-vol-percent" aria-live="polite">{muted ? 'MUTED' : `${Math.round(volume * 100)}%`}</div>
          </div>
          <div className="boombox-meta" aria-live="polite">
            {playlist && playlist.length ? `${index+1}/${playlist.length}` : 'NO TRACKS'}
            {playlist && playlist.length ? ` | ${formatTime(time)} / ${formatTime(duration)}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + String(s).padStart(2,'0')
}
