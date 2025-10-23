require('dotenv').config()
const mysql = require('mysql2/promise')

const ddls = [
  `CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hubspot_id VARCHAR(255) NULL,
    email VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    lifecycle VARCHAR(64),
    marketing_stage VARCHAR(64),
    company_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (email),
    INDEX (company_id)
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hubspot_id VARCHAR(255) NULL,
    name VARCHAR(255),
    domain VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS deals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hubspot_id VARCHAR(255) NULL,
    contact_id INT NULL,
    company_id INT NULL,
    stage VARCHAR(64),
    amount DECIMAL(12,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (contact_id),
    INDEX (company_id)
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hubspot_id VARCHAR(255) NULL,
    object_type VARCHAR(64) NULL,
    object_id INT NULL,
    body TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hubspot_id VARCHAR(255) NULL,
    contact_id INT NULL,
    body TEXT,
    duration_seconds INT,
    status VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hubspot_id VARCHAR(255) NULL,
    contact_id INT NULL,
    subject VARCHAR(255),
    body TEXT,
    status VARCHAR(64),
    due_date DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hubspot_id VARCHAR(255) NULL,
    subject VARCHAR(255),
    content TEXT,
    contact_id INT NULL,
    status VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hubspot_id VARCHAR(255) NULL,
    amount DECIMAL(12,2),
    due_date DATE NULL,
    status VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS quotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hubspot_id VARCHAR(255) NULL,
    amount DECIMAL(12,2),
    status VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS custom_objects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    object_type VARCHAR(128),
    hubspot_id VARCHAR(255) NULL,
    properties JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`
  ,
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`
]

async function run() {
  const { DB_HOST, DB_PORT = 3306, DB_USER, DB_PASSWORD, DB_NAME, DATABASE_URL } = process.env
  let conn
  try {
    if (DATABASE_URL) conn = await mysql.createConnection(DATABASE_URL)
    else {
      if (!DB_HOST || !DB_USER || !DB_NAME) {
        console.error('Missing DB_HOST/DB_USER/DB_NAME in environment. See .env.sample.')
        process.exit(2)
      }
      conn = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME })
    }

    console.log('Connected to DB. Creating tables (if not exists)...')
    for (const ddl of ddls) {
      try {
        await conn.execute(ddl)
      } catch (err) {
        console.error('Error executing DDL chunk:', err.message)
        throw err
      }
    }
    console.log('All DDL executed. Tables created or already existed.')
    process.exit(0)
  } catch (err) {
    console.error('Failed to create tables:', err.message)
    process.exit(3)
  } finally {
    if (conn && conn.end) await conn.end()
  }
}

if (require.main === module) run()

module.exports = run
