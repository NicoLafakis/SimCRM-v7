const fs = require('fs')
const fsp = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const { pool } = require('./db')

const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = process.env.DEV_AUTH_DATA_FILE || path.join(DATA_DIR, 'dev-auth.json')

async function ensureFile() {
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true })
    await fsp.access(DATA_FILE, fs.constants.F_OK)
  } catch {
    const initial = { users: [] }
    await fsp.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8')
  }
}

async function loadDBFile() {
  await ensureFile()
  const raw = await fsp.readFile(DATA_FILE, 'utf8')
  try { return JSON.parse(raw) } catch { return { users: [] } }
}

async function saveDBFile(db) {
  await fsp.writeFile(DATA_FILE, JSON.stringify(db, null, 2), 'utf8')
}

function hashPass(passcode, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(passcode, salt, 64)
  return { salt, hash: derived.toString('hex'), algo: 'scrypt' }
}

function safeId(str) {
  return str.toLowerCase().trim()
}

// Introspect & migrate users table holistically
async function ensureUsersTable() {
  if (!pool) return
  // 1. Determine if users table exists
  const [usersTable] = await pool.query("SHOW TABLES LIKE 'users'")
  if (!usersTable.length) {
    // If dev_users exists, rename; else create minimal fresh schema
    const [legacy] = await pool.query("SHOW TABLES LIKE 'dev_users'")
    if (legacy.length) {
      await pool.query('RENAME TABLE dev_users TO users')
      console.info('[auth] Renamed dev_users -> users')
    } else {
      await pool.query(`CREATE TABLE users (
        id VARCHAR(64) PRIMARY KEY,
        playerName VARCHAR(255),
        playerNameId VARCHAR(255),
        email VARCHAR(255),
        emailId VARCHAR(255),
        companyName VARCHAR(255),
        password_hash VARCHAR(512),
        createdAt BIGINT,
        KEY idx_playerNameId (playerNameId),
        KEY idx_emailId (emailId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
      console.info('[auth] Created users table (clean schema)')
    }
  }
  // 2. Gather columns
  const [cols] = await pool.query('SHOW COLUMNS FROM users')
  const names = new Set(cols.map(c => c.Field))
  // 2a. Ensure required core columns exist (in case of manually created minimal schema)
  const required = [
    ['playerName','VARCHAR(255)'],
    ['playerNameId','VARCHAR(255)'],
    ['email','VARCHAR(255)'],
    ['emailId','VARCHAR(255)'],
    ['companyName','VARCHAR(255)'],
    ['createdAt','BIGINT']
  ]
  for (const [col, ddl] of required) {
    if (!names.has(col)) {
      await pool.query(`ALTER TABLE users ADD COLUMN ${col} ${ddl} NULL`)
      names.add(col)
      console.info(`[auth] Added missing column ${col}`)
    }
  }
  // 3. Add password_hash if missing
  if (!names.has('password_hash')) {
    await pool.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(512)')
    names.add('password_hash')
    console.info('[auth] Added password_hash column')
  }
  // 3a. Ensure indexes for lookup columns
  const [idxRows] = await pool.query('SHOW INDEX FROM users')
  const idxByName = new Set(idxRows.map(r => r.Key_name))
  if (!idxByName.has('idx_playerNameId')) {
    try { await pool.query('CREATE INDEX idx_playerNameId ON users (playerNameId)') } catch {}
  }
  if (!idxByName.has('idx_emailId')) {
    try { await pool.query('CREATE INDEX idx_emailId ON users (emailId)') } catch {}
  }
  // 4. If legacy columns exist and password_hash rows missing, attempt backfill
  if (names.has('cred_salt') && names.has('cred_hash')) {
    try {
      await pool.query("UPDATE users SET password_hash = CONCAT('scrypt:', cred_salt, ':', cred_hash) WHERE password_hash IS NULL AND cred_salt IS NOT NULL AND cred_hash IS NOT NULL")
    } catch (e) {
      if (!/Unknown column/.test(e.message)) throw e
      console.warn('[auth] Backfill skipped (legacy columns not uniformly present):', e.message)
    }
  }
}

async function getUserColumns() {
  if (!pool) return new Set()
  const [cols] = await pool.query('SHOW COLUMNS FROM users')
  return new Set(cols.map(c => c.Field))
}

async function signup({ playerName, passcode, email, companyName }) {
  if (!playerName || !passcode) throw new Error('playerName and passcode are required')
  const idName = safeId(playerName)
  const idEmail = email ? safeId(email) : null

  if (pool) {
    await ensureUsersTable()
    const [rows] = await pool.query('SELECT id FROM users WHERE playerNameId = ? OR emailId = ? LIMIT 1', [idName, idEmail])
    if (rows && rows.length) throw new Error('User already exists')
    const cred = hashPass(passcode)
    const userId = 'u_' + Date.now()
    const passwordHash = `scrypt:${cred.salt}:${cred.hash}`
    const cols = await getUserColumns()
    const baseFields = ['id','playerName','playerNameId','email','emailId','companyName','password_hash','createdAt']
    const values = [userId, playerName, idName, email || null, idEmail, companyName || null, passwordHash, Date.now()]
    // Include legacy columns only if they exist
    let fieldList = baseFields
    if (cols.has('cred_salt') && cols.has('cred_hash')) {
      fieldList = ['id','playerName','playerNameId','email','emailId','companyName','cred_salt','cred_hash','password_hash','createdAt']
      values.splice(6, 0, cred.salt, cred.hash) // insert after companyName
    }
    const placeholders = fieldList.map(()=>'?').join(',')
    await pool.query(`INSERT INTO users (${fieldList.join(',')}) VALUES (${placeholders})`, values)
    return { id: userId, playerName, email: email || null, companyName: companyName || null }
  }

  // file fallback
  const db = await loadDBFile()
  const exists = db.users.find(u => u.playerNameId === idName || (idEmail && u.emailId === idEmail))
  if (exists) throw new Error('User already exists')
  const cred = hashPass(passcode)
  const password_hash = `scrypt:${cred.salt}:${cred.hash}`
  const user = {
    id: 'u_' + (db.users.length + 1),
    playerName,
    playerNameId: idName,
    email: email || null,
    emailId: idEmail,
    companyName: companyName || null,
    cred,
    password_hash,
    createdAt: Date.now()
  }
  db.users.push(user)
  await saveDBFile(db)
  return { id: user.id, playerName: user.playerName, email: user.email, companyName: user.companyName }
}

async function login({ identifier, passcode }) {
  if (!identifier || !passcode) throw new Error('identifier and passcode are required')
  const id = safeId(identifier)
  if (pool) {
    await ensureUsersTable()
    const [rows] = await pool.query('SELECT * FROM users WHERE playerNameId = ? OR emailId = ? LIMIT 1', [id, id])
    if (!rows || !rows.length) return { ok: false }
    const user = rows[0]
    try {
      let salt, hash
      if (user.password_hash) {
        // Expected format: scrypt:<salt>:<hash>
        const parts = String(user.password_hash).split(':')
        if (parts.length === 3 && parts[0] === 'scrypt') {
          ;[, salt, hash] = parts
        }
      }
      // Fallback to legacy columns
      if ((!salt || !hash) && Object.prototype.hasOwnProperty.call(user,'cred_salt') && Object.prototype.hasOwnProperty.call(user,'cred_hash')) {
        salt = user.cred_salt
        hash = user.cred_hash
      }
      if (!salt || !hash) return { ok: false }
      const verify = crypto.scryptSync(passcode, salt, 64).toString('hex')
      const ok = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'))
      return ok ? { ok: true, id: user.id, playerName: user.playerName, email: user.email } : { ok: false }
    } catch (e) {
      return { ok: false }
    }
  }

  const db = await loadDBFile()
  const user = db.users.find(u => u.playerNameId === id || u.emailId === id)
  if (!user) return { ok: false }
  const { salt, hash } = user.cred
  const verify = crypto.scryptSync(passcode, salt, 64).toString('hex')
  const ok = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'))
  return ok ? { ok: true, id: user.id, playerName: user.playerName, email: user.email } : { ok: false }
}

// Admin helpers (dev only)
async function listUsers() {
  if (pool) {
    await ensureUsersTable()
    const [rows] = await pool.query('SELECT id, playerName, email, companyName, createdAt FROM users')
    return rows
  }
  const db = await loadDBFile()
  return db.users.map(u => ({ id: u.id, playerName: u.playerName, email: u.email, companyName: u.companyName, createdAt: u.createdAt }))
}

async function resetUsers() {
  if (pool) {
    await ensureUsersTable()
    await pool.query('DELETE FROM users')
    return true
  }
  await saveDBFile({ users: [] })
  return true
}

module.exports = { signup, login, listUsers, resetUsers, ensureUsersTable }
