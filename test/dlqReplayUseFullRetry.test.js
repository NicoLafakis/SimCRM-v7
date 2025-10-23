import { describe, it, expect } from 'vitest'
// This is a placeholder illustrating intent; full integration would require spinning up BullMQ & Redis.
// Here we only validate request payload shaping logic (pure function style) if we refactor later.

function buildReplayBody({ categories, limit, dryRun, maxPerCategory, strategy, useFullRetry }) {
  const body = { categories, limit, dryRun, strategy }
  if (maxPerCategory) body.maxPerCategory = maxPerCategory
  if (!dryRun && useFullRetry) body.useFullRetry = true
  return body
}

describe('DLQ replay body shaping', () => {
  it('omits useFullRetry when dryRun', () => {
    const b = buildReplayBody({ categories:['rate_limit'], limit:5, dryRun:true, strategy:'oldest', useFullRetry:true })
    expect(b.useFullRetry).toBeUndefined()
  })
  it('includes useFullRetry when not dryRun', () => {
    const b = buildReplayBody({ categories:['rate_limit'], limit:5, dryRun:false, strategy:'oldest', useFullRetry:true })
    expect(b.useFullRetry).toBe(true)
  })
})