/**
 * Add role column to users table (player | boss).
 * Defaults existing users to 'player'; upgrades Admin user to 'boss'.
 */

exports.up = async function(knex) {
  const hasUsers = await knex.schema.hasTable('users')
  if (!hasUsers) return
  const hasRole = await knex.schema.hasColumn('users', 'role')
  if (!hasRole) {
    await knex.schema.alterTable('users', t => {
      t.string('role', 16).notNullable().defaultTo('player').index()
    })
  }
  try {
    // Backfill null roles to player (in case existing rows inserted pre-default)
    await knex('users').whereNull('role').update({ role: 'player' })
  } catch {}
  try {
    // Promote Admin user(s) – using case-insensitive match on playerName
    await knex('users').whereRaw('LOWER(playerName) = ?', ['admin']).update({ role: 'boss' })
  } catch {}
}

exports.down = async function(knex) {
  // Non-destructive rollback; keep column.
  // Uncomment to drop:
  // const hasUsers = await knex.schema.hasTable('users')
  // if (hasUsers) {
  //   const hasRole = await knex.schema.hasColumn('users', 'role')
  //   if (hasRole) await knex.schema.alterTable('users', t => t.dropColumn('role'))
  // }
}
