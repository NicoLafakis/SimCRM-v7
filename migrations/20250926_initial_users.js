/**
 * Initial users table creation migration.
 * If legacy dev_users exists, this migration will rename it then
 * adapt the schema; otherwise it creates a fresh table.
 */

exports.up = async function(knex) {
  const hasUsers = await knex.schema.hasTable('users')
  if (!hasUsers) {
    const hasLegacy = await knex.schema.hasTable('dev_users')
    if (hasLegacy) {
      // Raw rename (Knex lacks rename across engines gracefully) then adjust
      await knex.raw('RENAME TABLE dev_users TO users')
    } else {
      await knex.schema.createTable('users', table => {
        table.string('id', 64).primary()
        table.string('playerName')
        table.string('playerNameId').index()
        table.string('email').index()
        table.string('emailId').index()
        table.string('companyName')
        table.string('password_hash', 512)
        table.bigInteger('createdAt')
      })
    }
  }

  // Ensure modern columns exist
  const hasPasswordHash = await knex.schema.hasColumn('users', 'password_hash')
  if (!hasPasswordHash) {
    await knex.schema.alterTable('users', t => {
      t.string('password_hash', 512)
    })
  }

  // Add legacy columns only if table already had them historically; no-op otherwise
  const hasCredSalt = await knex.schema.hasColumn('users', 'cred_salt')
  const hasCredHash = await knex.schema.hasColumn('users', 'cred_hash')
  // Backfill only if both legacy columns present and password_hash is null rows exist
  if (hasCredSalt && hasCredHash) {
    await knex.raw("UPDATE users SET password_hash = CONCAT('scrypt:', cred_salt, ':', cred_hash) WHERE password_hash IS NULL AND cred_salt IS NOT NULL AND cred_hash IS NOT NULL")
  }
}

exports.down = async function(knex) {
  // Down migration: we won't drop user data automatically. Provide a safe noop.
  // If absolutely needed: uncomment the next line (dangerous!)
  // await knex.schema.dropTableIfExists('users')
}
