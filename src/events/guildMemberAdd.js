import { Events } from 'discord.js';
import { getGuildConfig } from '../lib/db.js';
import { colors } from '../config.js';
import { embed } from '../lib/embeds.js';
import { timestamp } from '../lib/time.js';
import { sendToLog } from '../services/modcase.js';
import { logger } from '../lib/logger.js';

/** Substitui os marcadores disponíveis nas mensagens de boas-vindas/saída. */
export function applyPlaceholders(template, member) {
  return template
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{tag}', member.user.tag)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', String(member.guild.memberCount));
}

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const settings = getGuildConfig(member.guild.id);

    if (settings.autorole && member.guild.roles.cache.has(settings.autorole)) {
      await member.roles
        .add(settings.autorole, 'Autorole de entrada')
        .catch((error) => logger.debug('Falha no autorole:', error.message));
    }

    if (settings.welcome_channel) {
      const channel = await member.guild.channels
        .fetch(settings.welcome_channel)
        .catch(() => null);

      if (channel?.isTextBased()) {
        const template = settings.welcome_message || 'Bem-vindo(a) ao **{server}**, {user}! 👋';
        const welcome = embed
          .base(colors.success)
          .setDescription(applyPlaceholders(template, member))
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: `Membro nº ${member.guild.memberCount}` })
          .setTimestamp();

        await channel.send({ embeds: [welcome] }).catch(() => null);
      }
    }

    await sendToLog(
      member.guild,
      settings.server_log_channel,
      embed
        .base(colors.success)
        .setAuthor({
          name: `Entrou: ${member.user.tag}`,
          iconURL: member.user.displayAvatarURL({ size: 128 }),
        })
        .addFields(
          { name: 'Usuário', value: `${member} \`${member.id}\``, inline: true },
          { name: 'Conta criada', value: timestamp(member.user.createdAt, 'R'), inline: true },
        )
        .setTimestamp(),
    );
  },
};
