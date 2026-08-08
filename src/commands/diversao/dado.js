import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, truncate } from '../../lib/embeds.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('dado')
    .setDescription('Rola dados. Padrão: 1 dado de 6 lados.')
    .addIntegerOption((option) =>
      option
        .setName('lados')
        .setDescription('Quantos lados tem o dado (2 a 1000)')
        .setMinValue(2)
        .setMaxValue(1000),
    )
    .addIntegerOption((option) =>
      option
        .setName('quantidade')
        .setDescription('Quantos dados rolar (1 a 20)')
        .setMinValue(1)
        .setMaxValue(20),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction) {
    const sides = interaction.options.getInteger('lados') ?? 6;
    const amount = interaction.options.getInteger('quantidade') ?? 1;

    const rolls = Array.from(
      { length: amount },
      () => Math.floor(Math.random() * sides) + 1,
    );
    const total = rolls.reduce((sum, value) => sum + value, 0);

    const result = embed
      .base(colors.primary)
      .setTitle('🎲 Rolagem de dados')
      .setDescription(`\`${amount}d${sides}\` → **${total}**`);

    if (amount > 1) {
      result.addFields(
        { name: 'Resultados', value: truncate(rolls.join(' + ')) },
        { name: 'Média', value: (total / amount).toFixed(2), inline: true },
        { name: 'Maior', value: String(Math.max(...rolls)), inline: true },
        { name: 'Menor', value: String(Math.min(...rolls)), inline: true },
      );
    }

    await interaction.reply({ embeds: [result] });
  },
};
