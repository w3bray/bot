import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { getUserLevel } from '../../services/leveling.js';

const BAR_LENGTH = 20;

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('nivel')
    .setDescription('Mostra seu nível e progresso de XP.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quem? (padrão: você)'),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const user = interaction.options.getUser('usuario') ?? interaction.user;
    if (user.bot) return replyError(interaction, 'Bots não acumulam XP.');

    const stats = getUserLevel(interaction.guildId, user.id);

    if (stats.messages === 0 && stats.xp === 0) {
      return replyError(
        interaction,
        user.id === interaction.user.id
          ? 'Você ainda não tem XP. Converse no servidor para começar a subir de nível!'
          : `**${user.tag}** ainda não tem XP neste servidor.`,
      );
    }

    const ratio = stats.neededXp === 0 ? 1 : stats.currentLevelXp / stats.neededXp;
    const filled = Math.round(ratio * BAR_LENGTH);
    const bar = '█'.repeat(filled) + '░'.repeat(BAR_LENGTH - filled);

    await interaction.reply({
      embeds: [
        embed
          .base(colors.level)
          .setAuthor({
            name: `Nível de ${user.tag}`,
            iconURL: user.displayAvatarURL({ size: 128 }),
          })
          .setThumbnail(user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: 'Nível', value: `**${stats.level}**`, inline: true },
            { name: 'Posição', value: `**#${stats.rank}**`, inline: true },
            {
              name: 'Mensagens',
              value: `**${stats.messages.toLocaleString('pt-BR')}**`,
              inline: true,
            },
            {
              name: `Progresso para o nível ${stats.level + 1}`,
              value: `\`${bar}\` ${Math.round(ratio * 100)}%\n**${stats.currentLevelXp.toLocaleString('pt-BR')}** / ${stats.neededXp.toLocaleString('pt-BR')} XP`,
            },
            {
              name: 'XP total',
              value: stats.xp.toLocaleString('pt-BR'),
              inline: true,
            },
          ),
      ],
    });
  },
};
