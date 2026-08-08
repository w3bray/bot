import { db, readJson } from '../lib/db.js';

const ensure = db.prepare('INSERT OR IGNORE INTO profiles (guild_id, user_id) VALUES (?, ?)');
const select = db.prepare('SELECT * FROM profiles WHERE guild_id = ? AND user_id = ?');

export const REP_COOLDOWN = 12 * 60 * 60 * 1000;

/** Perfil do usuário, criado na primeira leitura. */
export function getProfile(guildId, userId) {
  ensure.run(guildId, userId);
  return select.get(guildId, userId);
}

/** Atualiza colunas arbitrárias do perfil. */
export function updateProfile(guildId, userId, patch) {
  ensure.run(guildId, userId);
  const assignments = Object.keys(patch)
    .map((key) => `${key} = @${key}`)
    .join(', ');
  db.prepare(
    `UPDATE profiles SET ${assignments} WHERE guild_id = @guild_id AND user_id = @user_id`,
  ).run({ ...patch, guild_id: guildId, user_id: userId });
  return select.get(guildId, userId);
}

/** Soma reputação e registra o cooldown de quem deu. */
export const giveReputation = db.transaction((guildId, fromId, toId) => {
  ensure.run(guildId, fromId);
  ensure.run(guildId, toId);

  const giver = select.get(guildId, fromId);
  const remaining = REP_COOLDOWN - (Date.now() - giver.last_rep);
  if (remaining > 0) return { ok: false, remaining };

  db.prepare(
    'UPDATE profiles SET reputation = reputation + 1 WHERE guild_id = ? AND user_id = ?',
  ).run(guildId, toId);
  db.prepare('UPDATE profiles SET last_rep = ? WHERE guild_id = ? AND user_id = ?').run(
    Date.now(),
    guildId,
    fromId,
  );

  return { ok: true, total: select.get(guildId, toId).reputation };
});

/**
 * Casa dois usuários. Escreve os dois lados na mesma transação para nunca
 * existir um casamento "pela metade".
 */
export const marry = db.transaction((guildId, a, b) => {
  ensure.run(guildId, a);
  ensure.run(guildId, b);

  const first = select.get(guildId, a);
  const second = select.get(guildId, b);
  if (first.married_to) return { ok: false, reason: 'você já está casado(a)' };
  if (second.married_to) return { ok: false, reason: 'essa pessoa já está casada' };

  const now = Date.now();
  const statement = db.prepare(
    'UPDATE profiles SET married_to = ?, married_at = ? WHERE guild_id = ? AND user_id = ?',
  );
  statement.run(b, now, guildId, a);
  statement.run(a, now, guildId, b);

  return { ok: true, since: now };
});

/** Desfaz o casamento dos dois lados. */
export const divorce = db.transaction((guildId, userId) => {
  ensure.run(guildId, userId);
  const profile = select.get(guildId, userId);
  if (!profile.married_to) return { ok: false, reason: 'você não está casado(a)' };

  const partner = profile.married_to;
  const statement = db.prepare(
    'UPDATE profiles SET married_to = NULL, married_at = NULL WHERE guild_id = ? AND user_id = ?',
  );
  statement.run(guildId, userId);
  statement.run(guildId, partner);

  return { ok: true, partner };
});

/** Ranking de reputação do servidor. */
export function getTopReputation(guildId, limit = 10) {
  return db
    .prepare(
      'SELECT * FROM profiles WHERE guild_id = ? AND reputation > 0 ORDER BY reputation DESC LIMIT ?',
    )
    .all(guildId, limit);
}

/** Lista de emojis dos distintivos que o usuário possui. */
export function getBadges(profile) {
  return readJson(profile.badges, []);
}

/** Concede um distintivo, ignorando duplicatas. */
export function addBadge(guildId, userId, badgeId) {
  const profile = getProfile(guildId, userId);
  const badges = getBadges(profile);
  if (badges.includes(badgeId)) return false;

  updateProfile(guildId, userId, { badges: JSON.stringify([...badges, badgeId]) });
  return true;
}
