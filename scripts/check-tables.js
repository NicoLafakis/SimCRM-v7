require('dotenv').config()
const mysql = require('mysql2/promise')

// List of tables we expect (best-effort):
const expectedTables = [
  'contacts',
  'companies',
  'deals',
  'notes',
  'calls',
  'tasks',
  'tickets',
  'invoices',
  'quotes',
  'custom_objects',
  'users'
]

async function check() {
  const { DB_HOST, DB_PORT = 3306, DB_USER, DB_PASSWORD, DB_NAME, DATABASE_URL } = process.env
  let conn
  try {
    if (DATABASE_URL) conn = await mysql.createConnection(DATABASE_URL)
    else conn = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME })

    // Query information_schema for table existence
    const placeholders = expectedTables.map(() => '?').join(',')
    const [rows] = await conn.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name IN (${placeholders})`,
      [DB_NAME, ...expectedTables]
    )

    const found = new Set(rows.map(r => r.table_name))
    console.log('Expected tables check for schema:', DB_NAME)
    expectedTables.forEach(t => {
      console.log(` - ${t}: ${found.has(t) ? 'FOUND' : 'MISSING'}`)
    })
    const missing = expectedTables.filter(t => !found.has(t))
    process.exit(missing.length === 0 ? 0 : 4)
  } catch (err) {
    console.error('Error checking tables:', err.message)
    process.exit(3)
  } finally {
    if (conn && conn.end) await conn.end()
  }
}

if (require.main === module) check()

module.exports = check
