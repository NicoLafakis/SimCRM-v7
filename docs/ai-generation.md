# AI-Powered Data Generation

## Overview

SimCRM uses **Anthropic Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) to generate realistic CRM record data. The AI creates firmographic identities for contacts and companies as if they had filled out detailed forms at trade shows, plus realistic content for notes, calls, tasks, and tickets.

## Architecture

```
worker.js (job processor)
    ↓
aiDataGenerator.js (AI service layer - MODULAR)
    ↓ generates realistic properties
orchestrator.js (validates & creates records)
    ↓
propertyValidator.js (deduplicates enums)
    ↓
HubSpot API
```

### Key Design Principles

1. **Modular & Swappable**: AI layer is isolated in `server/aiDataGenerator.js` with clean interfaces
2. **Graceful Degradation**: Falls back to realistic synthetic data if AI unavailable
3. **Fully Observable**: Tracks success/fallback rates, latency, token usage, costs
4. **Production-Ready**: No dummy data, no placeholders, strict validation

## Custom SimCRM Properties

The AI generates 7-8 custom properties (prefixed with `simcrm_`) that hold rich marketing data not permitted in standard HubSpot fields:

### Contact Properties
- `simcrm_original_source` - Specific event/channel (e.g., "Trade Show - TechExpo 2025 San Francisco")
- `simcrm_buyer_role` - Role in decision process (Decision Maker | Influencer | End User | Champion)
- `simcrm_engagement_score` - Numeric score 0-100 (stored as string)
- `simcrm_lead_temperature` - Qualification level (hot | warm | cold) with reasoning
- `simcrm_marketing_consent_detail` - Explicit consent details

### Company Properties
- `simcrm_original_source` - Same as contact source (for consistency)
- `simcrm_product_interest` - JSON array of specific products/services

### Deal Properties
- `simcrm_product_interest` - JSON array of deal-specific products
- `simcrm_sales_notes` - Internal notes not visible to contact

### Property Group
All custom properties are grouped under **"SimCRM"** in HubSpot UI.

## Configuration

### Environment Variables

```bash
# AI Generation (required)
ANTHROPIC_API_KEY=sk-ant-api03-xxx...xxx
AI_MODEL=claude-haiku-4-5-20251001  # Default model
AI_ENABLED=true                      # Set to 'false' to disable AI

# Optional tuning
AI_TIMEOUT_MS=10000                  # Request timeout (default: 10s)
AI_MAX_RETRIES=2                     # Retry attempts (default: 2)
AI_GENERATION_LOG_LEVEL=info         # debug|info|warn|error (default: info)
AI_PROVIDER=anthropic                # Future: openai, local, etc.
```

### Pricing (Claude Haiku 4.5)

- **Input**: ~$0.80 per million tokens
- **Output**: ~$0.80 per million tokens
- **Estimated cost per record**: $0.0005 - $0.001 (varies by prompt size)
- **1000 contacts**: ~$0.50 - $1.00

## API Reference

### Core Functions

#### `generateContactAndCompany(context, redis, simulationId)`

Generates a matched contact and company pair.

**Context:**
```javascript
{
  index: 42,                     // Record number
  scenario: 'B2B',               // B2B | B2C
  distribution_method: 'EVEN'    // EVEN | SURGE | etc.
}
```

**Returns:**
```javascript
{
  contact: {
    firstname: 'Sarah',
    lastname: 'Chen',
    email: 'sarah.chen@innovatech.com',
    jobtitle: 'VP of Sales',
    phone: '+1-555-7824',
    simcrm_original_source: 'Trade Show - TechExpo 2025',
    simcrm_buyer_role: 'Decision Maker',
    simcrm_engagement_score: '87',
    simcrm_lead_temperature: 'hot',
    simcrm_marketing_consent_detail: 'Email and phone consent at booth',
    simcrm_generation_metadata: '{"method":"ai","model":"claude-haiku-4-5-20251001",...}'
  },
  company: {
    name: 'InnovaTech Solutions',
    domain: 'innovatech.com',
    industry: 'Technology',
    city: 'San Francisco',
    state: 'CA',
    country: 'United States',
    numberofemployees: '250',
    simcrm_original_source: 'Trade Show - TechExpo 2025',
    simcrm_product_interest: '["CRM Software","Marketing Automation"]',
    simcrm_generation_metadata: '{"method":"ai",...}'
  }
}
```

#### `generateDeal(context, redis, simulationId)`

Generates deal/opportunity data.

#### `generateNote(context, redis, simulationId)`

Generates note/engagement content (2-3 sentences).

#### `generateCall(context, redis, simulationId)`

Generates call log with status and duration.

#### `generateTask(context, redis, simulationId)`

Generates follow-up task with subject and body.

#### `generateTicket(context, redis, simulationId)`

Generates support ticket with subject and description.

#### `getHealthStatus()`

Returns current AI health status:
```javascript
{
  enabled: true,
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  apiKeyConfigured: true,
  lastSuccess: 1729788123456,
  consecutiveFailures: 0
}
```

## Observability

### Metrics Tracked (Redis Hash: `sim:<id>:metrics`)

| Field | Description |
|-------|-------------|
| `ai_generation_success` | Count of successful AI generations |
| `ai_generation_fallback` | Count of fallback generations (AI failed) |
| `ai_generation_total_latency_ms` | Sum of latency for averaging |
| `ai_generation_total_tokens` | Sum of input + output tokens |
| `ai_last_error_category` | Last error category (rate_limit, network, auth, timeout) |

### Metrics Endpoint

**GET** `/api/simulations/:id/metrics`

Returns enhanced response with `aiGeneration` object:
```json
{
  "ok": true,
  "simulationId": "sim-abc123",
  "metrics": { ... },
  "aiGeneration": {
    "successCount": 847,
    "fallbackCount": 3,
    "totalCount": 850,
    "successRate": "0.996",
    "avgLatencyMs": 324,
    "totalTokens": 450000,
    "estimatedCost": "$0.3600",
    "lastErrorCategory": null
  },
  "percentComplete": 0.85,
  "status": "RUNNING"
}
```

### Health Endpoint

**GET** `/api/health`

Returns AI status in `ai` field:
```json
{
  "ok": true,
  "ai": {
    "enabled": true,
    "provider": "anthropic",
    "model": "claude-haiku-4-5-20251001",
    "apiKeyConfigured": true,
    "lastSuccess": 1729788123456,
    "consecutiveFailures": 0
  },
  ...
}
```

### Structured Logs

AI operations emit structured logs with these event IDs:

- `AI_GEN_SUCCESS` - Successful generation (includes latency, tokens)
- `AI_GEN_FALLBACK` - Fallback used (includes reason)
- `AI_GEN_ERROR` - Generation error (includes error message, category)
- `AI_GEN_RETRY` - Retry attempt (includes attempt number)

Example log:
```json
{
  "eventId": "AI_GEN_SUCCESS",
  "msg": "ai generation success",
  "model": "claude-haiku-4-5-20251001",
  "latencyMs": 342,
  "tokens": 1247,
  "simulationId": "sim-abc123",
  "recordIndex": 42
}
```

### Boss Console AI Panel

The Boss Operations Console includes an **AI Generation Health** panel showing:

- **Success Rate** (color-coded: green >95%, yellow >80%, red <80%)
- **AI Success** count
- **Fallback** count (warns if >0)
- **Avg Latency** (ms)
- **Total Tokens** used
- **Est. Cost** (calculated from token usage)
- **Last Error Category** (if any)

## Fallback Behavior

When AI generation fails or is disabled, SimCRM uses deterministic synthetic data generation:

### Fallback Triggers
1. `AI_ENABLED=false` in environment
2. Missing `ANTHROPIC_API_KEY`
3. API timeout (>10s by default)
4. Rate limit exceeded (429 responses)
5. Network errors
6. All retry attempts exhausted

### Fallback Strategy
- **Deterministic**: Same index produces same data (reproducible)
- **Realistic**: Uses curated lists of names, companies, industries
- **Varied**: Rotates through lists to create diversity
- **Scenario-Aware**: Adjusts content based on B2B vs B2C
- **Tracked**: Every fallback increments metrics and logs reason

### Fallback Data Quality
- Unique emails: `firstname.lastname{index}@company.com`
- Unique domains: `{company}{index}.com`
- Valid phone numbers: `+1-555-XXXX`
- All custom `simcrm_` fields populated
- Metadata indicates `method: "fallback"`

## Error Handling

### Retry Logic
1. Initial attempt
2. Wait 1s, retry (attempt 2)
3. Wait 2s, retry (attempt 3, final)
4. Fall back to synthetic data

### Error Categories
- `rate_limit` - 429 from Anthropic (cooldown applied)
- `network` - Connection issues
- `auth` - Invalid API key
- `timeout` - Request exceeded timeout
- `model_error` - Model returned error response
- `unknown` - Uncategorized error

### Circuit Breaker
If consecutive failures exceed threshold, worker circuit breaker trips (see `docs/ratelimits.md`).

## Testing

### Run AI Generator Tests
```bash
npm test -- test/aiDataGenerator.test.js
```

### Test Coverage
- ✅ Contact and company generation (fallback)
- ✅ Deal, note, call, task, ticket generation
- ✅ B2B vs B2C scenario handling
- ✅ Custom property validation
- ✅ Metrics tracking
- ✅ Health status reporting
- ✅ Error handling (null Redis, missing data)
- ✅ Data quality (uniqueness, format validation)
- ✅ Fallback metadata

### Mock Testing (Future)
To test AI integration without real API calls, mock the Anthropic client:
```javascript
// Mock successful response
const mockAnthropicClient = {
  messages: {
    create: async () => ({
      content: [{ text: JSON.stringify({ contact: {...}, company: {...} }) }],
      usage: { input_tokens: 500, output_tokens: 300 }
    })
  }
}
```

## Integration Points

### Worker Integration
File: `server/worker.js:322-400`

The worker calls AI generator in two phases:

**Primary Phase** (contact_created):
```javascript
const generatedData = await aiGenerator.generateContactAndCompany(context, redisClient, simulationId)
const result = await orchestrator.createContactWithCompany({
  contactProps: generatedData.contact,
  companyProps: generatedData.company,
  simId: simulationId
})
```

**Secondary Phase** (notes/calls/tasks/tickets):
```javascript
const noteData = await aiGenerator.generateNote(context, redisClient, simulationId)
await orchestrator.createNoteWithAssociations({
  noteProps: noteData,
  contactId: recordIds?.contactId,
  simId: simulationId
})
```

### Property Validation
All AI-generated properties flow through `propertyValidator.js` which:
- Deduplicates enum values (fuzzy matching >85%)
- Validates field types
- Caches HubSpot field metadata (1h TTL)
- Tracks email/domain uniqueness globally

See `docs/record-creation-rules.md` for HubSpot field restrictions.

## Future Enhancements

### Planned Features
1. **AI Provider Swapping**: Support OpenAI, local models via `AI_PROVIDER` env var
2. **Prompt Templates**: Externalize prompts to allow customization without code changes
3. **Batch Generation**: Generate multiple records in single API call for efficiency
4. **Fine-Tuned Models**: Train custom models on domain-specific CRM data
5. **Contextual Deals**: Use contact/company data when generating deals (currently basic)
6. **Smart Scheduling**: Use AI to determine realistic timing for secondary activities
7. **Multi-Language**: Generate data in different languages based on company location

### Configuration API (Proposed)
```
GET  /api/boss/ai-config       # View current AI settings
PUT  /api/boss/ai-config       # Update prompts, model, timeout (boss-only)
POST /api/boss/ai-config/test  # Test prompt with sample data
```

## Troubleshooting

### AI Not Generating Data
1. Check `AI_ENABLED` is not set to `false`
2. Verify `ANTHROPIC_API_KEY` is set correctly
3. Check health endpoint: `curl http://localhost:5000/api/health`
4. Review structured logs for `AI_GEN_ERROR` events
5. Check Boss Console AI panel for error details

### High Fallback Rate
1. Check Anthropic API status: https://status.anthropic.com
2. Review rate limits on your API key
3. Increase `AI_TIMEOUT_MS` if latency is high
4. Check network connectivity to Anthropic API
5. Review `ai_last_error_category` in metrics

### Cost Concerns
1. Monitor `totalTokens` in metrics endpoint
2. Use `estimatedCost` to project spending
3. Reduce `AI_MAX_RETRIES` to minimize retry costs
4. Consider setting `AI_ENABLED=false` for dev/test
5. Use fallback mode for high-volume testing

### Fallback Data Quality Issues
Fallback is intentionally deterministic. If you need more variety:
1. Enable AI generation (`AI_ENABLED=true`)
2. Or modify fallback arrays in `aiDataGenerator.js:115-130`
3. Or use index-based seeding for pseudo-randomness

## Security & Compliance

### API Key Storage
- Store `ANTHROPIC_API_KEY` in environment variables ONLY
- Never commit API keys to version control
- Use secret management systems in production (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys periodically

### Data Privacy
- AI-generated data is fictional and does not represent real individuals
- No PII from production CRM is sent to Anthropic API
- HubSpot tokens are encrypted at rest (see `docs/integrations-hubspot-tokens.md`)
- AI prompts do not include sensitive business logic

### Compliance
- Review Anthropic's [Terms of Service](https://www.anthropic.com/legal/terms)
- Ensure compliance with your organization's AI usage policy
- Consider data residency requirements (Anthropic operates in US)

## Related Documentation

- `docs/job-queue-architecture.md` - Worker and job processing
- `docs/record-creation-rules.md` - HubSpot field restrictions
- `docs/ratelimits.md` - Rate limiting and circuit breakers
- `docs/observability.md` - Metrics and logging
- `README.md` - Main project overview

## Support

For issues or questions:
1. Check structured logs for error details
2. Review Boss Console AI Health panel
3. Consult `/api/health` endpoint
4. Open issue at https://github.com/anthropics/claude-code/issues (if Claude Code related)
5. Review Anthropic API documentation: https://docs.anthropic.com
