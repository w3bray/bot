/**
 * Guarda a última mensagem apagada de cada canal, apenas em memória.
 *
 * Deliberadamente não vai para o banco: conteúdo apagado é sensível e não deve
 * sobreviver a um reinício do bot nem ficar gravado em disco. Também expira
 * sozinho depois de 10 minutos.
 */
const store = new Map();
const TTL = 10 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - TTL;
  for (const [channelId, entry] of store) {
    if (entry.deletedAt < cutoff) store.delete(channelId);
  }
}, 60_000).unref();

export function remember(message) {
  // Mensagens apagadas chegam frequentemente incompletas; nada aqui pode
  // assumir que uma coleção existe.
  const attachments = message.attachments?.map?.((attachment) => attachment.name) ?? [];
  if (!message.content && attachments.length === 0) return;

  store.set(message.channel.id, {
    authorId: message.author.id,
    authorTag: message.author.tag,
    avatar: message.author.displayAvatarURL({ size: 128 }),
    content: message.content ?? '',
    attachments,
    createdAt: message.createdTimestamp,
    deletedAt: Date.now(),
  });
}

export function recall(channelId) {
  const entry = store.get(channelId);
  if (!entry) return null;
  if (Date.now() - entry.deletedAt > TTL) {
    store.delete(channelId);
    return null;
  }
  return entry;
}

export function forget(channelId) {
  store.delete(channelId);
}
