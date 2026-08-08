import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError, truncate } from '../../lib/embeds.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('escolher')
    .setDescription('Escolhe uma opção aleatória da sua lista.')
    .addStringOption((option) =>
      option
        .setName('opcoes')
        .setDescription('Opções separadas por vírgula. Ex.: pizza, sushi, hambúrguer')
        .setRequired(true)
        .setMaxLength(500),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction) {
    const options = interaction.options
      .getString('opcoes')
      .split(',')
      .map((option) => option.trim())
      .filter(Boolean);

    if (options.length < 2) {
      return replyError(interaction, 'Informe pelo menos **duas** opções separadas por vírgula.');
    }

    const chosen = options[Math.floor(Math.random() * options.length)];

    await interaction.reply({
      embeds: [
        embed
          .base(colors.primary)
          .setTitle('🤔 Eu escolho…')
          .setDescription(`**${truncate(chosen, 200)}**`)
          .setFooter({ text: `Sorteado entre ${options.length} opções` }),
      ],
    });
  },
};
