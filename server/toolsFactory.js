const contacts = require('./tools/hubspot/contacts')
const companies = require('./tools/hubspot/companies')
const deals = require('./tools/hubspot/deals')
const tickets = require('./tools/hubspot/tickets')
const engagements = require('./tools/hubspot/engagements')
const quotes = require('./tools/hubspot/quotes')
const invoices = require('./tools/hubspot/invoices')
const customObjects = require('./tools/hubspot/customObjects')
const associations = require('./tools/hubspot/associations')

function createTools(client) {
  return {
    contacts: contacts(client),
    companies: companies(client),
    deals: deals(client),
    tickets: tickets(client),
    engagements: engagements(client),
    quotes: quotes(client),
    invoices: invoices(client),
    customObjects: customObjects(client),
    associations: associations(client),
  }
}

module.exports = { createTools }
