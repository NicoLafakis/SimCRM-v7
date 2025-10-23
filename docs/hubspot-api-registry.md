# HubSpot API Registry

Central source of truth for all HubSpot REST endpoints referenced in the backend.

File: `server/tools/hubspot/apiRegistry.js`

## Goals
- Eliminate duplicated hard-coded paths ("/crm/v3/objects/..." strings scattered across tools and routes)
- Provide traceability back to official HubSpot documentation (ONLY sources under https://developers.hubspot.com/docs/api)
- Enable consistent future adjustments (version bumps, path changes) in one place
- Support dynamic path construction (custom objects, associations) via small helper `buildPath(key, ...args)`

## Structure
Each endpoint entry:
```
key: {
  method: 'get'|'post'|'patch'|'put'|'delete',
  path: string | (...args) => string,
  docs: 'https://developers.hubspot.com/docs/api/...',
  notes?: 'usage context'
}
```

Helper exports:
- `endpoints` (raw map)
- `listKeys()` → string[]
- `getEndpoint(key)` → definition
- `buildPath(key, ...args)` → resolved path string

## Usage Pattern
In a tool module:
```javascript
const { buildPath } = require('./apiRegistry')
// Example: Deals create
const res = await client.post(buildPath('crm.deals.create'), body)
```

Dynamic example (custom object):
```javascript
client.get(buildPath('crm.custom.get', objectType, id))
```

Association batch create:
```javascript
client.post(buildPath('crm.associations.batchCreate', 'contacts', 'companies'), payload)
```

## Current Coverage
- Core CRM objects: contacts, deals, tickets, quotes, invoices
- Custom objects CRUD (create/get/update)
- Associations v4 (single + default + batch read/create/archive + list)
- Owners list (paginated)
- Deal pipelines (root + stages)
- Contacts validate probe (limit=1) used for token verification

## Adding a New Endpoint
1. Confirm official docs URL under `https://developers.hubspot.com/docs/api`.
2. Add a unique key under a logical namespace (e.g. `crm.emails.send`).
3. Prefer grouping by object type; use dots for hierarchy.
4. If parameters are needed, make `path` a function with positional args (document order in a code comment if non-obvious).
5. Refactor existing direct string usages to use the new key.
6. Run tests.

## Anti-Patterns (Do NOT)
- Hard-code HubSpot paths outside `apiRegistry.js` (except in extremely constrained one-off validation where already covered; otherwise refactor).
- Infer docs links from memory—always copy the canonical docs URL.
- Mutate `endpoints` at runtime.
- Return transformed data from the registry; transformation belongs in callers if needed.

## Migration Status
Refactored tools: deals, tickets, quotes, invoices, customObjects. Remaining direct uses (for follow-up):
- `server/index.js` owners, pipelines, token validation probe (can be converted to use client + registry next iteration).
- `associations.js` currently inline; can be upgraded to registry usage for uniformity.

## Next Steps
- Convert `associations.js` to leverage association keys to fully remove inline `/crm/v4/...` strings.
- Update `server/index.js` HubSpot routes to use shared client factory + registry rather than raw axios.
- Add automated lint rule scanning for `/crm/v[34]/` literals outside registry.

## Verification
After adding or editing keys run:
```
npm test
```
Ensure no failing references and that updated tools still return raw `res.data`.
