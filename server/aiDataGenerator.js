// AI Data Generator - Anthropic Claude Haiku 4.5 integration
// Generates realistic CRM record data with observability and fallback strategy

const { logInfo, logError } = require('./logging')
const EVENTS = require('./logEvents')

// Configuration
const AI_ENABLED = process.env.AI_ENABLED !== 'false' // enabled by default
const AI_PROVIDER = process.env.AI_PROVIDER || 'anthropic'
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '10000', 10)
const AI_MAX_RETRIES = parseInt(process.env.AI_MAX_RETRIES || '2', 10)
const AI_LOG_LEVEL = process.env.AI_GENERATION_LOG_LEVEL || 'info'

// Anthropic client (lazy init)
let anthropicClient = null

function getAnthropicClient() {
  if (!anthropicClient && ANTHROPIC_API_KEY) {
    try {
      const Anthropic = require('@anthropic-ai/sdk')
      anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    } catch (e) {
      console.warn('Anthropic SDK not available:', e.message)
      return null
    }
  }
  return anthropicClient
}

// Health tracking
let lastSuccessTimestamp = null
let consecutiveFailures = 0

// Helper: Call Anthropic API with retry logic
async function callAnthropic(prompt, context = {}, retries = AI_MAX_RETRIES) {
  const client = getAnthropicClient()
  if (!client) {
    throw new Error('Anthropic client not initialized')
  }

  const startTime = Date.now()
  let lastError = null

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await Promise.race([
        client.messages.create({
          model: AI_MODEL,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI request timeout')), AI_TIMEOUT_MS)
        )
      ])

      const latencyMs = Date.now() - startTime
      const content = response.content[0]?.text || ''
      const tokens = {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0,
        total: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }

      // Success tracking
      lastSuccessTimestamp = Date.now()
      consecutiveFailures = 0

      if (AI_LOG_LEVEL === 'debug' || AI_LOG_LEVEL === 'info') {
        logInfo({
          eventId: EVENTS.AI_GENERATION_SUCCESS,
          msg: 'ai generation success',
          model: AI_MODEL,
          latencyMs,
          tokens: tokens.total,
          attempt,
          ...context
        })
      }

      return { content, latencyMs, tokens, method: 'ai' }
    } catch (error) {
      lastError = error
      consecutiveFailures++

      if (attempt <= retries) {
        logInfo({
          eventId: EVENTS.AI_GENERATION_RETRY,
          msg: 'ai generation retry',
          attempt,
          maxRetries: retries,
          error: error.message,
          ...context
        })
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)))
      }
    }
  }

  // All retries exhausted
  logError({
    eventId: EVENTS.AI_GENERATION_ERROR,
    msg: 'ai generation error',
    error: lastError?.message || 'unknown error',
    attempts: retries + 1,
    ...context
  })

  throw lastError
}

// Parse JSON from AI response (handles markdown code blocks)
function parseAIResponse(content) {
  try {
    // Try direct parse first
    return JSON.parse(content)
  } catch {
    // Try extracting from markdown code block
    const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (match) {
      return JSON.parse(match[1])
    }
    // Try finding first { to last }
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(content.substring(start, end + 1))
    }
    throw new Error('No valid JSON found in AI response')
  }
}

// Fallback data generators
function generateFallbackContactAndCompany(context) {
  const { index, scenario } = context
  const isB2B = scenario === 'B2B'

  const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason', 'Isabella', 'William']
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']
  const companyTypes = ['Solutions', 'Technologies', 'Consulting', 'Group', 'Industries', 'Systems', 'Partners', 'Enterprises']
  const industries = isB2B ? ['Technology', 'Manufacturing', 'Healthcare', 'Finance', 'Consulting'] : ['Retail', 'E-commerce', 'Services', 'Consumer Goods', 'Hospitality']
  const jobTitles = isB2B ? ['VP of Sales', 'Director of Marketing', 'CTO', 'Product Manager', 'Head of Operations'] : ['Store Manager', 'Marketing Coordinator', 'Sales Associate', 'Customer Success Manager', 'Account Executive']

  const firstName = firstNames[index % firstNames.length]
  const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length]
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`
  const companyName = `${lastName} ${companyTypes[index % companyTypes.length]}`
  const domain = `${lastName.toLowerCase()}${companyTypes[index % companyTypes.length].toLowerCase()}.com`

  const contact = {
    firstname: firstName,
    lastname: lastName,
    email: email,
    jobtitle: jobTitles[index % jobTitles.length],
    phone: `+1-555-${String(1000 + (index % 9000)).padStart(4, '0')}`,
    simcrm_original_source: 'Trade Show - Tech Expo 2025',
    simcrm_buyer_role: ['Decision Maker', 'Influencer', 'End User'][index % 3],
    simcrm_engagement_score: String(Math.floor(50 + (index % 50))),
    simcrm_lead_temperature: ['hot', 'warm', 'cold'][index % 3],
    simcrm_marketing_consent_detail: 'Email and phone consent received at trade show booth'
  }

  const company = {
    name: companyName,
    domain: domain,
    industry: industries[index % industries.length],
    city: ['San Francisco', 'New York', 'Austin', 'Seattle', 'Boston'][index % 5],
    state: ['CA', 'NY', 'TX', 'WA', 'MA'][index % 5],
    country: 'United States',
    numberofemployees: isB2B ? String([50, 100, 250, 500, 1000][index % 5]) : String([10, 25, 50, 100, 200][index % 5]),
    simcrm_original_source: 'Trade Show - Tech Expo 2025',
    simcrm_product_interest: JSON.stringify(['CRM Software', 'Marketing Automation'][index % 2])
  }

  return { contact, company }
}

function generateFallbackDeal(context) {
  const { index, contactData } = context
  const dealNames = ['Enterprise Agreement', 'Platform License', 'Professional Services', 'Annual Subscription', 'Implementation Project']

  return {
    dealname: `${dealNames[index % dealNames.length]} - ${contactData?.company?.name || 'Company'}`,
    amount: String(5000 + (index % 95000)),
    closedate: new Date(Date.now() + (30 + (index % 60)) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    simcrm_product_interest: JSON.stringify(['CRM', 'Marketing'][index % 2]),
    simcrm_sales_notes: 'Deal created via simulation - follow up required'
  }
}

function generateFallbackNote(context) {
  const { index, contactData } = context
  const templates = [
    `Initial contact with ${contactData?.contact?.firstname || 'contact'} - discussed their needs and pain points.`,
    `Follow-up call completed. They are interested in learning more about our solutions.`,
    `Sent product information and case studies. Scheduled demo for next week.`,
    `Demo completed successfully. Waiting for feedback from their team.`,
    `Received positive feedback. Moving forward with proposal preparation.`
  ]
  return {
    body: templates[index % templates.length]
  }
}

function generateFallbackCall(context) {
  const { index, contactData } = context
  const outcomes = ['Connected', 'Left voicemail', 'Scheduled callback', 'Discovery call', 'Demo scheduled']

  return {
    body: `Call with ${contactData?.contact?.firstname || 'contact'} - ${outcomes[index % outcomes.length]}. Discussed current challenges and potential solutions.`,
    status: 'COMPLETED',
    duration: String(300 + (index % 1500)) // 5-30 minutes in seconds
  }
}

function generateFallbackTask(context) {
  const { index, contactData } = context
  const subjects = [
    'Follow up on demo',
    'Send proposal',
    'Schedule next meeting',
    'Review contract',
    'Prepare presentation'
  ]

  return {
    subject: subjects[index % subjects.length],
    body: `Follow up with ${contactData?.contact?.firstname || 'contact'} regarding their interest in our solutions.`,
    status: 'NOT_STARTED'
  }
}

function generateFallbackTicket(context) {
  const { index, contactData } = context
  const subjects = [
    'Technical support request',
    'Feature inquiry',
    'Billing question',
    'Integration assistance',
    'Training request'
  ]

  return {
    subject: subjects[index % subjects.length],
    content: `Support request from ${contactData?.contact?.firstname || 'contact'} - requires technical assistance.`
  }
}

// Main generation functions
async function generateContactAndCompany(context, redis = null, simulationId = null) {
  const { index, scenario, distribution_method } = context
  const startTime = Date.now()

  if (!AI_ENABLED || !ANTHROPIC_API_KEY) {
    const result = generateFallbackContactAndCompany(context)

    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, {
        method: 'fallback',
        reason: AI_ENABLED ? 'no_api_key' : 'disabled',
        latencyMs: Date.now() - startTime
      })
    }

    return {
      ...result,
      simcrm_generation_metadata: JSON.stringify({
        method: 'fallback',
        reason: AI_ENABLED ? 'no_api_key' : 'disabled',
        timestamp: Date.now(),
        latencyMs: Date.now() - startTime
      })
    }
  }

  const prompt = buildContactAndCompanyPrompt(context)

  try {
    const response = await callAnthropic(prompt, { simulationId, recordIndex: index, type: 'contact_company' })
    const data = parseAIResponse(response.content)

    // Add generation metadata to both contact and company
    const metadata = JSON.stringify({
      method: 'ai',
      model: AI_MODEL,
      timestamp: Date.now(),
      latencyMs: response.latencyMs,
      attemptCount: 1,
      tokens: response.tokens.total
    })

    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, {
        method: 'ai',
        latencyMs: response.latencyMs,
        tokens: response.tokens
      })
    }

    return {
      contact: {
        ...data.contact,
        simcrm_generation_metadata: metadata
      },
      company: {
        ...data.company,
        simcrm_generation_metadata: metadata
      }
    }
  } catch (error) {
    logError({
      eventId: EVENTS.AI_GENERATION_FALLBACK,
      msg: 'ai generation fallback',
      reason: error.message,
      simulationId,
      recordIndex: index,
      type: 'contact_company'
    })

    const result = generateFallbackContactAndCompany(context)

    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, {
        method: 'fallback',
        reason: error.message,
        latencyMs: Date.now() - startTime
      })
    }

    return {
      contact: {
        ...result.contact,
        simcrm_generation_metadata: JSON.stringify({
          method: 'fallback',
          reason: error.message,
          timestamp: Date.now(),
          latencyMs: Date.now() - startTime
        })
      },
      company: {
        ...result.company,
        simcrm_generation_metadata: JSON.stringify({
          method: 'fallback',
          reason: error.message,
          timestamp: Date.now(),
          latencyMs: Date.now() - startTime
        })
      }
    }
  }
}

async function generateDeal(context, redis = null, simulationId = null) {
  const { index, contactData } = context
  const startTime = Date.now()

  if (!AI_ENABLED || !ANTHROPIC_API_KEY) {
    return generateFallbackDeal(context)
  }

  const prompt = buildDealPrompt(context)

  try {
    const response = await callAnthropic(prompt, { simulationId, recordIndex: index, type: 'deal' })
    const data = parseAIResponse(response.content)

    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, {
        method: 'ai',
        latencyMs: response.latencyMs,
        tokens: response.tokens
      })
    }

    return {
      ...data,
      simcrm_generation_metadata: JSON.stringify({
        method: 'ai',
        model: AI_MODEL,
        timestamp: Date.now(),
        latencyMs: response.latencyMs,
        tokens: response.tokens.total
      })
    }
  } catch (error) {
    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, {
        method: 'fallback',
        reason: error.message,
        latencyMs: Date.now() - startTime
      })
    }
    return generateFallbackDeal(context)
  }
}

async function generateNote(context, redis = null, simulationId = null) {
  const { index, contactData } = context
  const startTime = Date.now()

  if (!AI_ENABLED || !ANTHROPIC_API_KEY) {
    return generateFallbackNote(context)
  }

  const prompt = buildNotePrompt(context)

  try {
    const response = await callAnthropic(prompt, { simulationId, recordIndex: index, type: 'note' })
    const data = parseAIResponse(response.content)

    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, { method: 'ai', latencyMs: response.latencyMs, tokens: response.tokens })
    }

    return data
  } catch (error) {
    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, { method: 'fallback', reason: error.message, latencyMs: Date.now() - startTime })
    }
    return generateFallbackNote(context)
  }
}

async function generateCall(context, redis = null, simulationId = null) {
  const { index, contactData } = context
  const startTime = Date.now()

  if (!AI_ENABLED || !ANTHROPIC_API_KEY) {
    return generateFallbackCall(context)
  }

  const prompt = buildCallPrompt(context)

  try {
    const response = await callAnthropic(prompt, { simulationId, recordIndex: index, type: 'call' })
    const data = parseAIResponse(response.content)

    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, { method: 'ai', latencyMs: response.latencyMs, tokens: response.tokens })
    }

    return data
  } catch (error) {
    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, { method: 'fallback', reason: error.message, latencyMs: Date.now() - startTime })
    }
    return generateFallbackCall(context)
  }
}

async function generateTask(context, redis = null, simulationId = null) {
  const { index, contactData } = context
  const startTime = Date.now()

  if (!AI_ENABLED || !ANTHROPIC_API_KEY) {
    return generateFallbackTask(context)
  }

  const prompt = buildTaskPrompt(context)

  try {
    const response = await callAnthropic(prompt, { simulationId, recordIndex: index, type: 'task' })
    const data = parseAIResponse(response.content)

    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, { method: 'ai', latencyMs: response.latencyMs, tokens: response.tokens })
    }

    return data
  } catch (error) {
    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, { method: 'fallback', reason: error.message, latencyMs: Date.now() - startTime })
    }
    return generateFallbackTask(context)
  }
}

async function generateTicket(context, redis = null, simulationId = null) {
  const { index, contactData } = context
  const startTime = Date.now()

  if (!AI_ENABLED || !ANTHROPIC_API_KEY) {
    return generateFallbackTicket(context)
  }

  const prompt = buildTicketPrompt(context)

  try {
    const response = await callAnthropic(prompt, { simulationId, recordIndex: index, type: 'ticket' })
    const data = parseAIResponse(response.content)

    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, { method: 'ai', latencyMs: response.latencyMs, tokens: response.tokens })
    }

    return data
  } catch (error) {
    if (redis && simulationId) {
      await trackMetrics(redis, simulationId, { method: 'fallback', reason: error.message, latencyMs: Date.now() - startTime })
    }
    return generateFallbackTicket(context)
  }
}

// Prompt builders
function buildContactAndCompanyPrompt(context) {
  const { index, scenario, distribution_method } = context
  const isB2B = scenario === 'B2B'

  return `Generate realistic ${isB2B ? 'B2B' : 'B2C'} contact and company data as if they filled out a detailed form at a trade show. This is record #${index} in a CRM simulation.

Context:
- Scenario: ${scenario}
- Distribution: ${distribution_method}
- Use Case: ${isB2B ? 'Enterprise software sales' : 'Consumer product sales'}

Generate a JSON object with this exact structure (no markdown, just JSON):
{
  "contact": {
    "firstname": "string",
    "lastname": "string",
    "email": "string (realistic, unique)",
    "jobtitle": "string (${isB2B ? 'relevant to B2B decision maker' : 'consumer or retail role'})",
    "phone": "string (format: +1-555-XXXX)",
    "simcrm_original_source": "string (specific trade show or event name)",
    "simcrm_buyer_role": "string (Decision Maker | Influencer | End User | Champion)",
    "simcrm_engagement_score": "string (0-100 number as string)",
    "simcrm_lead_temperature": "string (hot | warm | cold with reasoning)",
    "simcrm_marketing_consent_detail": "string (specific consent details)"
  },
  "company": {
    "name": "string (realistic company name)",
    "domain": "string (matching company website domain)",
    "industry": "string (${isB2B ? 'B2B industry' : 'B2C industry'})",
    "city": "string (US city)",
    "state": "string (2-letter state code)",
    "country": "string (United States)",
    "numberofemployees": "string (${isB2B ? '50-5000' : '10-500'} number as string)",
    "simcrm_original_source": "string (same as contact source)",
    "simcrm_product_interest": "string (JSON array of interested products/services)"
  }
}

Requirements:
- Make data realistic and varied
- Email must be unique (use index ${index} if needed)
- Domain must match company name
- All custom simcrm_ fields must be populated
- No placeholders or "example.com" domains
- Return ONLY valid JSON`
}

function buildDealPrompt(context) {
  const { contactData, index } = context
  const companyName = contactData?.company?.name || 'the company'
  const contactName = contactData?.contact?.firstname || 'the contact'

  return `Generate a realistic deal/opportunity for ${contactName} at ${companyName}.

Context:
- Contact: ${JSON.stringify(contactData?.contact || {})}
- Company: ${JSON.stringify(contactData?.company || {})}

Generate a JSON object with this structure (no markdown, just JSON):
{
  "dealname": "string (specific, not generic)",
  "amount": "string (realistic dollar amount as string, no $ symbol)",
  "closedate": "string (ISO date 30-90 days from now)",
  "simcrm_product_interest": "string (JSON array of specific products)",
  "simcrm_sales_notes": "string (internal notes about the deal)"
}

Return ONLY valid JSON.`
}

function buildNotePrompt(context) {
  const { contactData, index } = context
  const contactName = contactData?.contact?.firstname || 'the contact'

  return `Generate a realistic note/engagement for ${contactName}.

Context: ${JSON.stringify(contactData || {})}

Generate a JSON object: { "body": "string (2-3 sentences about interaction)" }

Return ONLY valid JSON.`
}

function buildCallPrompt(context) {
  const { contactData, index } = context
  const contactName = contactData?.contact?.firstname || 'the contact'

  return `Generate a realistic call log for ${contactName}.

Context: ${JSON.stringify(contactData || {})}

Generate a JSON object:
{
  "body": "string (call summary, 2-3 sentences)",
  "status": "COMPLETED",
  "duration": "string (duration in seconds, 300-1800)"
}

Return ONLY valid JSON.`
}

function buildTaskPrompt(context) {
  const { contactData, index } = context
  const contactName = contactData?.contact?.firstname || 'the contact'

  return `Generate a realistic follow-up task for ${contactName}.

Context: ${JSON.stringify(contactData || {})}

Generate a JSON object:
{
  "subject": "string (task title)",
  "body": "string (task description)",
  "status": "NOT_STARTED"
}

Return ONLY valid JSON.`
}

function buildTicketPrompt(context) {
  const { contactData, index } = context
  const contactName = contactData?.contact?.firstname || 'the contact'

  return `Generate a realistic support ticket for ${contactName}.

Context: ${JSON.stringify(contactData || {})}

Generate a JSON object:
{
  "subject": "string (ticket subject)",
  "content": "string (ticket description, 2-3 sentences)"
}

Return ONLY valid JSON.`
}

// Metrics tracking
async function trackMetrics(redis, simulationId, data) {
  if (!redis) return

  const metricsKey = `sim:${simulationId}:metrics`

  try {
    if (data.method === 'ai') {
      await redis.hIncrBy(metricsKey, 'ai_generation_success', 1)
      await redis.hIncrBy(metricsKey, 'ai_generation_total_latency_ms', Math.round(data.latencyMs))
      if (data.tokens) {
        await redis.hIncrBy(metricsKey, 'ai_generation_total_tokens', data.tokens.total)
      }
    } else if (data.method === 'fallback') {
      await redis.hIncrBy(metricsKey, 'ai_generation_fallback', 1)
      await redis.hSet(metricsKey, 'ai_last_error_category', data.reason || 'unknown')
    }
  } catch (e) {
    console.warn('Failed to track AI metrics:', e.message)
  }
}

// Health check
function getHealthStatus() {
  return {
    enabled: AI_ENABLED,
    provider: AI_PROVIDER,
    model: AI_MODEL,
    apiKeyConfigured: !!ANTHROPIC_API_KEY,
    lastSuccess: lastSuccessTimestamp,
    consecutiveFailures
  }
}

module.exports = {
  generateContactAndCompany,
  generateDeal,
  generateNote,
  generateCall,
  generateTask,
  generateTicket,
  getHealthStatus
}
