import { db } from '../lib/db.js';

const ensure = db.prepare('INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)');
const select = db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?');

export const DAILY_COOLDOWN = 22 * 60 * 60 * 1000;
export const WORK_COOLDOWN = 60 * 60 * 1000;
export const ROB_COOLDOWN = 3 * 60 * 60 * 1000;
export const DAILY_BASE = 250;
export const DAILY_STREAK_BONUS = 50;
export const MAX_STREAK_BONUS = 500;

/** Conta do usuário, criada automaticamente na primeira leitura. */
export function getAccount(guildId, userId) {
  ensure.run(guildId, userId);
  return select.get(guildId, userId);
}

/** Soma (ou subtrai, com valor negativo) moedas da carteira. Nunca deixa negativo. */
export function addBalance(guildId, userId, amount) {
  ensure.run(guildId, userId);
  db.prepare(
    'UPDATE economy SET balance = MAX(0, balance + ?) WHERE guild_id = ? AND user_id = ?',
  ).run(Math.round(amount), guildId, userId);
  return select.get(guildId, userId);
}

/** Atualiza colunas arbitrárias da conta. */
export function updateAccount(guildId, userId, patch) {
  ensure.run(guildId, userId);
  const assignments = Object.keys(patch)
    .map((key) => `${key} = @${key}`)
    .join(', ');
  db.prepare(
    `UPDATE economy SET ${assignments} WHERE guild_id = @guild_id AND user_id = @user_id`,
  ).run({ ...patch, guild_id: guildId, user_id: userId });
  return select.get(guildId, userId);
}

/**
 * Transfere moedas entre dois usuários dentro de uma transação:
 * ou os dois lados mudam, ou nenhum muda.
 */
export const transfer = db.transaction((guildId, fromId, toId, amount) => {
  ensure.run(guildId, fromId);
  ensure.run(guildId, toId);

  const sender = select.get(guildId, fromId);
  if (sender.balance < amount) return { ok: false, reason: 'saldo insuficiente' };

  db.prepare('UPDATE economy SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(
    amount,
    guildId,
    fromId,
  );
  db.prepare('UPDATE economy SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(
    amount,
    guildId,
    toId,
  );

  return { ok: true };
});

/** Ranking por patrimônio (carteira + banco). */
export function getRichest(guildId, limit = 10) {
  return db
    .prepare(
      `SELECT *, (balance + bank) AS total FROM economy
       WHERE guild_id = ? AND (balance + bank) > 0
       ORDER BY total DESC LIMIT ?`,
    )
    .all(guildId, limit);
}

/** Formata um valor com separador de milhar brasileiro. */
export function formatMoney(amount, currency = 'moedas') {
  return `${Number(amount).toLocaleString('pt-BR')} ${currency}`;
}

export const WORK_SCENARIOS = [
  { text: 'Você entregou pizzas pela cidade', min: 60, max: 180 },
  { text: 'Você fez uns bicos como programador', min: 120, max: 320 },
  { text: 'Você passeou com os cachorros da vizinhança', min: 40, max: 140 },
  { text: 'Você vendeu doces na praça', min: 50, max: 160 },
  { text: 'Você consertou o computador de um amigo', min: 80, max: 220 },
  { text: 'Você fez uma live e ganhou doações', min: 30, max: 400 },
  { text: 'Você lavou carros no estacionamento', min: 45, max: 150 },
  { text: 'Você desenhou uma logo por encomenda', min: 100, max: 260 },
];
