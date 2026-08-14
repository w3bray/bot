import { db, getGuildConfig } from '../lib/db.js';
import { colors, emojis } from '../config.js';
import { embed, truncate } from '../lib/embeds.js';
import { logger } from '../lib/logger.js';
import { quantidade } from '../lib/portugues.js';

const selectEntry = db.prepare('SELECT * FROM starboard WHERE guild_id = ? AND message_id = ?');
const upsertEntry = db.prepare(`
  INSERT INTO starboard (guild_id, message_id, star_message_id, stars)
  VALUES (?, ?, ?, ?)
  ON CONFLICT (guild_id, message_id) DO UPDATE SET star_message_id = excluded.star_message_id, stars = excluded.stars
`);
const deleteEntry = db.prepare('DELETE FROM starboard WHERE guild_id = ? AND message_id = ?');

export const STAR_EMOJI = '⭐';

/** Reage a uma mudança de estrelas: cria, atualiza ou remove o post do starboard. */
export async function sync(reaction) {
  if (reaction.emoji.name !== STAR_EMOJI) return;

  const message = reaction.message.partial
    ? await reaction.message.fetch().catch(() => null)
    : reaction.message;
  if (!message?.guild || message.author?.bot) return;

  const settings = getGuildConfig(message.guild.id);
  if (!settings.starboard_channel) return;
  // Evita loop: estrelas na própria mensagem do starboard são ignoradas.
  if (message.channel.id === settings.starboard_channel) return;

  const channel = await message.guild.channels
    .fetch(settings.starboard_channel)
    .catch(() => null);
  if (!channel?.isTextBased()) return;

  const stars = message.reactions.cache.get(STAR_EMOJI)?.count ?? 0;
  const existing = selectEntry.get(message.guild.id, message.id);

  if (stars < settings.starboard_min) {
    if (!existing) return;
    await channel.messages
      .fetch(existing.star_message_id)
      .then((posted) => posted.delete())
      .catch(() => null);
    deleteEntry.run(message.guild.id, message.id);
    return;
  }

  const payload = {
    content: `${emojis.star} **${stars}** · ${message.channel}`,
    embeds: [buildEmbed(message, stars)],
  };

  try {
    if (existing) {
      const posted = await channel.messages.fetch(existing.star_message_id).catch(() => null);
      if (posted) {
        await posted.edit(payload);
        upsertEntry.run(message.guild.id, message.id, posted.id, stars);
        return;
      }
    }

    const posted = await channel.send(payload);
    upsertEntry.run(message.guild.id, message.id, posted.id, stars);
  } catch (error) {
    logger.debug('Falha ao atualizar o mural de destaques:', error.message);
  }
}

function buildEmbed(message, stars) {
  const result = embed
    .base(colors.warning)
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL({ size: 128 }),
    })
    .setDescription(truncate(message.content || '*(sem texto)*', 4000))
    .addFields({ name: 'Original', value: `[Ir para a mensagem](${message.url})` })
    .setFooter({ text: `${quantidade(stars, 'estrela')} · ID ${message.id}` })
    .setTimestamp(message.createdTimestamp);

  const image = message.attachments.find((attachment) =>
    attachment.contentType?.startsWith('image/'),
  );
  if (image) result.setImage(image.url);

  return result;
}
