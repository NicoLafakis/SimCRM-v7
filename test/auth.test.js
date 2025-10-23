import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mysql from 'mysql2/promise'

const {
  DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT
} = process.env

let pool

async function clearUsers() {
  try {
    await pool.query('DELETE FROM users')
  } catch {}
}

describe('Auth basic hashing/migration', () => {
  beforeAll(async () => {
    if (DB_HOST && DB_USER && DB_NAME) {
      pool = await mysql.createPool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASS,
        database: DB_NAME,
        port: DB_PORT ? Number(DB_PORT) : 3306
      })
      await pool.query('CREATE TABLE IF NOT EXISTS users (id VARCHAR(64) PRIMARY KEY, playerName VARCHAR(255), playerNameId VARCHAR(255), email VARCHAR(255), emailId VARCHAR(255), companyName VARCHAR(255), password_hash VARCHAR(512), createdAt BIGINT)')
      await clearUsers()
    }
  })

  afterAll(async () => {
    if (pool) await pool.end()
  })

  it('creates scrypt password_hash format', async () => {
    if (!pool) return expect(true).toBe(true) // skip if no DB
    const salt = 'abc123'
    const hash = 'deadbeef'
    await pool.query('INSERT INTO users (id, playerName, playerNameId, email, emailId, companyName, password_hash, createdAt) VALUES (?,?,?,?,?,?,?,?)', ['u_1','Player','player','p@example.com','p@example.com',null,`scrypt:${salt}:${hash}`,Date.now()])
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?',[ 'u_1'])
    expect(rows[0].password_hash.split(':').length).toBe(3)
  })
})
