const { pool } = require('./db')
const { encrypt, decrypt } = require('./cryptoUtil')

async function ensureKeysTable() {
  if (!pool) return
  const [rows] = await pool.query("SHOW TABLES LIKE 'hubspot_api_keys'")
  if (!rows.length) {
    await pool.query(`CREATE TABLE hubspot_api_keys (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64),
      saas VARCHAR(64) DEFAULT 'hubspot',
      label VARCHAR(255),
      token_enc TEXT,
      createdAt BIGINT,
      updatedAt BIGINT,
      KEY idx_user (userId),
      KEY idx_user_saas (userId, saas)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
  } else {
    // Table exists; ensure new columns / indexes exist (idempotent best-effort)
    try {
      const [cols] = await pool.query("SHOW COLUMNS FROM hubspot_api_keys LIKE 'saas'")
      if (!cols.length) {
        await pool.query("ALTER TABLE hubspot_api_keys ADD COLUMN saas VARCHAR(64) DEFAULT 'hubspot'")
        try { await pool.query('CREATE INDEX idx_user_saas ON hubspot_api_keys (userId, saas)') } catch {}
      }
    } catch (e) {
      console.warn('ensureKeysTable alter error:', e.message)
    }
  }
}

async function listKeys(userId, { saas } = {}) {
  if (!pool) return []
  await ensureKeysTable()
  if (saas) {
    const [rows] = await pool.query('SELECT id,label,saas,createdAt,updatedAt FROM hubspot_api_keys WHERE userId = ? AND saas = ? ORDER BY createdAt ASC', [userId, saas])
    return rows
  }
  const [rows] = await pool.query('SELECT id,label,saas,createdAt,updatedAt FROM hubspot_api_keys WHERE userId = ? ORDER BY createdAt ASC', [userId])
  return rows
}

async function createKey({ userId, label, token, saas = 'hubspot' }) {
  if (!pool) throw new Error('Database not configured')
  await ensureKeysTable()
  const id = 'hskey_' + Date.now() + '_' + Math.random().toString(36).slice(2,8)
  const now = Date.now()
  const token_enc = encrypt(token)
  await pool.query('INSERT INTO hubspot_api_keys (id,userId,saas,label,token_enc,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)', [id,userId,saas,label,token_enc,now,now])
  return { id, label, saas, createdAt: now, updatedAt: now }
}

async function deleteKey({ userId, id }) {
  if (!pool) return false
  await ensureKeysTable()
  await pool.query('DELETE FROM hubspot_api_keys WHERE userId = ? AND id = ? LIMIT 1', [userId, id])
  return true
}

async function getDecryptedToken({ userId, id }) {
  if (!pool) return null
  await ensureKeysTable()
  const [rows] = await pool.query('SELECT token_enc FROM hubspot_api_keys WHERE userId = ? AND id = ? LIMIT 1', [userId, id])
  if (!rows.length) return null
  try { return decrypt(rows[0].token_enc) } catch { return null }
}

module.exports = { ensureKeysTable, listKeys, createKey, deleteKey, getDecryptedToken }
