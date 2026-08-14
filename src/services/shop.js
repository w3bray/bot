import { db } from '../lib/db.js';
import { addBadge } from './profiles.js';

/**
 * Catálogo fixo da loja. Cada item vira um distintivo exibido em /perfil.
 * Manter em código (e não no banco) mantém a loja igual em todos os servidores
 * e evita que um admin crie itens quebrados.
 */
export const ITEMS = [
  {
    id: 'coroa',
    emoji: '👑',
    name: 'Coroa',
    price: 25_000,
    description: 'O distintivo mais caro da loja. Para quem gosta de ostentar.',
  },
  {
    id: 'diamante',
    emoji: '💎',
    name: 'Diamante',
    price: 10_000,
    description: 'Brilha no seu perfil e no seu ego.',
  },
  {
    id: 'foguete',
    emoji: '🚀',
    name: 'Foguete',
    price: 5000,
    description: 'Para quem subiu de nível rápido demais.',
  },
  {
    id: 'trofeu',
    emoji: '🏆',
    name: 'Troféu',
    price: 2500,
    description: 'Prova de que você venceu alguma coisa. Talvez.',
  },
  {
    id: 'estrela',
    emoji: '⭐',
    name: 'Estrela',
    price: 1000,
    description: 'Clássico, barato e elegante.',
  },
  {
    id: 'coracao',
    emoji: '💖',
    name: 'Coração',
    price: 750,
    description: 'Combina bem com o sistema de casamento.',
  },
  {
    id: 'pizza',
    emoji: '🍕',
    name: 'Pizza',
    price: 300,
    description: 'Não alimenta ninguém, mas fica bonita no perfil.',
  },
];

export const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

const selectOwned = db.prepare(
  'SELECT * FROM inventory WHERE guild_id = ? AND user_id = ? AND item_id = ?',
);

/** Itens que o usuário possui, já resolvidos para o catálogo. */
export function getInventory(guildId, userId) {
  return db
    .prepare('SELECT * FROM inventory WHERE guild_id = ? AND user_id = ? ORDER BY bought_at')
    .all(guildId, userId)
    .map((row) => ({ ...row, item: ITEMS_BY_ID.get(row.item_id) }))
    .filter((row) => row.item);
}

/**
 * Compra um item: debita o saldo, grava no inventário e concede o distintivo,
 * tudo na mesma transação.
 */
export const buyItem = db.transaction((guildId, userId, itemId) => {
  const item = ITEMS_BY_ID.get(itemId);
  if (!item) return { ok: false, reason: 'esse item não existe' };

  if (selectOwned.get(guildId, userId, itemId)) {
    return { ok: false, reason: 'você já tem esse item' };
  }

  db.prepare('INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)').run(
    guildId,
    userId,
  );
  const account = db
    .prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);

  if (account.balance < item.price) {
    return { ok: false, reason: 'saldo insuficiente', missing: item.price - account.balance };
  }

  db.prepare(
    'UPDATE economy SET balance = balance - ? WHERE guild_id = ? AND user_id = ?',
  ).run(item.price, guildId, userId);

  db.prepare(
    'INSERT INTO inventory (guild_id, user_id, item_id, quantity, bought_at) VALUES (?, ?, ?, 1, ?)',
  ).run(guildId, userId, itemId, Date.now());

  addBadge(guildId, userId, itemId);

  return { ok: true, item, remaining: account.balance - item.price };
});
