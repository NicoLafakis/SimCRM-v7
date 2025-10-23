const axios = require('axios')
const baseURL = process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function parseRetryAfter(header) {
  if (!header) return null
  const sec = parseInt(header, 10)
  if (!isNaN(sec)) return sec * 1000
  const date = Date.parse(header)
  if (!isNaN(date)) return date - Date.now()
  return null
}

// Telemetry handlers (injected by worker/server for Redis metrics collection)
let telemetry = {
  onRateLimit: () => {}, // (attempt, retryAfterMs) => void
  onRetryScheduled: () => {}, // (attempt, delayMs, status) => void
}

function setTelemetryHandlers(h) { telemetry = { ...telemetry, ...(h||{}) } }
function getTelemetryHandlers() { return telemetry }

function createClient({ apiToken, maxRetries = 4, baseDelay = 500 } = {}) {
  // Allow creation without a token; token must be supplied before making a request.
  let currentToken = apiToken || null

  const axiosInstance = axios.create({
    baseURL,
    timeout: 15000,
  })

  function ensureAuth() {
    if (!currentToken) throw new Error('HubSpot token not set for client')
    axiosInstance.defaults.headers.Authorization = `Bearer ${currentToken}`
    axiosInstance.defaults.headers['Content-Type'] = 'application/json'
  }

  async function requestWithRetry(method, url, ...args) {
    let attempt = 0
    while (true) {
      try {
        const res = await axiosInstance[method](url, ...args)
        return res
      } catch (err) {
        attempt++
        const status = err.response?.status
        const retryAfter = parseRetryAfter(err.response?.headers?.['retry-after'])

        const shouldRetry = (() => {
          // 429: rate limit - should honor Retry-After if provided
          if (status === 429) return true
          // 5xx: transient server errors
          if (status >= 500 && status < 600) return true
          // network / timeout errors (no response)
          if (!err.response) return true
          return false
        })()

        if (!shouldRetry || attempt > maxRetries) {
          // annotate and rethrow
          if (err.response) err.message = `HTTP ${err.response.status}: ${err.response.statusText} - ${err.message}`
          throw err
        }

        // if server provided Retry-After header, use it
        if (status === 429) {
          try { telemetry.onRateLimit?.(attempt, retryAfter || null) } catch {}
        }
        if (retryAfter) {
          try { telemetry.onRetryScheduled?.(attempt, retryAfter, status) } catch {}
          await sleep(retryAfter + 50)
          continue
        }

        // exponential backoff with jitter: baseDelay * 2^(attempt-1) +/- 0..baseDelay
        const exp = baseDelay * Math.pow(2, attempt - 1)
        const jitter = Math.floor(Math.random() * baseDelay)
        const delay = exp + jitter
        try { telemetry.onRetryScheduled?.(attempt, delay, status) } catch {}
        await sleep(delay)
        continue
      }
    }
  }

  return {
    setToken(token) { currentToken = token },
    get: (url, opts) => { ensureAuth(); return requestWithRetry('get', url, { params: opts }) },
    post: (url, data, opts) => { ensureAuth(); return requestWithRetry('post', url, data, opts) },
    patch: (url, data, opts) => { ensureAuth(); return requestWithRetry('patch', url, data, opts) },
    put: (url, data, opts) => { ensureAuth(); return requestWithRetry('put', url, data, opts) },
    del: (url, opts) => { ensureAuth(); return requestWithRetry('delete', url, opts) },
  }
}

module.exports = { createClient, setTelemetryHandlers, getTelemetryHandlers }
