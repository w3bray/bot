import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';

const formatar = (valor) =>
  Number(valor.toFixed(2)).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('estimativa')
    .setDescription('Calcula uma estimativa PERT a partir de três cenários.')
    .addNumberOption((option) =>
      option
        .setName('otimista')
        .setDescription('Menor valor plausível')
        .setRequired(true)
        .setMinValue(0),
    )
    .addNumberOption((option) =>
      option
        .setName('provavel')
        .setDescription('Valor mais provável')
        .setRequired(true)
        .setMinValue(0),
    )
    .addNumberOption((option) =>
      option
        .setName('pessimista')
        .setDescription('Maior valor plausível')
        .setRequired(true)
        .setMinValue(0),
    )
    .addStringOption((option) =>
      option
        .setName('unidade')
        .setDescription('Ex.: horas, dias ou pontos')
        .setMaxLength(30),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction) {
    const otimista = interaction.options.getNumber('otimista');
    const provavel = interaction.options.getNumber('provavel');
    const pessimista = interaction.options.getNumber('pessimista');
    const unidade = interaction.options.getString('unidade')?.trim() || 'unidades';

    if (otimista > provavel || provavel > pessimista) {
      return replyError(
        interaction,
        'Use valores em ordem crescente: otimista, mais provável e pessimista.',
      );
    }

    const esperado = (otimista + 4 * provavel + pessimista) / 6;
    const desvio = (pessimista - otimista) / 6;
    const minimo95 = Math.max(0, esperado - 2 * desvio);
    const maximo95 = esperado + 2 * desvio;

    await interaction.reply({
      embeds: [
        embed
          .base(colors.primary)
          .setTitle('Estimativa PERT')
          .setDescription(
            [
              `**Valor esperado:** ${formatar(esperado)} ${unidade}`,
              `**Faixa aproximada de 95%:** ${formatar(minimo95)} a ${formatar(maximo95)} ${unidade}`,
              `**Desvio estimado:** ${formatar(desvio)} ${unidade}`,
            ].join('\n'),
          )
          .addFields({
            name: 'Cenários informados',
            value: [
              `Otimista: ${formatar(otimista)}`,
              `Mais provável: ${formatar(provavel)}`,
              `Pessimista: ${formatar(pessimista)}`,
            ].join('\n'),
          })
          .setFooter({ text: 'Cálculo: (otimista + 4 × provável + pessimista) ÷ 6.' }),
      ],
    });
  },
};
