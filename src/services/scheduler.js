import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { embed } from '../lib/embeds.js';
import { ownsGuild, shardLabel } from '../lib/shard.js';
import { endGiveaway, getDueGiveaways } from './giveaways.js';
import { closePoll, getDuePolls } from './polls.js';

const TICK_INTERVAL = 15_000;

/**
 * Inicia o laço que processa lembretes, sorteios e enquetes vencidos.
 *
 * Com sharding, TODOS os processos rodam este laço — por isso cada item só é
 * processado pelo shard dono do servidor correspondente. Sem esse filtro, oito
 * shards encerrariam o mesmo sorteio oito vezes.
 */
export function startSchedulers(client) {
  const tick = async () => {
    await Promise.allSettled([
      processReminders(client),
      processGiveaways(client),
      processPolls(client),
    ]);
  };

  tick();
  setInterval(tick, TICK_INTERVAL).unref();
  logger.info(
    `Agendador ativo (verificação a cada ${TICK_INTERVAL / 1000}s) · ${shardLabel(client)}.`,
  );
}

async function processReminders(client) {
  const due = db
    .prepare('SELECT * FROM reminders WHERE remind_at <= ?')
    .all(Date.now())
    .filter((reminder) => ownsGuild(client, reminder.guild_id));

  for (const reminder of due) {
    // Apaga primeiro: se o envio falhar, não queremos repetir para sempre.
    db.prepare('DELETE FROM reminders WHERE id = ?').run(reminder.id);

    const notice = embed
      .info(reminder.content, '⏰ Lembrete')
      .setFooter({ text: `Criado em` })
      .setTimestamp(reminder.created_at);

    const user = await client.users.fetch(reminder.user_id).catch(() => null);
    const sentByDm = user
      ? await user
          .send({ embeds: [notice] })
          .then(() => true)
          .catch(() => false)
      : false;

    if (sentByDm) continue;

    // Sem DM disponível: avisa no canal onde o lembrete foi criado.
    const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
    if (channel?.isTextBased()) {
      await channel
        .send({ content: `<@${reminder.user_id}>`, embeds: [notice] })
        .catch(() => null);
    }
  }
}

async function processGiveaways(client) {
  const due = getDueGiveaways().filter((giveaway) => ownsGuild(client, giveaway.guild_id));

  for (const giveaway of due) {
    await endGiveaway(client, giveaway.message_id).catch((error) =>
      logger.error('Falha ao encerrar sorteio:', error),
    );
  }
}

async function processPolls(client) {
  const due = getDuePolls().filter((poll) => ownsGuild(client, poll.guild_id));

  for (const poll of due) {
    await closePoll(client, poll.message_id).catch((error) =>
      logger.error('Falha ao encerrar enquete:', error),
    );
  }
}

/** Cria um lembrete e devolve o registro salvo. */
export function createReminder({ userId, channelId, guildId, content, remindAt }) {
  const info = db
    .prepare(
      `INSERT INTO reminders (user_id, channel_id, guild_id, content, remind_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, channelId, guildId ?? null, content, remindAt, Date.now());

  return db.prepare('SELECT * FROM reminders WHERE id = ?').get(info.lastInsertRowid);
}

/** Lembretes pendentes de um usuário. */
export function listReminders(userId) {
  return db
    .prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at LIMIT 25')
    .all(userId);
}
