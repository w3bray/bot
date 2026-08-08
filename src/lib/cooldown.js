import { config } from '../config.js';

const buckets = new Map();

/**
 * Verifica o cooldown de um comando para um usuário.
 * Retorna 0 quando liberado, ou os milissegundos restantes.
 */
export function checkCooldown(commandName, userId, seconds) {
  if (!seconds || config.ownerIds.includes(userId)) return 0;

  const key = `${commandName}:${userId}`;
  const now = Date.now();
  const expiresAt = buckets.get(key);

  if (expiresAt && expiresAt > now) return expiresAt - now;

  buckets.set(key, now + seconds * 1000);
  return 0;
}

// Limpeza periódica para o Map não crescer indefinidamente.
setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of buckets) {
    if (expiresAt <= now) buckets.delete(key);
  }
}, 300_000).unref();
