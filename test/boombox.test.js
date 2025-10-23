/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioProvider, useAudio } from '../src/audio/AudioContext'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'

// Mock global Audio element
class MockAudio {
  constructor() { this.paused = true; this.currentTime = 0; this.volume = 1; this.src = ''; this._events = {} }
  play() { this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
  addEventListener(ev, fn) { this._events[ev] = fn }
  removeEventListener(ev) { delete this._events[ev] }
}

vi.stubGlobal('Audio', MockAudio)

describe('AudioContext / Boombox behavior', () => {
  beforeEach(() => {
    if (typeof global.localStorage === 'undefined') {
      const store = {}
      global.localStorage = {
        getItem: (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
        setItem: (k, v) => { store[k] = String(v) },
        removeItem: (k) => { delete store[k] },
        clear: () => { Object.keys(store).forEach(k => delete store[k]) }
      }
    }
    localStorage.clear()
  })

  const mount = () => new Promise(resolve => {
    let latest
    function Capture() { latest = useAudio(); return null }
    render(React.createElement(AudioProvider, null, React.createElement(Capture)))
    // Return a getter so callers always read most recent context snapshot
    resolve({ get ctx() { return latest } })
  })

  it('loads playlist and initializes first track', async () => {
    const handle = await mount()
    expect(handle.ctx.playlist).toBeDefined()
    expect(Array.isArray(handle.ctx.playlist)).toBe(true)
  })

  it('can change volume and persist it', async () => {
    const handle = await mount()
    // Start playback so persistence effect engages
    handle.ctx.togglePlay()
    handle.ctx.changeVolume(0.2)
    // Allow state flush
    await new Promise(r => setTimeout(r, 5))
    expect(handle.ctx.volume).toBeCloseTo(0.2)
    // Poll for persistence if immediate write not yet visible
    let stored
    for (let i=0;i<5;i++) {
      const raw = localStorage.getItem('simcrm_audio_state')
      if (raw) { stored = JSON.parse(raw); if (stored && typeof stored.volume === 'number') break }
      await new Promise(r => setTimeout(r, 5))
    }
    expect(stored).toBeDefined()
    expect(stored.volume).toBeCloseTo(0.2)
    // Pause again
    handle.ctx.togglePlay()
  })

  it('next/prev safe even with small playlist', async () => {
    const handle = await mount()
    const startIndex = handle.ctx.index
    handle.ctx.next()
    handle.ctx.prev()
    expect(handle.ctx.index).toBeTypeOf('number')
    expect(handle.ctx.index).toBeGreaterThanOrEqual(0)
    expect(typeof startIndex).toBe('number')
  })

  it('toggles mute with M key', async () => {
    const handle = await mount()
    expect(handle.ctx.muted).toBe(false)
    // dispatch keydown 'm'
    fireEvent.keyDown(window, { key: 'm' })
    expect(handle.ctx.muted).toBe(true)
    fireEvent.keyDown(window, { key: 'M' })
    expect(handle.ctx.muted).toBe(false)
  })
})
