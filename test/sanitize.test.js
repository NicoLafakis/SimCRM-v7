const { sanitizeProperties } = require('../server/tools/hubspot/sanitizeProperties')

describe('sanitizeProperties', () => {
  it('keeps allowed contact fields and strips disallowed ones', () => {
    const input = { firstname: 'A', lastname: 'B', createdate: 12345, hs_analytics_source: 'x', email: 'a@x.com' }
    const { clean, stripped } = sanitizeProperties('contacts', input)
    expect(clean).toHaveProperty('firstname')
    expect(clean).toHaveProperty('lastname')
    expect(clean).toHaveProperty('email')
    expect(stripped).toEqual(expect.arrayContaining(['createdate','hs_analytics_source']))
  })

  it('returns everything if objectType unknown', ()=>{
    const input = { foo: 'bar' }
    const { clean, stripped } = sanitizeProperties('unknown_type', input)
    expect(clean).toEqual(input)
    expect(stripped).toEqual([])
  })
})
