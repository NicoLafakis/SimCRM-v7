// SimulationEngine: creates contacts, companies, associations, deals and lifecycle events.
class SimulationEngine {
  constructor({ onEvent = () => {} } = {}) {
    this.onEvent = onEvent
    this.interval = null
    this.records = { contacts: [], companies: [], deals: [] }
    this.nextId = 1
  }

  log(msg) {
    const timestamp = new Date().toLocaleTimeString()
    this.onEvent(`[${timestamp}] ${msg}`)
  }

  start() {
    if (this.interval) return
    this.log('Simulation started')
    // Create an initial contact-and-company pair immediately
    this.createContactWithCompany()
    // every 3 seconds create another contact and advance states
    this.interval = setInterval(() => this.tick(), 3000)
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
      this.log('Simulation stopped')
    }
  }

  tick() {
    // 50% chance create a new contact-company
    if (Math.random() < 0.5) {
      this.createContactWithCompany()
    }
    // Advance existing contacts through marketing stages
    this.records.contacts.forEach(c => this.advanceContact(c))
    // Advance deals
    this.records.deals.forEach(d => this.advanceDeal(d))
  }

  genId(prefix) {
    return `${prefix}_${this.nextId++}`
  }

  createCompany(name) {
    const company = { id: this.genId('cmp'), name }
    this.records.companies.push(company)
    this.log(`Created company ${company.id} (${company.name})`)
    return company
  }

  createContact(name, email) {
    const contact = {
      id: this.genId('ct'),
      name,
      email,
      lifecycle: 'subscriber',
      marketing_stage: 'new',
      notes: [],
      createdAt: Date.now()
    }
    this.records.contacts.push(contact)
    this.log(`Created contact ${contact.id} (${contact.name})`)
    return contact
  }

  associateContactCompany(contact, company) {
    contact.companyId = company.id
    this.log(`Associated contact ${contact.id} with company ${company.id}`)
  }

  createContactWithCompany() {
    const idx = this.records.contacts.length + 1
    const company = this.createCompany(`Company ${idx}`)
    const contact = this.createContact(`Contact ${idx}`, `contact${idx}@example.com`)
    this.associateContactCompany(contact, company)
    // add an initial marketing note
    this.addNote(contact, `Welcomed ${contact.name} to the mailing list.`)
  }

  addNote(entity, text) {
    const note = { id: this.genId('note'), text, createdAt: Date.now() }
    entity.notes = entity.notes || []
    entity.notes.push(note)
    this.log(`Added note to ${entity.id}: ${text}`)
  }

  advanceContact(contact) {
    // Simple marketing funnel: new -> engaged -> mql -> sql (maybe) -> opportunity
    const now = Date.now()
    const ageSec = Math.floor((now - contact.createdAt) / 1000)
    if (contact.marketing_stage === 'new' && ageSec > 2) {
      contact.marketing_stage = 'engaged'
      this.addNote(contact, 'Contact engaged with marketing content.')
    } else if (contact.marketing_stage === 'engaged' && ageSec > 6) {
      contact.marketing_stage = 'mql'
      contact.lifecycle = 'marketing_qualified_lead'
      this.addNote(contact, 'Contact became MQL.')
    } else if (contact.marketing_stage === 'mql' && ageSec > 10) {
      // decide fast MQL -> SQL or drop
      const fast = Math.random() < 0.7 // 70% fast path
      if (fast) {
        contact.marketing_stage = 'sql'
        contact.lifecycle = 'sales_qualified_lead'
        this.addNote(contact, 'Contact accepted as SQL (fast).')
        // create opportunity / deal
        const deal = this.createDealForContact(contact)
        contact.dealId = deal.id
      } else {
        contact.marketing_stage = 'nurture'
        this.addNote(contact, 'Contact moved to nurture track (slow).')
      }
    }
  }

  createDealForContact(contact) {
    const deal = {
      id: this.genId('deal'),
      contactId: contact.id,
      companyId: contact.companyId,
      stage: 'qualification',
      amount: Math.round(1000 + Math.random() * 9000),
      notes: [],
      createdAt: Date.now()
    }
    this.records.deals.push(deal)
    this.log(`Created deal ${deal.id} for contact ${contact.id}`)
    this.addNote(deal, 'Deal created and in qualification stage.')
    return deal
  }

  advanceDeal(deal) {
    const now = Date.now()
    const age = Math.floor((now - deal.createdAt) / 1000)
    if (deal.stage === 'qualification' && age > 4) {
      deal.stage = 'proposal'
      this.addNote(deal, 'Deal moved to proposal stage.')
    } else if (deal.stage === 'proposal' && age > 8) {
      // determine closed won or lost based on time-to-proposal
      const won = Math.random() < 0.6
      if (won) {
        deal.stage = 'closed_won'
        this.addNote(deal, `Deal closed won for $${deal.amount}`)
      } else {
        deal.stage = 'closed_lost'
        this.addNote(deal, 'Deal closed lost.')
      }
    }
  }
}

export default SimulationEngine
