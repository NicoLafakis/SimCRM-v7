import { describe, it, expect, vi } from 'vitest'

const contactsFactory = require('../server/tools/hubspot/contacts')
const { buildPath } = require('../server/tools/hubspot/apiRegistry')

describe('hubspot contacts tool', () => {
  it('calls create with registry path and properties body', async () => {
    const mockClient = {
      post: vi.fn(async (url, body) => ({ data: { url, body } })),
      get: vi.fn(async (url, opts) => ({ data: { url, opts } })),
      patch: vi.fn(async (url, body) => ({ data: { url, body } })),
      del: vi.fn(async (url) => ({ data: { url } })),
    }

    const contacts = contactsFactory(mockClient)

    const props = { firstname: 'Alice', lastname: 'Tester' }
    const res = await contacts.create(props)

    expect(mockClient.post).toHaveBeenCalled()
    expect(mockClient.post.mock.calls[0][0]).toBe(buildPath('crm.contacts.create'))
    expect(mockClient.post.mock.calls[0][1]).toEqual({ properties: props })
    expect(res).toHaveProperty('url')
  })

  it('calls get with id or list path', async () => {
    const mockClient = {
      post: vi.fn(async (url, body) => ({ data: { url, body } })),
      get: vi.fn(async (url, opts) => ({ data: { url, opts } })),
      patch: vi.fn(async (url, body) => ({ data: { url, body } })),
      del: vi.fn(async (url) => ({ data: { url } })),
    }

    const contacts = contactsFactory(mockClient)

    // get single
    await contacts.get('abc-123', { params: { foo: 'bar' } })
    expect(mockClient.get).toHaveBeenCalled()
    expect(mockClient.get.mock.calls[0][0]).toBe(buildPath('crm.contacts.get', 'abc-123'))

    // get list
    await contacts.get(null, { params: { limit: 10 } })
    expect(mockClient.get.mock.calls[1][0]).toBe(buildPath('crm.contacts.get', null))
  })

  it('calls update/delete with registry-built paths', async () => {
    const mockClient = {
      post: vi.fn(async (url, body) => ({ data: { url, body } })),
      get: vi.fn(async (url, opts) => ({ data: { url, opts } })),
      patch: vi.fn(async (url, body) => ({ data: { url, body } })),
      del: vi.fn(async (url) => ({ data: { url } })),
    }

    const contacts = contactsFactory(mockClient)

    const updateProps = { jobtitle: 'Engineer' }
    await contacts.update('id-1', updateProps)
    expect(mockClient.patch.mock.calls[0][0]).toBe(buildPath('crm.contacts.update', 'id-1'))
    expect(mockClient.patch.mock.calls[0][1]).toEqual({ properties: updateProps })

    await contacts.delete('id-2')
    expect(mockClient.del.mock.calls[0][0]).toBe(buildPath('crm.contacts.delete', 'id-2'))
  })

  it('calls batchUpsert with upsert registry path and idProperty mapping', async () => {
    const mockClient = {
      post: vi.fn(async (url, body) => ({ data: { url, body } })),
      get: vi.fn(async (url, opts) => ({ data: { url, opts } })),
      patch: vi.fn(async (url, body) => ({ data: { url, body } })),
      del: vi.fn(async (url) => ({ data: { url } })),
    }

    const contacts = contactsFactory(mockClient)

    const inputs = [ { email: 'a@x.com', properties: { firstname: 'A' } }, { email: 'b@x.com', properties: { firstname: 'B' } } ]
    await contacts.batchUpsert(inputs, 'email')

    expect(mockClient.post.mock.calls[0][0]).toBe(buildPath('crm.contacts.batchUpsert'))
    const sent = mockClient.post.mock.calls[0][1]
    expect(sent).toHaveProperty('inputs')
    expect(sent.inputs.length).toBe(2)
    expect(sent.inputs[0]).toHaveProperty('id', 'a@x.com')
  })
})
