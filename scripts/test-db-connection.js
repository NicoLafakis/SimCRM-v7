require('dotenv').config()
const mysql = require('mysql2/promise')

async function test() {
  const {
    DB_HOST, DB_PORT = 3306, DB_USER, DB_PASSWORD, DB_NAME, DATABASE_URL
  } = process.env

  let conn
  try {
    if (DATABASE_URL) {
      // mysql2 supports passing a connection string
      conn = await mysql.createConnection(DATABASE_URL)
    } else {
      if (!DB_HOST || !DB_USER) {
        console.error('Missing DB_HOST or DB_USER in environment. See .env.sample for required variables.')
        process.exit(2)
      }
      conn = await mysql.createConnection({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        connectTimeout: 5000,
      })
    }

    const [rows] = await conn.query('SELECT 1 as ok')
    if (rows && rows[0] && rows[0].ok === 1) {
      console.log('DB connection successful!')
      process.exit(0)
    }
    console.log('DB connection established but test query returned unexpected result:', rows)
    process.exit(1)
  } catch (err) {
    console.error('DB connection failed:', err.message)
    process.exit(3)
  } finally {
    if (conn && conn.end) await conn.end()
  }
}

if (require.main === module) test()

module.exports = test
