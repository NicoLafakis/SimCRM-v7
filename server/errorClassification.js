// Error classification utility (Phase 4)
// Provides lightweight categorization & retryability hints for worker failures.
// Categories: rate_limit, network, auth, validation, timeout, unknown

function classifyError(err) {
  const out = { category: 'unknown', retryable: true }
  if (!err) return out
  const msg = (err.message || '').toLowerCase()
  const status = err.response?.status || err.status

  // Rate limit
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    out.category = 'rate_limit'; out.retryable = true; return out
  }
  // Auth
  if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('invalid token')) {
    out.category = 'auth'; out.retryable = false; return out
  }
  // Validation
  if (status === 400 || msg.includes('validation') || msg.includes('invalid') || msg.includes('bad request')) {
    out.category = 'validation'; out.retryable = false; return out
  }
  // Timeout
  if (msg.includes('timed out') || msg.includes('timeout')) {
    out.category = 'timeout'; out.retryable = true; return out
  }
  // Network
  if (msg.includes('econnreset') || msg.includes('ecconnrefused') || msg.includes('socket hang up') || msg.includes('network')) {
    out.category = 'network'; out.retryable = true; return out
  }
  // Fallback unknown retains default
  return out
}

module.exports = { classifyError }
