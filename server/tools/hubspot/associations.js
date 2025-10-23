/**
 * HubSpot Associations API v4 - Centralized association management
 * 
 * This module provides a unified interface for managing associations between
 * HubSpot objects using the modern v4 associations API with proper type IDs
 * and best practices including retry logic and batch operations.
 */

// HubSpot-defined association type IDs (as of 2024/2025)
// Reference: https://developers.hubspot.com/docs/api-reference/crm-associations-v4/guide
const ASSOCIATION_TYPES = {
  // Contact associations
  CONTACT_TO_COMPANY: 279,        // Unlabeled association
  CONTACT_TO_COMPANY_PRIMARY: 1,  // Primary company association
  CONTACT_TO_DEAL: 4,
  CONTACT_TO_TICKET: 15,
  CONTACT_TO_NOTE: 201,
  CONTACT_TO_CALL: 193,
  CONTACT_TO_TASK: 203,
  
  // Company associations  
  COMPANY_TO_CONTACT: 280,        // Unlabeled association
  COMPANY_TO_CONTACT_PRIMARY: 2,  // Primary contact association
  COMPANY_TO_DEAL: 342,           // Unlabeled association
  COMPANY_TO_DEAL_PRIMARY: 6,     // Primary deal association  
  COMPANY_TO_TICKET: 340,
  COMPANY_TO_NOTE: 189,
  COMPANY_TO_CALL: 181,
  COMPANY_TO_TASK: 191,
  
  // Deal associations
  DEAL_TO_CONTACT: 3,
  DEAL_TO_COMPANY: 341,           // Unlabeled association
  DEAL_TO_COMPANY_PRIMARY: 5,     // Primary company association
  DEAL_TO_TICKET: 27,
  DEAL_TO_NOTE: 213,
  DEAL_TO_CALL: 205,
  DEAL_TO_TASK: 215,
  
  // Ticket associations  
  TICKET_TO_CONTACT: 16,
  TICKET_TO_COMPANY: 339,
  TICKET_TO_COMPANY_PRIMARY: 26,  // Primary company association
  TICKET_TO_DEAL: 28,
  TICKET_TO_NOTE: 227,
  TICKET_TO_CALL: 219,
  TICKET_TO_TASK: 229,
  
  // Note associations (from notes to other objects)
  NOTE_TO_CONTACT: 202,
  NOTE_TO_COMPANY: 190, 
  NOTE_TO_DEAL: 214,
  NOTE_TO_TICKET: 228,
  
  // Call associations (from calls to other objects)
  CALL_TO_CONTACT: 194,
  CALL_TO_COMPANY: 182,
  CALL_TO_DEAL: 206,
  CALL_TO_TICKET: 220,
  
  // Task associations (from tasks to other objects)
  TASK_TO_CONTACT: 204,
  TASK_TO_COMPANY: 192,
  TASK_TO_DEAL: 216,
  TASK_TO_TICKET: 230
}

// Association categories
const ASSOCIATION_CATEGORIES = {
  HUBSPOT_DEFINED: 'HUBSPOT_DEFINED',
  USER_DEFINED: 'USER_DEFINED'
}

const { buildPath } = require('./apiRegistry')

module.exports = (client) => ({

  /**
   * Create a single association between two objects using v4 API
   * @param {string} fromObjectType - Source object type (contact, company, deal, etc.)
   * @param {string} fromObjectId - Source object ID
   * @param {string} toObjectType - Target object type 
   * @param {string} toObjectId - Target object ID
   * @param {number} associationTypeId - Association type ID from ASSOCIATION_TYPES
   * @param {string} category - Association category (HUBSPOT_DEFINED or USER_DEFINED)
   * @returns {Promise<Object>} Association result
   */
  create: async (fromObjectType, fromObjectId, toObjectType, toObjectId, associationTypeId, category = ASSOCIATION_CATEGORIES.HUBSPOT_DEFINED) => {
  const url = buildPath('crm.associations.create', fromObjectType, fromObjectId, toObjectType, toObjectId)
  const body = [
      {
        associationCategory: category,
        associationTypeId: associationTypeId
      }
    ]
    const res = await client.put(url, body)
    return res.data
  },

  /**
   * Create a default unlabeled association (simpler method)
   * @param {string} fromObjectType - Source object type
   * @param {string} fromObjectId - Source object ID  
   * @param {string} toObjectType - Target object type
   * @param {string} toObjectId - Target object ID
   * @returns {Promise<Object>} Association result
   */
  createDefault: async (fromObjectType, fromObjectId, toObjectType, toObjectId) => {
    const url = buildPath('crm.associations.createDefault', fromObjectType, fromObjectId, toObjectType, toObjectId)
    const res = await client.put(url)
    return res.data
  },

  /**
   * Batch create associations between multiple object pairs
   * @param {string} fromObjectType - Source object type
   * @param {string} toObjectType - Target object type
   * @param {Array} associations - Array of {fromId, toId, typeId, category} objects
   * @returns {Promise<Object>} Batch result
   */
  batchCreate: async (fromObjectType, toObjectType, associations) => {
    const url = buildPath('crm.associations.batchCreate', fromObjectType, toObjectType)
    const inputs = associations.map(assoc => ({
      from: { id: assoc.fromId },
      to: { id: assoc.toId },
      types: [{
        associationCategory: assoc.category || ASSOCIATION_CATEGORIES.HUBSPOT_DEFINED,
        associationTypeId: assoc.typeId
      }]
    }))
    const res = await client.post(url, { inputs })
    return res.data
  },

  /**
   * Retrieve associations for a specific object
   * @param {string} fromObjectType - Source object type
   * @param {string} fromObjectId - Source object ID
   * @param {string} toObjectType - Target object type to get associations for
   * @returns {Promise<Object>} Associated objects with labels and type info
   */
  get: async (fromObjectType, fromObjectId, toObjectType) => {
    const url = buildPath('crm.associations.list', fromObjectType, fromObjectId, toObjectType)
    const res = await client.get(url)
    return res.data
  },

  /**
   * Batch retrieve associations for multiple objects
   * @param {string} fromObjectType - Source object type
   * @param {string} toObjectType - Target object type
   * @param {Array<string>} objectIds - Array of object IDs to get associations for
   * @returns {Promise<Object>} Batch association results
   */
  batchGet: async (fromObjectType, toObjectType, objectIds) => {
    const url = buildPath('crm.associations.batchRead', fromObjectType, toObjectType)
    const inputs = objectIds.map(id => ({ id }))
    const res = await client.post(url, { inputs })
    return res.data
  },

  /**
   * Remove all associations between two objects
   * @param {string} fromObjectType - Source object type
   * @param {string} fromObjectId - Source object ID
   * @param {string} toObjectType - Target object type
   * @param {string} toObjectId - Target object ID
   * @returns {Promise<void>}
   */
  remove: async (fromObjectType, fromObjectId, toObjectType, toObjectId) => {
    const url = buildPath('crm.associations.delete', fromObjectType, fromObjectId, toObjectType, toObjectId)
    await client.del(url)
  },

  /**
   * Batch remove associations between multiple object pairs  
   * @param {string} fromObjectType - Source object type
   * @param {string} toObjectType - Target object type
   * @param {Array} pairs - Array of {fromId, toId} objects
   * @returns {Promise<Object>} Batch removal result
   */
  batchRemove: async (fromObjectType, toObjectType, pairs) => {
    const url = buildPath('crm.associations.batchArchive', fromObjectType, toObjectType)
    const inputs = pairs.map(pair => ({
      from: { id: pair.fromId },
      to: [{ id: pair.toId }]
    }))
    const res = await client.post(url, { inputs })
    return res.data
  },

  // Convenience methods for common association patterns

  /**
   * Associate a contact with a company (primary relationship)
   */
  associateContactToCompany: async (contactId, companyId, isPrimary = true) => {
    const typeId = isPrimary ? ASSOCIATION_TYPES.CONTACT_TO_COMPANY_PRIMARY : ASSOCIATION_TYPES.CONTACT_TO_COMPANY
    return await module.exports(client).create('contacts', contactId, 'companies', companyId, typeId)
  },

  /**
   * Associate a deal with both contact and company
   */
  associateDealToContactAndCompany: async (dealId, contactId, companyId) => {
    const associations = []
    
    if (contactId) {
      associations.push(
        module.exports(client).create('deals', dealId, 'contacts', contactId, ASSOCIATION_TYPES.DEAL_TO_CONTACT)
      )
    }
    
    if (companyId) {
      associations.push(
        module.exports(client).create('deals', dealId, 'companies', companyId, ASSOCIATION_TYPES.DEAL_TO_COMPANY_PRIMARY)
      )
    }
    
    return await Promise.allSettled(associations)
  },

  /**
   * Associate a note with contact, company, and/or deal
   */
  associateNote: async (noteId, { contactId, companyId, dealId, ticketId }) => {
    const associations = []
    
    if (contactId) {
      associations.push(
        module.exports(client).create('notes', noteId, 'contacts', contactId, ASSOCIATION_TYPES.NOTE_TO_CONTACT)
      )
    }
    
    if (companyId) {
      associations.push(
        module.exports(client).create('notes', noteId, 'companies', companyId, ASSOCIATION_TYPES.NOTE_TO_COMPANY)
      )
    }
    
    if (dealId) {
      associations.push(
        module.exports(client).create('notes', noteId, 'deals', dealId, ASSOCIATION_TYPES.NOTE_TO_DEAL)
      )
    }
    
    if (ticketId) {
      associations.push(
        module.exports(client).create('notes', noteId, 'tickets', ticketId, ASSOCIATION_TYPES.NOTE_TO_TICKET)
      )
    }
    
    return await Promise.allSettled(associations)
  },

  /**
   * Associate a call with contact
   */
  associateCallToContact: async (callId, contactId) => {
    return await module.exports(client).create('calls', callId, 'contacts', contactId, ASSOCIATION_TYPES.CALL_TO_CONTACT)
  },

  /**
   * Associate a task with contact (for record ownership)
   */
  associateTaskToContact: async (taskId, contactId) => {
    return await module.exports(client).create('tasks', taskId, 'contacts', contactId, ASSOCIATION_TYPES.TASK_TO_CONTACT)
  },

  /**
   * Associate a ticket with contact (for record ownership) 
   */
  associateTicketToOwner: async (ticketId, ownerId) => {
    // Note: Tickets don't directly associate to users, but to contacts who are the owners
    // In practice, you would associate the ticket to the contact that represents the user
    return await module.exports(client).create('tickets', ticketId, 'contacts', ownerId, ASSOCIATION_TYPES.TICKET_TO_CONTACT)
  },

  // Export constants for use by other modules
  TYPES: ASSOCIATION_TYPES,
  CATEGORIES: ASSOCIATION_CATEGORIES
})