import { Events } from 'discord.js';
import { getGuildConfig } from '../lib/db.js';
import { colors } from '../config.js';
import { embed, truncate } from '../lib/embeds.js';
import { timestamp } from '../lib/time.js';
import { sendToLog } from '../services/modcase.js';
import { applyPlaceholders } from './guildMemberAdd.js';

export default {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const settings = getGuildConfig(member.guild.id);

    if (settings.goodbye_channel) {
      const channel = await member.guild.channels
        .fetch(settings.goodbye_channel)
        .catch(() => null);

      if (channel?.isTextBased()) {
        const template = settings.goodbye_message || '**{tag}** saiu do servidor. 👋';
        await channel
          .send({
            embeds: [
              embed
                .base(colors.neutral)
                .setDescription(applyPlaceholders(template, member))
                .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                .setTimestamp(),
            ],
          })
          .catch(() => null);
      }
    }

    const roles = member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .map((role) => role.name)
      .join(', ');

    await sendToLog(
      member.guild,
      settings.server_log_channel,
      embed
        .base(colors.danger)
        .setAuthor({
          name: `Saiu: ${member.user.tag}`,
          iconURL: member.user.displayAvatarURL({ size: 128 }),
        })
        .addFields(
          { name: 'Usuário', value: `${member} \`${member.id}\``, inline: true },
          {
            name: 'Entrou',
            value: member.joinedAt ? timestamp(member.joinedAt, 'R') : 'desconhecido',
            inline: true,
          },
          { name: 'Cargos', value: truncate(roles || 'nenhum') },
        )
        .setTimestamp(),
    );
  },
};
