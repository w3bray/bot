import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { db } from '../lib/db.js';
import { colors, emojis } from '../config.js';
import { embed } from '../lib/embeds.js';
import { timestamp } from '../lib/time.js';
import { logger } from '../lib/logger.js';
import { quantidade } from '../lib/portugues.js';

const selectGiveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?');
const countEntries = db.prepare(
  'SELECT COUNT(*) AS total FROM giveaway_entries WHERE message_id = ?',
);
const listEntries = db.prepare('SELECT user_id FROM giveaway_entries WHERE message_id = ?');

/** Botão de participação. Desabilitado quando o sorteio termina. */
export function giveawayRow(messageId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway:enter:${messageId}`)
      .setLabel('Participar')
      .setEmoji(emojis.gift)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

/** Embed do sorteio em andamento. */
export function giveawayEmbed(giveaway, entries) {
  return embed
    .base(colors.primary)
    .setTitle(`${emojis.gift} ${giveaway.prize}`)
    .setDescription(
      [
        'Use o botão abaixo para participar.',
        '',
        `**Termina:** ${timestamp(giveaway.ends_at, 'R')} (${timestamp(giveaway.ends_at, 'f')})`,
        `**Ganhadores:** ${giveaway.winners}`,
        `**Organizado por:** <@${giveaway.host_id}>`,
        giveaway.required_role ? `**Cargo obrigatório:** <@&${giveaway.required_role}>` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({ text: quantidade(entries, 'participante') })
    .setTimestamp(giveaway.ends_at);
}

/** Sorteia N vencedores distintos entre os participantes. */
export function drawWinners(messageId, amount) {
  const pool = listEntries.all(messageId).map((row) => row.user_id);

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }

  return pool.slice(0, amount);
}

/**
 * Finaliza um sorteio: escolhe vencedores, edita a mensagem original e anuncia.
 * `reroll` sorteia de novo sem alterar o estado de "encerrado".
 */
export async function endGiveaway(client, messageId, { reroll = false } = {}) {
  const giveaway = selectGiveaway.get(messageId);
  if (!giveaway) return { ok: false, reason: 'Sorteio não encontrado.' };
  if (giveaway.ended && !reroll) return { ok: false, reason: 'Esse sorteio já foi encerrado.' };

  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  if (!channel?.isTextBased()) {
    db.prepare('UPDATE giveaways SET ended = 1 WHERE message_id = ?').run(messageId);
    return { ok: false, reason: 'O canal do sorteio não existe mais.' };
  }

  const winners = drawWinners(messageId, giveaway.winners);
  db.prepare('UPDATE giveaways SET ended = 1 WHERE message_id = ?').run(messageId);

  const message = await channel.messages.fetch(messageId).catch(() => null);
  const mentions = winners.map((id) => `<@${id}>`).join(', ');

  const resultEmbed = embed
    .base(winners.length > 0 ? colors.success : colors.danger)
    .setTitle(`${emojis.gift} Sorteio encerrado: ${giveaway.prize}`)
    .setDescription(
      winners.length > 0
        ? `**${winners.length === 1 ? 'Ganhador' : 'Ganhadores'}:** ${mentions}\nParabéns! 🎊`
        : 'Ninguém participou — não há ganhadores.',
    )
    .setFooter({ text: quantidade(countEntries.get(messageId).total, 'participante') })
    .setTimestamp();

  if (message) {
    await message
      .edit({ embeds: [resultEmbed], components: [giveawayRow(messageId, true)] })
      .catch((error) => logger.debug('Falha ao editar sorteio:', error.message));
  }

  if (winners.length > 0) {
    await channel
      .send({
        content: `${mentions}`,
        embeds: [
          embed.success(
            `Vocês ganharam **${giveaway.prize}**!${message ? `\n${message.url}` : ''}`,
          ),
        ],
      })
      .catch(() => null);
  }

  return { ok: true, winners };
}

/** Sorteios vencidos que ainda não foram processados. */
export function getDueGiveaways(now = Date.now()) {
  return db.prepare('SELECT * FROM giveaways WHERE ended = 0 AND ends_at <= ?').all(now);
}
