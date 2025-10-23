/** @vitest-environment jsdom */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import TimingQuantities from '../src/components/Timing/TimingQuantities'

const usersPayload = { ok:true, users:[{ id:'1', firstName:'Ann', lastName:'A', email:'ann@example.com' }] }
const pipelinesPayload = { ok:true, pipelines:[{ id:'p1', label:'Primary' }] }

describe('TimingQuantities auto-fetch HubSpot metadata', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.startsWith('/api/hubspot/deal-pipelines')) {
        return Promise.resolve({ json: () => Promise.resolve(pipelinesPayload) })
      }
      if (url.startsWith('/api/hubspot/users')) {
        return Promise.resolve({ json: () => Promise.resolve(usersPayload) })
      }
      return Promise.resolve({ json: () => Promise.resolve({}) })
    })
  })

  it('fires fetch for pipelines and users on mount', async () => {
    render(<TimingQuantities playPlunk={()=>{}} userId="u1" hubspotKeyId="k1" onConfirm={()=>{}} />)
    await waitFor(() => {
      // Expect both endpoints called at least once
      const calls = global.fetch.mock.calls.map(c => c[0])
      expect(calls.some(u => u.startsWith('/api/hubspot/deal-pipelines'))).toBe(true)
      expect(calls.some(u => u.startsWith('/api/hubspot/users'))).toBe(true)
    })
  })
})
