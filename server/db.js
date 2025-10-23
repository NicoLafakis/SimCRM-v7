const mysql = require('mysql2/promise')

const {
  DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT
} = process.env

let pool = null

if (DB_HOST && DB_USER && DB_NAME) {
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    port: DB_PORT ? Number(DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })
}

module.exports = { pool }
