import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { db, readJson } from '../lib/db.js';
import { colors } from '../config.js';
import { embed } from '../lib/embeds.js';
import { timestamp } from '../lib/time.js';
import { logger } from '../lib/logger.js';

export const OPTION_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

const selectPoll = db.prepare('SELECT * FROM polls WHERE message_id = ?');
const selectVotes = db.prepare('SELECT choice, COUNT(*) AS total FROM poll_votes WHERE message_id = ? GROUP BY choice');
const countVoters = db.prepare(
  'SELECT COUNT(DISTINCT user_id) AS total FROM poll_votes WHERE message_id = ?',
);

export function getPoll(messageId) {
  return selectPoll.get(messageId);
}

/** Botões de votação, um por opção. */
export function pollRow(messageId, options, disabled = false) {
  return new ActionRowBuilder().addComponents(
    options.map((_, index) =>
      new ButtonBuilder()
        .setCustomId(`poll:vote:${messageId}:${index}`)
        .setEmoji(OPTION_EMOJIS[index])
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
    ),
  );
}

/** Embed com a barra de resultados atualizada. */
export function pollEmbed(poll, { closed = false } = {}) {
  const options = readJson(poll.options, []);
  const tally = new Map(selectVotes.all(poll.message_id).map((row) => [row.choice, row.total]));
  const totalVotes = [...tally.values()].reduce((sum, value) => sum + value, 0);
  const voters = countVoters.get(poll.message_id).total;

  const body = options.map((option, index) => {
    const votes = tally.get(index) ?? 0;
    const percent = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);
    const filled = Math.round(percent / 5);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    return `${OPTION_EMOJIS[index]} **${option}**\n\`${bar}\` ${percent}% · ${votes} voto(s)`;
  });

  const footer = [
    `${voters} pessoa(s) votaram`,
    poll.multi ? 'múltipla escolha' : 'escolha única',
  ].join(' · ');

  return embed
    .base(closed ? colors.neutral : colors.primary)
    .setTitle(`📊 ${poll.question}`)
    .setDescription(
      [
        body.join('\n\n'),
        '',
        closed
          ? '**Enquete encerrada.**'
          : poll.ends_at
            ? `Encerra ${timestamp(poll.ends_at, 'R')}`
            : 'Sem prazo definido.',
      ].join('\n'),
    )
    .setFooter({ text: footer })
    .setTimestamp();
}

/** Encerra a enquete e desabilita os botões. */
export async function closePoll(client, messageId) {
  const poll = selectPoll.get(messageId);
  if (!poll || poll.ended) return;

  db.prepare('UPDATE polls SET ended = 1 WHERE message_id = ?').run(messageId);

  const channel = await client.channels.fetch(poll.channel_id).catch(() => null);
  if (!channel?.isTextBased()) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  await message
    .edit({
      embeds: [pollEmbed(poll, { closed: true })],
      components: [pollRow(messageId, readJson(poll.options, []), true)],
    })
    .catch((error) => logger.debug('Falha ao encerrar enquete:', error.message));
}

export function getDuePolls(now = Date.now()) {
  return db
    .prepare('SELECT * FROM polls WHERE ended = 0 AND ends_at IS NOT NULL AND ends_at <= ?')
    .all(now);
}
