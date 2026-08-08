import { db, getGuildConfig } from '../lib/db.js';
import { colors } from '../config.js';
import { embed, truncate } from '../lib/embeds.js';
import { formatDuration, timestamp } from '../lib/time.js';
import { logger } from '../lib/logger.js';

const insertCase = db.prepare(`
  INSERT INTO cases (guild_id, case_number, type, user_id, moderator_id, reason, duration, created_at)
  VALUES (@guild_id, @case_number, @type, @user_id, @moderator_id, @reason, @duration, @created_at)
`);
const bumpCounter = db.prepare(
  'UPDATE guilds SET case_counter = case_counter + 1 WHERE guild_id = ?',
);

export const CASE_LABELS = {
  ban: { label: 'Banimento', color: colors.danger, emoji: '🔨' },
  unban: { label: 'Desbanimento', color: colors.success, emoji: '🔓' },
  kick: { label: 'Expulsão', color: colors.warning, emoji: '👢' },
  timeout: { label: 'Castigo (timeout)', color: colors.warning, emoji: '🔇' },
  untimeout: { label: 'Castigo removido', color: colors.success, emoji: '🔊' },
  warn: { label: 'Advertência', color: colors.warning, emoji: '⚠️' },
  unwarn: { label: 'Advertência removida', color: colors.success, emoji: '🗑️' },
  automod: { label: 'AutoMod', color: colors.danger, emoji: '🤖' },
  purge: { label: 'Limpeza de mensagens', color: colors.neutral, emoji: '🧹' },
};

/**
 * Registra uma punição, envia o embed no canal de logs e devolve o número do caso.
 * Nunca lança: falha de log não deve derrubar o comando de moderação.
 */
export async function createCase(guild, { type, user, moderator, reason, duration = null }) {
  const settings = getGuildConfig(guild.id);
  const caseNumber = settings.case_counter + 1;
  bumpCounter.run(guild.id);

  insertCase.run({
    guild_id: guild.id,
    case_number: caseNumber,
    type,
    user_id: user.id,
    moderator_id: moderator.id,
    reason: reason ?? null,
    duration,
    created_at: Date.now(),
  });

  const meta = CASE_LABELS[type] ?? { label: type, color: colors.neutral, emoji: '📄' };
  const logEmbed = embed
    .base(meta.color)
    .setAuthor({ name: `${meta.emoji} ${meta.label} · Caso #${caseNumber}` })
    .addFields(
      { name: 'Usuário', value: `${user} \`${user.tag ?? user.id}\``, inline: true },
      { name: 'Moderador', value: `${moderator}`, inline: true },
      { name: 'Motivo', value: truncate(reason || 'Sem motivo informado.') },
    )
    .setFooter({ text: `ID do usuário: ${user.id}` })
    .setTimestamp();

  const avatar = user.displayAvatarURL?.({ size: 128 });
  if (avatar) logEmbed.setThumbnail(avatar);

  if (duration) {
    logEmbed.addFields({
      name: 'Duração',
      value: `${formatDuration(duration)} · expira ${timestamp(Date.now() + duration, 'R')}`,
      inline: true,
    });
  }

  await sendToLog(guild, settings.mod_log_channel, logEmbed);
  return caseNumber;
}

/** Envia um embed para um canal de log, ignorando falhas de permissão/canal removido. */
export async function sendToLog(guild, channelId, logEmbed) {
  if (!channelId) return;
  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [logEmbed] });
  } catch (error) {
    logger.debug(`Não foi possível enviar log em ${guild.id}:`, error.message);
  }
}

/** Tenta avisar o usuário por DM sobre a punição. Retorna true se a DM foi entregue. */
export async function notifyUser(user, guild, { type, reason, duration }) {
  const meta = CASE_LABELS[type] ?? { label: type, color: colors.neutral, emoji: '📄' };
  const dm = embed
    .base(meta.color)
    .setTitle(`${meta.emoji} ${meta.label}`)
    .setDescription(`Você recebeu uma punição no servidor **${guild.name}**.`)
    .addFields({ name: 'Motivo', value: truncate(reason || 'Sem motivo informado.') })
    .setTimestamp();

  if (duration) {
    dm.addFields({ name: 'Duração', value: formatDuration(duration), inline: true });
  }

  return user
    .send({ embeds: [dm] })
    .then(() => true)
    .catch(() => false);
}
