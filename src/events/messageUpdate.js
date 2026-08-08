import { Events } from 'discord.js';
import { getGuildConfig } from '../lib/db.js';
import { colors } from '../config.js';
import { embed, truncate } from '../lib/embeds.js';
import { sendToLog } from '../services/modcase.js';

export default {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.partial) return;
    // Edições de embed (preview de link) disparam o evento sem mudar o texto.
    if (oldMessage.content === newMessage.content) return;

    const settings = getGuildConfig(newMessage.guild.id);
    if (!settings.server_log_channel) return;

    const log = embed
      .base(colors.warning)
      .setAuthor({
        name: `Mensagem editada · ${newMessage.author.tag}`,
        iconURL: newMessage.author.displayAvatarURL({ size: 128 }),
      })
      .addFields(
        { name: 'Canal', value: `${newMessage.channel}`, inline: true },
        { name: 'Link', value: `[Ir para a mensagem](${newMessage.url})`, inline: true },
        { name: 'Antes', value: truncate(oldMessage.content || '*(vazio)*') },
        { name: 'Depois', value: truncate(newMessage.content || '*(vazio)*') },
      )
      .setTimestamp();

    await sendToLog(newMessage.guild, settings.server_log_channel, log);
  },
};
