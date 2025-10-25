# GitHub Copilot Instructions for SimCRM v7

**Last Updated:** October 22, 2025  
**Purpose:** System-level guidance for AI assistants working on SimCRM v7

---

# SimCRM v7 - Repository Context

**Last Updated:** October 22, 2025  
**Purpose:** Technical context and architectural guidance for SimCRM v7

---

## Project Overview

SimCRM v7 is a HubSpot CRM simulation tool that creates realistic test data at scale. The application coordinates multi-stage data generation through a Redis-backed job queue, handles HubSpot API rate limits with circuit breakers, and validates property values to prevent duplicate enums. The system supports B2B and B2C scenarios with configurable parameters and provides real-time observability through structured logging and metrics.

---

## Tech Stack

- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **Database:** MySQL (via Knex migrations)
- **Queue:** BullMQ (Redis-backed)
- **Testing:** Mocha + Chai
- **Authentication:** Scrypt password hashing (TODO: Upgrade to Argon2id)
- **Token Storage:** AES-256-CBC encryption with `TOKEN_ENC_SECRET`

---

## Folder Structure

```
server/
├── worker.js                  # Job processing, rate limiting, segment expansion
├── orchestrator.js            # Record creation coordination via HubSpot API
├── propertyValidator.js       # Property deduplication & validation
├── propertyValueCache.js      # Redis cache for property values
├── hubspotKeyStore.js         # Encrypted token storage
├── auth.js                    # User authentication
├── logging.js                 # Structured logging
├── errorClassification.js     # Error categorization
├── cryptoUtil.js              # Encryption/decryption utilities
├── db.js                      # Database queries
├── toolsFactory.js            # Tool registration
└── tools/hubspot/
    ├── apiRegistry.js         # HubSpot endpoint definitions
    ├── contacts.js            # Contact creation
    ├── companies.js           # Company creation
    └── deals.js               # Deal creation

src/
├── components/
│   ├── ObservabilityDashboard.jsx
│   ├── TetrisVerification.jsx
│   ├── Scenario/
│   │   └── scenarioOptions.js
│   └── Themes/
└── ...

docs/
├── job-queue-architecture.md
├── ratelimits.md
├── integrations-hubspot-tokens.md
├── record-creation-rules.md
├── redis-plain-language.md
├── observability.md
├── ui-rules.md
├── scenarios.md
├── verification-flow.md
└── hubspot-api-registry.md

test/
├── {module}.test.js           # Unit tests
└── {feature}.integration.test.js  # Integration tests
```

---

## Documentation Map

**Context for code modifications in specific areas:**

| Code Area | Essential Documentation | Related Files |
|-----------|------------------------|---------------|
| Worker logic, job scheduling, segments | `docs/job-queue-architecture.md` | `server/worker.js`, `server/orchestrator.js` |
| API rate limiting, retries, backoff | `docs/ratelimits.md` | `server/worker.js`, `server/logging.js` |
| HubSpot authentication, tokens | `docs/integrations-hubspot-tokens.md` | `server/cryptoUtil.js`, `server/hubspotKeyStore.js` |
| HubSpot record creation, fields | `docs/record-creation-rules.md` | `server/tools/hubspot/*.js` |
| Redis keys, coordination state | `docs/redis-plain-language.md` | `server/orchestrator.js`, `server/worker.js` |
| Logging, metrics, monitoring | `docs/observability.md` | `server/logging.js`, `src/components/ObservabilityDashboard.jsx` |
| UI styling, components, themes | `docs/ui-rules.md` | `src/components/*`, `src/components/Themes/*` |
| Scenario parameters, B2B/B2C | `docs/scenarios.md` | `src/components/Scenario/scenarioOptions.js`, `server/scenarioParameters.js` |
| Tetris verification game | `docs/verification-flow.md` | `src/components/TetrisVerification.jsx` |
| HubSpot API endpoints | `docs/hubspot-api-registry.md` | `server/tools/hubspot/apiRegistry.js` |
| Property validation & caching | `LATEST_PROGRESS.md` (Property Validator section) | `server/propertyValidator.js`, `server/propertyValueCache.js` |

---

## Critical Modules

| Module | Purpose | Key Characteristics |
|--------|---------|---------------------|
| `server/worker.js` | Job processing, rate limiting, segment expansion | Core simulation execution - handles primary segment jobs and secondary activity jobs |
| `server/orchestrator.js` | Record creation coordination | Calls HubSpot APIs - validates all properties before creation |
| `server/propertyValidator.js` | Property deduplication & validation | Prevents duplicate enum errors using fuzzy matching (85% threshold) - must not be bypassed |
| `server/propertyValueCache.js` | Redis-based property value storage | Caches existing property values by object type and field name |
| `server/hubspotKeyStore.js` | Encrypted token storage | Security critical - tokens encrypted at rest, decrypted only at API call time |
| `server/auth.js` | User authentication | Uses scrypt hashing (format: `scrypt:<salt>:<hash>`) |
| `src/components/TetrisVerification.jsx` | Verification mini-game | Has classic/enhanced modes with different scoring rules |
| `server/logging.js` | Structured logging | Standardized log format for observability - no console.log in production |

---

## Data Flow Architecture

```
User configures simulation (React UI)
    ↓
POST /api/simulations (creates DB record)
    ↓
POST /api/simulations/:id/start (enqueues first hour segment)
    ↓
Worker picks up job from simulation-jobs:{shard} queue
    ↓
Worker expands hour segment into individual record creation jobs
    ↓
Record creation jobs enqueued on simulation-jobs:{shard}
    ↓
Orchestrator processes record creation via HubSpot API
    ↓
propertyValidator checks for duplicate enum values
    ↓
propertyValueCache stores values in Redis (meta:{objectType}:fields:{fieldName})
    ↓
Worker marks segment complete, enqueues next hour segment
    ↓
Simulation completes when all segments processed
```

---

## Security & Data Constraints

### Production Data Policy

**All production code paths must use real authenticated values:**

- `user.id` must be a real authenticated user ID (fail with HTTP 400 if missing)
- HubSpot tokens validated via actual API call, not heuristics or length checks
- No auto-fallback to `demo-user`, `test-user`, or synthetic identifiers
- No placeholder API keys or mock tokens in runtime code
- Abort with explicit error if required value is absent

### Password & Authentication

- Passwords hashed with scrypt (format: `scrypt:<salt>:<hash>`)
- Never store or log plaintext passwords
- Session management not yet implemented (stateless responses)
- Pending upgrade: Argon2id before production deployment

### HubSpot Token Security

- Tokens encrypted at rest using `TOKEN_ENC_SECRET` (AES-256-CBC)
- Decryption happens only at API call time in `server/orchestrator.js`
- Tokens must never be logged (use `token=[REDACTED]` in logs)
- Token validation requires real HubSpot API call (no heuristic validation)

### Logging Security

- Never log decrypted tokens or secrets
- Never log plaintext passwords
- Use structured logging via `server/logging.js`
- Redact sensitive data in error messages

---

## Code Quality Standards

### General Conventions

- No commented-out code in commits (use git history)
- No `console.log` in production code (use `server/logging.js`)
- No magic numbers (use named constants)
- Async/await preferred over callbacks
- Destructuring for multiple object properties
- Early returns for guard clauses (reduce nesting)

### Error Handling

- All errors logged via structured logging: `logger.error({ context, error })`
- Errors classified via `server/errorClassification.js` when applicable
- Failed jobs moved to DLQ (Dead Letter Queue) after max retries
- HTTP status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error), 503 (service unavailable)

### Testing Standards

- Unit tests for business logic modules in `test/{module}.test.js`
- Integration tests for API endpoints in `test/{feature}.integration.test.js`
- Mock external services (HubSpot, Redis) in unit tests
- Use real dependencies in integration tests (with cleanup)
- Test edge cases: null, undefined, empty string, special characters
- Descriptive test names: `it('should reject duplicate enum values')`
- Target >80% coverage for new modules
- Run tests: `npm test`

---

## Database Schema

### Key Tables

- `users` - User accounts (scrypt-hashed passwords)
- `hubspot_keys` - Encrypted HubSpot tokens per user
- `simulations` - Simulation configurations and status
- `simulation_jobs` - Job tracking (deprecated, replaced by BullMQ)

### Migration Commands

```bash
npm run migrate:latest      # Apply pending migrations
npm run migrate:list        # Show migration status
npm run migrate:rollback    # Undo last migration
npx knex migrate:make {name} # Create new migration
```

### Migration Structure

All migrations must include both `up()` and `down()` functions for rollback capability.

---

## Queue Architecture

### Queue Sharding

- Configurable via `SIMCRM_QUEUE_SHARDS` environment variable (default: 1)
- Shards named: `simulation-jobs:0`, `simulation-jobs:1`, etc.
- Each worker processes one shard
- Multi-worker deployment: each worker claims one shard ID

### Job Types

1. **Primary Segment Jobs** - Expand hour segments into record creation jobs
2. **Secondary Activity Jobs** - Create individual records (contacts, companies, deals)

### Rate Limiting

- Circuit breaker pattern prevents overwhelming HubSpot API
- Rate limits enforced per endpoint (see `docs/ratelimits.md`)
- Exponential backoff on 429 responses
- Circuit state stored in Redis: `hs:circuit:state`

---

## Redis Key Patterns

Key patterns used across the application:

| Pattern | Purpose | Example |
|---------|---------|---------|
| `sim:{id}:metrics` | Simulation metrics hash | `sim:123:metrics` |
| `sim:{id}:status` | Simulation status | `sim:123:status` |
| `meta:{objectType}:fields:{fieldName}` | Cached property values | `meta:contacts:fields:industry` |
| `hs:ratelimit:tokens` | HubSpot rate limit tokens | `hs:ratelimit:tokens` |
| `hs:circuit:state` | Circuit breaker state | `hs:circuit:state` |
| `bull:simulation-jobs:{shard}:*` | BullMQ queue data | `bull:simulation-jobs:0:jobs` |

See `docs/redis-plain-language.md` for detailed key documentation.

---

## Environment Variables

### Required

```powershell
# Database
DB_HOST=localhost
DB_USER=your_user
DB_PASS=your_pass
DB_NAME=simcrm
DB_PORT=3306

# Encryption (32-byte random secret)
TOKEN_ENC_SECRET=32-byte-random-secret-value
```

### Optional

```powershell
# Redis (defaults to localhost:6379)
REDIS_HOST=localhost
REDIS_PORT=6379

# Queue Sharding (defaults to 1)
SIMCRM_QUEUE_SHARDS=1
```

---

## Common Commands

```powershell
# Development
npm install              # Install dependencies
npm run dev              # Run dev server (frontend + backend)
npm test                 # Run test suite

# Worker Management
node server/worker.js    # Run worker (single shard)
$env:SIMCRM_QUEUE_SHARDS="3"; node server/worker.js  # Multi-shard

# Database
npm run migrate:latest   # Apply pending migrations
npm run migrate:list     # Show migration status
npm run migrate:rollback # Undo last migration

# Redis Inspection
redis-cli
> KEYS sim:*
> HGETALL sim:123:metrics
> GET hs:circuit:state
```

---

## HubSpot Integration

### Supported Object Types

- Contacts
- Companies
- Deals

### API Registry

Endpoints defined in `server/tools/hubspot/apiRegistry.js` following this pattern:

```javascript
{
  objectType: 'contacts',
  endpoint: '/crm/v3/objects/contacts',
  method: 'POST',
  rateLimit: { requests: 100, window: 10000 } // 100 per 10s
}
```

### Property Validation

`server/propertyValidator.js` prevents duplicate enum values by:
1. Fetching existing values from cache or HubSpot API
2. Normalizing values (lowercase, trim)
3. Fuzzy matching against existing values (85% similarity threshold)
4. Rejecting duplicates with specific error message

### Record Creation Flow

All record creation goes through `server/orchestrator.js`:
1. Validate properties against schema
2. Check for duplicate enums via `propertyValidator.js`
3. Execute HubSpot API call with retry logic
4. Cache new property values in Redis
5. Log result with structured logging

---

## UI Architecture

### Theme System

- 12 themes available (8-bit aesthetic)
- Theme context: `ThemeContext` provides current theme
- Themes stored in: `src/components/Themes/`
- All components must support all themes

### UI Guidelines

- Pixel fonts for retro aesthetic
- Pluck sounds on interactions
- Neon color palette
- ARIA labels required for accessibility
- Keyboard navigation support required
- No inline styles (use CSS modules or global classes)

### Scenario Configuration

- B2B and B2C templates in `src/components/Scenario/scenarioOptions.js`
- Server-side parameters in `server/scenarioParameters.js`
- See `docs/scenarios.md` for parameter documentation

---

## Key Files Context

### Files Requiring Property Validation

When modifying these files, ensure property validation remains intact:
- `server/orchestrator.js` - Must call `propertyValidator.validate()` before API calls
- `server/tools/hubspot/*.js` - Must not bypass validator
- Any new HubSpot object creation code

### Files Handling Encrypted Data

When modifying these files, maintain encryption security:
- `server/hubspotKeyStore.js` - Token encryption/decryption
- `server/cryptoUtil.js` - Core encryption utilities
- Never log decrypted values in these files

### Files Managing Rate Limits

When modifying these files, preserve rate limit logic:
- `server/worker.js` - Implements circuit breaker pattern
- `server/orchestrator.js` - Respects rate limits per endpoint
- See `docs/ratelimits.md` for rate limit specifications

---

## Documentation Update Requirements

When code changes affect documented behavior, update the corresponding documentation in the same commit:

| Change Type | Documentation to Update |
|-------------|------------------------|
| Worker behavior (segment logic, rate limits) | `docs/job-queue-architecture.md`, `docs/ratelimits.md` |
| New HubSpot object type or endpoint | `docs/hubspot-api-registry.md` |
| New Redis key pattern | `docs/redis-plain-language.md` |
| New UI component or styling rule | `docs/ui-rules.md` |
| New scenario parameter | `docs/scenarios.md` |
| New API endpoint | `README.md` (Simulation API table) |
| Breaking change | `CHANGELOG.md` |
| Major feature completion | Prepend to `LATEST_PROGRESS.md` (max 4 entries) |

---

## Troubleshooting Context

### Worker Not Processing Jobs

Common causes:
- Redis connection failure (check: `redis-cli PING`)
- Queue doesn't exist (check: `redis-cli KEYS simulation-jobs:*`)
- Worker not running (check process manager)
- Circuit breaker OPEN state (check: `redis-cli GET hs:circuit:state`)
- Jobs in DLQ (check: `redis-cli KEYS bull:*:failed`)

### HubSpot API Errors

Common causes:
- Invalid or expired token (test in HubSpot UI)
- Insufficient token permissions (requires CRM write access)
- Rate limit exceeded (check: `redis-cli GET hs:ratelimit:tokens`)
- Circuit breaker OPEN (check: `redis-cli GET hs:circuit:state`)
- 429 responses logged in `logs/worker.log`

### Database Connection Issues

Common causes:
- MySQL not running (test: `mysql -u{user} -p`)
- Incorrect environment variables (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`)
- Pending migrations (check: `npm run migrate:list`)

### Duplicate Enum Value Errors

Common causes:
- `propertyValidator.js` disabled in orchestrator
- Redis cache stale (check: `redis-cli KEYS meta:*:fields`)
- Fuzzy match threshold too strict (default: 85%)
- Object type not supported in validator
- Logs show normalization decisions

---

## Data Types & Interfaces

### Core Types

```typescript
// Simulation Configuration
interface Simulation {
  id: number;
  user_id: number;
  name: string;
  scenario: 'B2B' | 'B2C';
  total_records: number;
  start_date: Date;
  end_date: Date;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
}

// HubSpot Token
interface HubSpotKey {
  user_id: number;
  encrypted_token: string;
  iv: string;
  created_at: Date;
  updated_at: Date;
}

// Property Validation
interface ValidationResult {
  valid: boolean;
  errors?: string[];
  normalizedValue?: string;
}
```

---

## Important Constraints

### Module Dependencies

- `server/propertyValidator.js` depends on `server/propertyValueCache.js`
- `server/orchestrator.js` depends on `server/propertyValidator.js`
- `server/worker.js` depends on `server/orchestrator.js`
- Never create circular dependencies between these modules

### Testing Dependencies

- Redis required for integration tests
- MySQL required for integration tests
- Mock Redis/MySQL for unit tests
- Integration test cleanup: always reset DB and Redis state after tests

### Queue Shard Assignments

- Each worker must claim exactly one shard ID
- Shard IDs range from 0 to (SIMCRM_QUEUE_SHARDS - 1)
- Multiple workers on same shard causes duplicate processing
- See `docs/job-queue-architecture.md` for shard assignment logic

---

This document provides technical context for working on SimCRM v7. For detailed specifications on specific subsystems, consult the corresponding documentation in the `docs/` directory.
