/**
 * Ensure required columns and indexes exist on users table.
 */

exports.up = async function(knex) {
  const hasUsers = await knex.schema.hasTable('users')
  if (!hasUsers) return
  const required = [
    ['playerName','string'],
    ['playerNameId','string'],
    ['email','string'],
    ['emailId','string'],
    ['companyName','string'],
    ['createdAt','bigInteger']
  ]
  for (const [col, type] of required) {
    const exists = await knex.schema.hasColumn('users', col)
    if (!exists) {
      await knex.schema.alterTable('users', t => {
        if (type === 'string') t.string(col)
        else if (type === 'bigInteger') t.bigInteger(col)
      })
    }
  }
  // Indexes
  const addIndex = async (col, idx) => {
    try { await knex.raw(`CREATE INDEX ${idx} ON users (${col})`) } catch {}
  }
  await addIndex('playerNameId','idx_playerNameId')
  await addIndex('emailId','idx_emailId')
}

exports.down = async function() { /* no-op */ }
