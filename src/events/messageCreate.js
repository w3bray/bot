import { Events } from 'discord.js';
import { db } from '../lib/db.js';
import { embed } from '../lib/embeds.js';
import { formatDuration } from '../lib/time.js';
import { inspect } from '../services/automod.js';
import { handleMessage } from '../services/leveling.js';
import { logger } from '../lib/logger.js';

const selectAfk = db.prepare('SELECT * FROM afk WHERE guild_id = ? AND user_id = ?');
const deleteAfk = db.prepare('DELETE FROM afk WHERE guild_id = ? AND user_id = ?');

export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild || !message.member) return;

    try {
      // AutoMod primeiro: mensagem removida não deve gerar XP.
      const handled = await inspect(message);
      if (handled) return;

      await clearOwnAfk(message);
      await notifyMentionedAfk(message);
      await handleMessage(message);
    } catch (error) {
      logger.error('Erro ao processar mensagem:', error);
    }
  },
};

async function clearOwnAfk(message) {
  const entry = selectAfk.get(message.guild.id, message.author.id);
  if (!entry) return;

  deleteAfk.run(message.guild.id, message.author.id);

  // Restaura o apelido, se o bot foi quem colocou o prefixo [AFK].
  if (message.member.displayName.startsWith('[AFK] ')) {
    await message.member
      .setNickname(message.member.displayName.slice(6))
      .catch(() => null);
  }

  const notice = await message.channel
    .send({
      embeds: [
        embed.success(
          `Bem-vindo de volta, ${message.author}! Você ficou ausente por **${formatDuration(Date.now() - entry.since)}**.`,
        ),
      ],
    })
    .catch(() => null);

  if (notice) setTimeout(() => notice.delete().catch(() => null), 10_000);
}

async function notifyMentionedAfk(message) {
  const mentioned = message.mentions.users
    .filter((user) => user.id !== message.author.id)
    .map((user) => ({ user, entry: selectAfk.get(message.guild.id, user.id) }))
    .filter(({ entry }) => entry)
    .slice(0, 3);

  if (mentioned.length === 0) return;

  const lines = mentioned.map(
    ({ user, entry }) =>
      `**${user.username}** está ausente há ${formatDuration(Date.now() - entry.since)}${entry.reason ? `: ${entry.reason}` : '.'}`,
  );

  await message.reply({ embeds: [embed.info(lines.join('\n'))] }).catch(() => null);
}
