/** @vitest-environment jsdom */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TimingQuantities from '../src/components/Timing/TimingQuantities'

// Mock fetch for owners & pipelines endpoints (owners endpoint renamed from previous users path)
const ownersPayload = { ok:true, owners:[{ id:'1', firstName:'Alice', lastName:'A', email:'a@example.com' }, { id:'2', firstName:'Bob', lastName:'B', email:'b@example.com' }] }
const pipelinesPayload = { ok:true, pipelines:[{ id:'pipe1', label:'Primary', stages:[{ id:'stage1', label:'Stage 1'}]}] }

describe('TimingQuantities HubSpot integration', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.startsWith('/api/hubspot/deal-pipelines')) {
        return Promise.resolve({ json: () => Promise.resolve(pipelinesPayload) })
      }
      if (url.startsWith('/api/hubspot/owners')) {
        return Promise.resolve({ json: () => Promise.resolve(ownersPayload) })
      }
      return Promise.resolve({ json: () => Promise.resolve({}) })
    })
  })

  it('auto loads owners and pipelines and allows multi-select', async () => {
    const playPlunk = vi.fn()
    const onConfirm = vi.fn()
    render(<TimingQuantities playPlunk={playPlunk} userId="u1" hubspotKeyId="k1" onConfirm={onConfirm} />)
    // Auto fetch kicks in; wait for pipeline label then owner checkbox
    await screen.findByText('Primary')
    const aliceCheckbox = await screen.findByLabelText(/Alice A/i)
    const bobCheckbox = screen.getByLabelText(/Bob B/i)
    
    // Toggle checkboxes (Alice should already be selected by default)
    if (!aliceCheckbox.checked) fireEvent.click(aliceCheckbox)
    fireEvent.click(bobCheckbox)
    
    const pipelineSelect = screen.getByLabelText(/Deal Pipeline/i)
    fireEvent.change(pipelineSelect, { target: { value: 'pipe1' } })

    // Open summary
    const startBtn = screen.getAllByTestId('tq-start').find(b => !b.disabled)
    fireEvent.click(startBtn)
    // Accept summary
    const acceptBtn = await screen.findByText(/ACCEPT/i)
    fireEvent.click(acceptBtn)
    // Start again
    const startBtn2 = screen.getAllByTestId('tq-start').find(b => !b.disabled)
    fireEvent.click(startBtn2)
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const payload = onConfirm.mock.calls[0][0]
    expect(payload.pipelineId).toBe('pipe1')
    expect(payload.ownerIds.map(String).sort()).toEqual(['1','2'])
  })
})
