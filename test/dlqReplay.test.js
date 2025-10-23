import { describe, it, expect } from 'vitest'

// Placeholder pure function extraction would be ideal; for now we emulate selection logic subset.
function selectCandidates(jobs, { jobIds = [], categories = [], limit = 25, strategy = 'oldest' }) {
  let c = jobs.slice()
  if (jobIds.length) {
    const set = new Set(jobIds.map(String))
    c = c.filter(j => set.has(String(j.id)))
  }
  if (categories.length) {
    const set = new Set(categories)
    c = c.filter(j => set.has(j.data.category))
  }
  if (strategy === 'oldest') c.sort((a,b)=>a.ts-b.ts)
  else if (strategy === 'newest') c.sort((a,b)=>b.ts-a.ts)
  else if (strategy === 'random') {
    for (let i=c.length-1;i>0;i--){ const k=Math.floor(Math.random()*(i+1)); [c[i],c[k]]=[c[k],c[i]] }
  }
  return c.slice(0, limit)
}

describe('DLQ replay selection', () => {
  const jobs = [
    { id: 1, ts: 100, data: { category: 'rate_limit' } },
    { id: 2, ts: 90, data: { category: 'auth' } },
    { id: 3, ts: 110, data: { category: 'validation' } },
  ]
  it('filters by category', () => {
    const out = selectCandidates(jobs, { categories:['auth'] })
    expect(out.map(j=>j.id)).toEqual([2])
  })
  it('oldest strategy sorts ascending', () => {
    const out = selectCandidates(jobs, { strategy:'oldest' })
    expect(out.map(j=>j.id)).toEqual([2,1,3])
  })
  it('newest strategy sorts descending', () => {
    const out = selectCandidates(jobs, { strategy:'newest' })
    expect(out.map(j=>j.id)).toEqual([3,1,2])
  })
  it('limits results', () => {
    const out = selectCandidates(jobs, { limit:2 })
    expect(out.length).toBe(2)
  })
})