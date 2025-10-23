/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import TimingQuantities from '../src/components/Timing/TimingQuantities'

describe('TimingQuantities component', () => {
  it('renders defaults and exposes Total Records slider default value', () => {
    render(<TimingQuantities />)
    const totalSlider = screen.getByRole('slider', { name: /Total Records/i })
    expect(totalSlider.getAttribute('aria-valuenow')).toBe('100')
    // Duration defaults to 0d 1h -> formatted 00:01
    const days = screen.getAllByLabelText('Days')[0]
    const hours = screen.getAllByLabelText('Hours')[0]
    expect(days.value).toBe('0')
    expect(hours.value).toBe('1')
    expect(screen.getAllByText('00:01').length).toBeGreaterThan(0)
  const pullPipelinesBtn = screen.queryByRole('button', { name: /PULL PIPELINES/i })
  const pullOwnersBtn = screen.queryByRole('button', { name: /PULL OWNERS/i })
  if (pullPipelinesBtn) expect(pullPipelinesBtn.disabled).toBe(true)
  if (pullOwnersBtn) expect(pullOwnersBtn.disabled).toBe(true)
  })

  it('flows through summary accept to confirm (sets duration so button enables)', async () => {
    const onConfirm = vi.fn()
  render(<TimingQuantities onConfirm={onConfirm} testImmediateLaunch />)
    // Set duration to 1 hour to clear validation error
    fireEvent.change(screen.getAllByLabelText('Hours')[0], { target: { value: '1' } })
    // Button should now be enabled (VIEW SUMMARY phase)
    const viewSummaryBtn = await waitFor(() => {
      const btn = screen.getAllByTestId('tq-start')[0]
      if (btn.disabled) throw new Error('disabled')
      if (!/VIEW SUMMARY/i.test(btn.textContent || '')) throw new Error('unexpected label')
      return btn
    })
    fireEvent.click(viewSummaryBtn)
    // Accept summary to transition button state
    const acceptBtn = await screen.findByRole('button', { name: /ACCEPT/i })
    fireEvent.click(acceptBtn)
    // Auto-launch occurs in testImmediateLaunch mode after Accept; wait for callback
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
  })

  it('editing duration days/hours updates formatted display', async () => {
    render(<TimingQuantities />)
  const days = screen.getAllByLabelText('Days')[0]
  const hours = screen.getAllByLabelText('Hours')[0]
  fireEvent.change(days, { target: { value: '2' } }) // 2 days
  fireEvent.change(hours, { target: { value: '5' } }) // +5 hours
    await waitFor(() => expect(screen.getAllByText('02:05').length).toBeGreaterThan(0))
  })

  it('manual edit of Total Records keeps entered value (no snapping)', async () => {
    render(<TimingQuantities />)
    const totalSlider = screen.getAllByRole('slider', { name: /Total Records/i })[0]
    const badge = screen.getAllByText('100')[0]
    fireEvent.click(badge)
    const editInput = await screen.findByTestId('totalRecords-edit')
    fireEvent.change(editInput, { target: { value: '2400' } })
    fireEvent.blur(editInput)
    await waitFor(() => expect(totalSlider.getAttribute('aria-valuenow')).toBe('2400'))
  })

  it('does not render advanced slider labels (batch size etc.)', () => {
    render(<TimingQuantities />)
    expect(screen.queryByRole('slider', { name:/Batch Size/i })).toBeNull()
    expect(screen.queryByRole('slider', { name:/Jitter/i })).toBeNull()
    expect(screen.queryByRole('slider', { name:/Max Concurrency/i })).toBeNull()
  })
})
