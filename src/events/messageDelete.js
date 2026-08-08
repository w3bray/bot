import { Events } from 'discord.js';
import { getGuildConfig } from '../lib/db.js';
import { colors } from '../config.js';
import { embed, truncate } from '../lib/embeds.js';
import { sendToLog } from '../services/modcase.js';

export default {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild || message.author?.bot) return;
    if (message.partial) return; // conteúdo não estava em cache: nada a registrar

    const settings = getGuildConfig(message.guild.id);
    if (!settings.server_log_channel) return;

    const log = embed
      .base(colors.danger)
      .setAuthor({
        name: `Mensagem apagada · ${message.author.tag}`,
        iconURL: message.author.displayAvatarURL({ size: 128 }),
      })
      .addFields(
        { name: 'Canal', value: `${message.channel}`, inline: true },
        { name: 'Autor', value: `${message.author} \`${message.author.id}\``, inline: true },
        { name: 'Conteúdo', value: truncate(message.content || '*(sem texto)*') },
      )
      .setTimestamp();

    if (message.attachments.size > 0) {
      log.addFields({
        name: 'Anexos',
        value: truncate(message.attachments.map((a) => a.name).join(', ')),
      });
    }

    await sendToLog(message.guild, settings.server_log_channel, log);
  },
};
