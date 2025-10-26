// Central HubSpot API endpoint registry
// Source of truth for HubSpot REST paths used by this codebase.
// Each entry: { method, path, docs, notes, build?(params) }
// Follow official docs only: https://developers.hubspot.com/docs/api

const endpoints = {
  // Core CRM Objects (v3)
  'crm.contacts.create': { method: 'post', path: '/crm/v3/objects/contacts', docs: 'https://developers.hubspot.com/docs/api/crm/contacts' },
  'crm.contacts.get': { method: 'get', path: (id) => id ? `/crm/v3/objects/contacts/${encodeURIComponent(id)}` : '/crm/v3/objects/contacts', docs: 'https://developers.hubspot.com/docs/api/crm/contacts' },
  'crm.contacts.update': { method: 'patch', path: (id) => `/crm/v3/objects/contacts/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/crm/contacts' },
  'crm.contacts.delete': { method: 'delete', path: (id) => `/crm/v3/objects/contacts/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/crm/contacts' },
  'crm.contacts.search': { method: 'post', path: '/crm/v3/objects/contacts/search', docs: 'https://developers.hubspot.com/docs/api/crm/search' },

  // Companies
  'crm.companies.create': { method: 'post', path: '/crm/v3/objects/companies', docs: 'https://developers.hubspot.com/docs/api/crm/companies' },
  'crm.companies.get': { method: 'get', path: (id) => id ? `/crm/v3/objects/companies/${encodeURIComponent(id)}` : '/crm/v3/objects/companies', docs: 'https://developers.hubspot.com/docs/api/crm/companies' },
  'crm.companies.update': { method: 'patch', path: (id) => `/crm/v3/objects/companies/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/crm/companies' },
  'crm.companies.delete': { method: 'delete', path: (id) => `/crm/v3/objects/companies/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/crm/companies' },
  'crm.companies.search': { method: 'post', path: '/crm/v3/objects/companies/search', docs: 'https://developers.hubspot.com/docs/api/crm/search' },

  'crm.deals.create': { method: 'post', path: '/crm/v3/objects/deals', docs: 'https://developers.hubspot.com/docs/api/crm/deals' },
  'crm.deals.get': { method: 'get', path: (id) => id ? `/crm/v3/objects/deals/${encodeURIComponent(id)}` : '/crm/v3/objects/deals', docs: 'https://developers.hubspot.com/docs/api/crm/deals' },
  'crm.deals.update': { method: 'patch', path: (id) => `/crm/v3/objects/deals/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/crm/deals' },
  'crm.deals.delete': { method: 'delete', path: (id) => `/crm/v3/objects/deals/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/crm/deals' },
  'crm.deals.search': { method: 'post', path: '/crm/v3/objects/deals/search', docs: 'https://developers.hubspot.com/docs/api/crm/search' },

  'crm.tickets.create': { method: 'post', path: '/crm/v3/objects/tickets', docs: 'https://developers.hubspot.com/docs/api/crm/tickets' },
  'crm.tickets.get': { method: 'get', path: (id) => id ? `/crm/v3/objects/tickets/${encodeURIComponent(id)}` : '/crm/v3/objects/tickets', docs: 'https://developers.hubspot.com/docs/api/crm/tickets' },
  'crm.tickets.update': { method: 'patch', path: (id) => `/crm/v3/objects/tickets/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/crm/tickets' },
  'crm.tickets.delete': { method: 'delete', path: (id) => `/crm/v3/objects/tickets/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/crm/tickets' },

  'crm.quotes.create': { method: 'post', path: '/crm/v3/objects/quotes', docs: 'https://developers.hubspot.com/docs/api/quotes' },
  'crm.quotes.get': { method: 'get', path: (id) => id ? `/crm/v3/objects/quotes/${encodeURIComponent(id)}` : '/crm/v3/objects/quotes', docs: 'https://developers.hubspot.com/docs/api/quotes' },
  'crm.quotes.update': { method: 'patch', path: (id) => `/crm/v3/objects/quotes/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/quotes' },

  'crm.invoices.create': { method: 'post', path: '/crm/v3/objects/invoices', docs: 'https://developers.hubspot.com/docs/api/crm/invoices' },
  'crm.invoices.get': { method: 'get', path: (id) => id ? `/crm/v3/objects/invoices/${encodeURIComponent(id)}` : '/crm/v3/objects/invoices', docs: 'https://developers.hubspot.com/docs/api/crm/invoices' },
  'crm.invoices.update': { method: 'patch', path: (id) => `/crm/v3/objects/invoices/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/crm/invoices' },

  // Batch endpoints (v3 Objects) - Contacts
  // HubSpot batch object operations use POST and object-specific batch paths.
  // Docs (general pattern): https://developers.hubspot.com/docs/api/crm/crm-api-overview
  'crm.contacts.batchCreate': { method: 'post', path: '/crm/v3/objects/contacts/batch/create', docs: 'https://developers.hubspot.com/docs/api/crm/contacts', notes: 'Body: { inputs:[ { properties:{} } ] }' },
  // Upsert is a common batch pattern used in tools; add explicit key for it
  'crm.contacts.batchUpsert': { method: 'post', path: '/crm/v3/objects/contacts/batch/upsert', docs: 'https://developers.hubspot.com/docs/api/crm/contacts', notes: 'Body: { inputs:[ { idProperty, properties:{} } ] } (upsert by idProperty, e.g. email)' },
  'crm.contacts.batchRead': { method: 'post', path: '/crm/v3/objects/contacts/batch/read', docs: 'https://developers.hubspot.com/docs/api/crm/contacts', notes: 'Body: { properties:[..], idProperty?, inputs:[{ id }]} returns results preserving order when possible.' },
  'crm.contacts.batchUpdate': { method: 'post', path: '/crm/v3/objects/contacts/batch/update', docs: 'https://developers.hubspot.com/docs/api/crm/contacts', notes: 'Body: { inputs:[ { id, properties:{} } ] }' },
  'crm.contacts.batchArchive': { method: 'post', path: '/crm/v3/objects/contacts/batch/archive', docs: 'https://developers.hubspot.com/docs/api/crm/contacts', notes: 'Body: { inputs:[ { id } ] } (soft delete)' },

  // Deals
  'crm.deals.batchCreate': { method: 'post', path: '/crm/v3/objects/deals/batch/create', docs: 'https://developers.hubspot.com/docs/api/crm/deals' },
  'crm.deals.batchRead': { method: 'post', path: '/crm/v3/objects/deals/batch/read', docs: 'https://developers.hubspot.com/docs/api/crm/deals' },
  'crm.deals.batchUpdate': { method: 'post', path: '/crm/v3/objects/deals/batch/update', docs: 'https://developers.hubspot.com/docs/api/crm/deals' },
  'crm.deals.batchArchive': { method: 'post', path: '/crm/v3/objects/deals/batch/archive', docs: 'https://developers.hubspot.com/docs/api/crm/deals' },

  // Tickets
  'crm.tickets.batchCreate': { method: 'post', path: '/crm/v3/objects/tickets/batch/create', docs: 'https://developers.hubspot.com/docs/api/crm/tickets' },
  'crm.tickets.batchRead': { method: 'post', path: '/crm/v3/objects/tickets/batch/read', docs: 'https://developers.hubspot.com/docs/api/crm/tickets' },
  'crm.tickets.batchUpdate': { method: 'post', path: '/crm/v3/objects/tickets/batch/update', docs: 'https://developers.hubspot.com/docs/api/crm/tickets' },
  'crm.tickets.batchArchive': { method: 'post', path: '/crm/v3/objects/tickets/batch/archive', docs: 'https://developers.hubspot.com/docs/api/crm/tickets' },

  // Quotes
  'crm.quotes.batchCreate': { method: 'post', path: '/crm/v3/objects/quotes/batch/create', docs: 'https://developers.hubspot.com/docs/api/quotes' },
  'crm.quotes.batchRead': { method: 'post', path: '/crm/v3/objects/quotes/batch/read', docs: 'https://developers.hubspot.com/docs/api/quotes' },
  'crm.quotes.batchUpdate': { method: 'post', path: '/crm/v3/objects/quotes/batch/update', docs: 'https://developers.hubspot.com/docs/api/quotes' },
  'crm.quotes.batchArchive': { method: 'post', path: '/crm/v3/objects/quotes/batch/archive', docs: 'https://developers.hubspot.com/docs/api/quotes' },

  // Invoices
  'crm.invoices.batchCreate': { method: 'post', path: '/crm/v3/objects/invoices/batch/create', docs: 'https://developers.hubspot.com/docs/api/crm/invoices' },
  'crm.invoices.batchRead': { method: 'post', path: '/crm/v3/objects/invoices/batch/read', docs: 'https://developers.hubspot.com/docs/api/crm/invoices' },
  'crm.invoices.batchUpdate': { method: 'post', path: '/crm/v3/objects/invoices/batch/update', docs: 'https://developers.hubspot.com/docs/api/crm/invoices' },
  'crm.invoices.batchArchive': { method: 'post', path: '/crm/v3/objects/invoices/batch/archive', docs: 'https://developers.hubspot.com/docs/api/crm/invoices' },

  // Custom Objects (dynamic path segment)
  'crm.custom.create': { method: 'post', path: (objectType) => `/crm/v3/objects/${objectType}`, docs: 'https://developers.hubspot.com/docs/api/crm/crm-custom-objects' },
  'crm.custom.get': { method: 'get', path: (objectType, id) => id ? `/crm/v3/objects/${objectType}/${encodeURIComponent(id)}` : `/crm/v3/objects/${objectType}`, docs: 'https://developers.hubspot.com/docs/api/crm/crm-custom-objects' },
  'crm.custom.update': { method: 'patch', path: (objectType, id) => `/crm/v3/objects/${objectType}/${encodeURIComponent(id)}`, docs: 'https://developers.hubspot.com/docs/api/crm/crm-custom-objects' },
  // Custom object batch endpoints (objectType dynamic segment)
  'crm.custom.batchCreate': { method: 'post', path: (objectType) => `/crm/v3/objects/${objectType}/batch/create`, docs: 'https://developers.hubspot.com/docs/api/crm/crm-custom-objects' },
  'crm.custom.batchRead': { method: 'post', path: (objectType) => `/crm/v3/objects/${objectType}/batch/read`, docs: 'https://developers.hubspot.com/docs/api/crm/crm-custom-objects' },
  'crm.custom.batchUpdate': { method: 'post', path: (objectType) => `/crm/v3/objects/${objectType}/batch/update`, docs: 'https://developers.hubspot.com/docs/api/crm/crm-custom-objects' },
  'crm.custom.batchArchive': { method: 'post', path: (objectType) => `/crm/v3/objects/${objectType}/batch/archive`, docs: 'https://developers.hubspot.com/docs/api/crm/crm-custom-objects' },

  // Associations (v4)
  'crm.associations.create': { method: 'put', path: (fromType, fromId, toType, toId) => `/crm/v4/objects/${fromType}/${fromId}/associations/${toType}/${toId}`, docs: 'https://developers.hubspot.com/docs/api/crm/associations' },
  'crm.associations.createDefault': { method: 'put', path: (fromType, fromId, toType, toId) => `/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`, docs: 'https://developers.hubspot.com/docs/api/crm/associations' },
  'crm.associations.batchCreate': { method: 'post', path: (fromType, toType) => `/crm/v4/associations/${fromType}/${toType}/batch/create`, docs: 'https://developers.hubspot.com/docs/api/crm/associations' },
  'crm.associations.list': { method: 'get', path: (fromType, fromId, toType) => `/crm/v4/objects/${fromType}/${fromId}/associations/${toType}`, docs: 'https://developers.hubspot.com/docs/api/crm/associations' },
  'crm.associations.batchRead': { method: 'post', path: (fromType, toType) => `/crm/v4/associations/${fromType}/${toType}/batch/read`, docs: 'https://developers.hubspot.com/docs/api/crm/associations' },
  'crm.associations.delete': { method: 'delete', path: (fromType, fromId, toType, toId) => `/crm/v4/objects/${fromType}/${fromId}/associations/${toType}/${toId}`, docs: 'https://developers.hubspot.com/docs/api/crm/associations' },
  'crm.associations.batchArchive': { method: 'post', path: (fromType, toType) => `/crm/v4/associations/${fromType}/${toType}/batch/archive`, docs: 'https://developers.hubspot.com/docs/api/crm/associations' },

  // Owners (list, paginated)
  'crm.owners.list': { method: 'get', path: '/crm/v3/owners', docs: 'https://developers.hubspot.com/docs/api/crm/owners' },

  // Users (CRM Users API) - ref: https://developers.hubspot.com/docs/api-reference/crm-users-v3/guide
  // Note: HubSpot users API is in Public Beta per docs; only list endpoint needed currently.
  // If object-style access (create/update) becomes required, extend with additional keys.
  'crm.users.list': { method: 'get', path: '/crm/v3/objects/users', docs: 'https://developers.hubspot.com/docs/api-reference/crm-users-v3/guide' },

  // Docs: https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide
  // New structured Deal pipeline keys (preferred)
  'crm.pipelines.deals.list': { method: 'get', path: '/crm/v3/pipelines/deals', docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.deals.get': { method: 'get', path: (pipelineId) => `/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.deals.create': { method: 'post', path: '/crm/v3/pipelines/deals', docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.deals.update': { method: 'patch', path: (pipelineId) => `/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.deals.delete': { method: 'delete', path: (pipelineId) => `/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },

  // Deal pipeline stages
  'crm.pipelines.deals.stages.list': { method: 'get', path: (pipelineId) => `/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}/stages`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.deals.stages.get': { method: 'get', path: (pipelineId, stageId) => `/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.deals.stages.create': { method: 'post', path: (pipelineId) => `/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}/stages`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.deals.stages.update': { method: 'patch', path: (pipelineId, stageId) => `/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.deals.stages.delete': { method: 'delete', path: (pipelineId, stageId) => `/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },

  // Ticket pipelines
  // Legacy convenience key (if any older code expects it). Prefer crm.pipelines.tickets.* keys.
  'crm.tickets.pipelines': { method: 'get', path: '/crm/v3/pipelines/tickets', docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide', notes: 'LEGACY: prefer crm.pipelines.tickets.list' },

  'crm.pipelines.tickets.list': { method: 'get', path: '/crm/v3/pipelines/tickets', docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.tickets.get': { method: 'get', path: (pipelineId) => `/crm/v3/pipelines/tickets/${encodeURIComponent(pipelineId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.tickets.create': { method: 'post', path: '/crm/v3/pipelines/tickets', docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.tickets.update': { method: 'patch', path: (pipelineId) => `/crm/v3/pipelines/tickets/${encodeURIComponent(pipelineId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.tickets.delete': { method: 'delete', path: (pipelineId) => `/crm/v3/pipelines/tickets/${encodeURIComponent(pipelineId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },

  // Ticket pipeline stages
  'crm.pipelines.tickets.stages.list': { method: 'get', path: (pipelineId) => `/crm/v3/pipelines/tickets/${encodeURIComponent(pipelineId)}/stages`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.tickets.stages.get': { method: 'get', path: (pipelineId, stageId) => `/crm/v3/pipelines/tickets/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.tickets.stages.create': { method: 'post', path: (pipelineId) => `/crm/v3/pipelines/tickets/${encodeURIComponent(pipelineId)}/stages`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.tickets.stages.update': { method: 'patch', path: (pipelineId, stageId) => `/crm/v3/pipelines/tickets/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },
  'crm.pipelines.tickets.stages.delete': { method: 'delete', path: (pipelineId, stageId) => `/crm/v3/pipelines/tickets/${encodeURIComponent(pipelineId)}/stages/${encodeURIComponent(stageId)}`, docs: 'https://developers.hubspot.com/docs/api-reference/crm-pipelines-v3/guide' },

  // Field Metadata (Object Model)
  // Used by propertyValidator to get field definitions and enum options
  'crm.objects.model.get': { method: 'get', path: (objectType) => `/crm/v3/objects/${encodeURIComponent(objectType)}/model`, docs: 'https://developers.hubspot.com/docs/api/crm/crm-api-overview', notes: 'Returns all field definitions and enum options for an object type' },

  // Validation (simple contact list probe)
  'crm.contacts.validateProbe': { method: 'get', path: '/crm/v3/objects/contacts', docs: 'https://developers.hubspot.com/docs/api/crm/contacts', notes: 'Used with limit=1 props=firstname to validate token' },
  // Legacy engagements endpoint (used for notes/calls/tasks if present)
  'engagements.create': { method: 'post', path: '/engagements/v1/engagements', docs: 'https://legacy.docs.hubspot.com/docs/methods/engagements/create_engagement' },
}

function listKeys() { return Object.keys(endpoints) }
function getEndpoint(key) { return endpoints[key] }
function buildPath(key, ...args) {
  const ep = getEndpoint(key)
  if (!ep) throw new Error(`Unknown HubSpot endpoint key: ${key}`)
  if (typeof ep.path === 'function') return ep.path(...args)
  return ep.path
}

module.exports = { endpoints, listKeys, getEndpoint, buildPath }
