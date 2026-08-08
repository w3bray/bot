import { db, getGuildConfig } from '../lib/db.js';
import { colors } from '../config.js';
import { embed } from '../lib/embeds.js';
import { logger } from '../lib/logger.js';

const selectUser = db.prepare('SELECT * FROM levels WHERE guild_id = ? AND user_id = ?');
const upsertUser = db.prepare(`
  INSERT INTO levels (guild_id, user_id, xp, level, messages, last_xp)
  VALUES (@guild_id, @user_id, @xp, @level, 1, @last_xp)
  ON CONFLICT (guild_id, user_id) DO UPDATE SET
    xp = @xp, level = @level, messages = messages + 1, last_xp = @last_xp
`);
const selectRewards = db.prepare(
  'SELECT * FROM level_rewards WHERE guild_id = ? AND level <= ? ORDER BY level',
);

/** XP total necessário para alcançar um nível (curva clássica do Mee6). */
export function xpForLevel(level) {
  let total = 0;
  for (let index = 0; index < level; index += 1) {
    total += 5 * index * index + 50 * index + 100;
  }
  return total;
}

/** Nível correspondente a uma quantidade de XP. */
export function levelFromXp(xp) {
  let level = 0;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

/** Estatísticas de um membro, incluindo posição no ranking. */
export function getUserLevel(guildId, userId) {
  const row = selectUser.get(guildId, userId) ?? {
    guild_id: guildId,
    user_id: userId,
    xp: 0,
    level: 0,
    messages: 0,
    last_xp: 0,
  };

  const rank = db
    .prepare('SELECT COUNT(*) AS above FROM levels WHERE guild_id = ? AND xp > ?')
    .get(guildId, row.xp).above;

  const current = xpForLevel(row.level);
  const next = xpForLevel(row.level + 1);

  return {
    ...row,
    rank: rank + 1,
    currentLevelXp: row.xp - current,
    neededXp: next - current,
    nextLevelXp: next,
  };
}

/** Top N do ranking de XP. */
export function getLeaderboard(guildId, limit = 10, offset = 0) {
  return db
    .prepare('SELECT * FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT ? OFFSET ?')
    .all(guildId, limit, offset);
}

/**
 * Processa uma mensagem para ganho de XP.
 * Respeita o cooldown por usuário e anuncia o novo nível quando houver.
 */
export async function handleMessage(message) {
  const settings = getGuildConfig(message.guild.id);
  if (!settings.levels_enabled) return;

  const now = Date.now();
  const existing = selectUser.get(message.guild.id, message.author.id);
  if (existing && now - existing.last_xp < settings.xp_cooldown) return;

  const gain =
    Math.floor(Math.random() * (settings.xp_max - settings.xp_min + 1)) + settings.xp_min;
  const xp = (existing?.xp ?? 0) + gain;
  const level = levelFromXp(xp);
  const leveledUp = level > (existing?.level ?? 0);

  upsertUser.run({
    guild_id: message.guild.id,
    user_id: message.author.id,
    xp,
    level,
    last_xp: now,
  });

  if (!leveledUp) return;

  await grantRewards(message.member, level);
  await announceLevelUp(message, settings, level);
}

async function grantRewards(member, level) {
  const rewards = selectRewards.all(member.guild.id, level);
  const toAdd = rewards
    .map((reward) => reward.role_id)
    .filter((roleId) => member.guild.roles.cache.has(roleId) && !member.roles.cache.has(roleId));

  if (toAdd.length === 0) return;

  await member.roles
    .add(toAdd, `Recompensa automática de nível ${level}`)
    .catch((error) => logger.debug('Falha ao dar recompensa de nível:', error.message));
}

async function announceLevelUp(message, settings, level) {
  const template = settings.levels_message || '{user} subiu para o **nível {level}**! 🎉';
  const content = template
    .replaceAll('{user}', `<@${message.author.id}>`)
    .replaceAll('{username}', message.author.username)
    .replaceAll('{level}', String(level))
    .replaceAll('{server}', message.guild.name);

  const target = settings.levels_channel
    ? await message.guild.channels.fetch(settings.levels_channel).catch(() => null)
    : message.channel;

  if (!target?.isTextBased()) return;

  await target
    .send({ embeds: [embed.base(colors.level).setDescription(content)] })
    .catch((error) => logger.debug('Falha ao anunciar nível:', error.message));
}
