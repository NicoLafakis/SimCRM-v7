# HubSpot Token Storage & Validation

This document describes how SimCRM now stores and validates per-user HubSpot Private App access tokens.

## Overview
Each user can save one or more HubSpot tokens ("keys") with a friendly label. Tokens are:
- Encrypted at rest using AES-256-GCM with a process-wide secret `TOKEN_ENC_SECRET`.
- Stored in the MySQL table `hubspot_api_keys` (auto-created / evolved at runtime).
- Never returned to the client after initial POST; only metadata (id, label, saas, timestamps) is returned.

Validation performs a lightweight HubSpot API call (contacts list `limit=1`) using the decrypted token. On success, the user row is updated with:
- `hubspot_active_key_id`
- `hubspot_connected_at` (epoch ms)

## Table Schema
```
CREATE TABLE hubspot_api_keys (
  id VARCHAR(64) PRIMARY KEY,
  userId VARCHAR(64),
  saas VARCHAR(64) DEFAULT 'hubspot',
  label VARCHAR(255),
  token_enc TEXT,
  createdAt BIGINT,
  updatedAt BIGINT,
  KEY idx_user (userId),
  KEY idx_user_saas (userId, saas)
) ENGINE=InnoDB;
```
Schema upgrades (adding `saas` / index) are performed idempotently by `ensureKeysTable()`.

## Encryption
Implemented in `server/cryptoUtil.js`:
- Secret: `TOKEN_ENC_SECRET` (recommended: 32 random bytes; longer/shorter hashed via SHA-256)
- Format: Base64(iv || authTag || ciphertext) where `iv` = 12 bytes, tag = 16 bytes.

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/hubspot/keys?userId=...&saas=hubspot` | List key metadata for user |
| POST | `/api/hubspot/keys` | Create & store new encrypted key `{ userId,label,token, saas? }` |
| DELETE | `/api/hubspot/keys/:id?userId=...` | Delete a key |
| POST | `/api/hubspot/validate` | Validate `{ userId, keyId }` and update user on success |
| GET | `/api/hubspot/owners?userId=...&keyId=...` | List active owners (paginated internally) for assignment |
| GET | `/api/hubspot/deal-pipelines?userId=...&keyId=...` | List deal pipelines (+stages) for simulation pipeline selection |

Responses never include the raw token. Errors for missing encryption secret are normalized.

## Environment Variables
| Name | Required | Description |
|------|----------|-------------|
| `TOKEN_ENC_SECRET` | Yes | Master secret for AES-256-GCM encryption of stored tokens |
| `DB_HOST` `DB_USER` `DB_PASS` `DB_NAME` | Yes (for persistence) | MySQL connection configuration |
| `HUBSPOT_API_TOKEN` | No | Optional legacy/global token (still recognized if provided) |

## Usage Pattern
1. User enters token & label in UI (`HubSpotSetup.jsx`).
2. Client POSTs token → server encrypts & stores → returns key metadata.
3. User clicks "CONNECT & VALIDATE" → server decrypts token → makes test call → updates user row on success.
4. Future HubSpot operations should use `orchestrator.withToken(token)` pattern after resolving the active key.

## Security Notes
- Raw tokens never logged intentionally (avoid adding logs of decrypted token).
- If `TOKEN_ENC_SECRET` rotates, existing tokens become undecryptable (plan rotation strategy as future enhancement: store key version + multi-key decryption attempt).
- Consider adding a uniqueness constraint `(userId, saas, label)` to prevent duplicate labels (not currently enforced).

## Future Enhancements
- Add active key usage endpoints (e.g., create contact using user's selected key).
- Token rotation support.
- Audit trail for validation attempts.
- Cache decrypted token in memory for a short TTL to reduce decrypt overhead (micro-optimization).
- Owners/Pipelines caching layer (ETag/If-None-Match) to reduce API calls during repeated configuration.

## Simulation Metadata Persistence
Simulations now optionally store HubSpot selection metadata:
- `hubspot_pipeline_id` (string)
- `hubspot_owner_ids` (JSON string array of owner IDs)

Added via migration `20250927_add_simulation_hubspot_metadata.js`. Data is informational for future worker logic that will:
1. Randomly assign one of the selected owners to new records (uniform RNG when >1).
2. Set deal pipeline to `hubspot_pipeline_id` and initial stage to the first stage in that pipeline.

Current orchestration does not yet consume these fields; future enhancement will map them in job creation payloads.
