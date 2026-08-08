import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';

const ANSWERS = [
  { text: 'Com certeza!', positive: true },
  { text: 'Sem dúvida.', positive: true },
  { text: 'Sim, definitivamente.', positive: true },
  { text: 'Pode contar com isso.', positive: true },
  { text: 'Pelo que vejo, sim.', positive: true },
  { text: 'Provavelmente.', positive: true },
  { text: 'Melhor não te contar agora.', positive: null },
  { text: 'Pergunte de novo mais tarde.', positive: null },
  { text: 'Concentre-se e pergunte outra vez.', positive: null },
  { text: 'Não conte com isso.', positive: false },
  { text: 'Minha resposta é não.', positive: false },
  { text: 'Minhas fontes dizem que não.', positive: false },
  { text: 'Muito duvidoso.', positive: false },
];

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('bola8')
    .setDescription('Faz uma pergunta à bola mágica 8.')
    .addStringOption((option) =>
      option
        .setName('pergunta')
        .setDescription('O que você quer saber?')
        .setRequired(true)
        .setMaxLength(200),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction) {
    const question = interaction.options.getString('pergunta');
    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    const color =
      answer.positive === true
        ? colors.success
        : answer.positive === false
          ? colors.danger
          : colors.warning;

    await interaction.reply({
      embeds: [
        embed
          .base(color)
          .setTitle('🎱 Bola mágica 8')
          .addFields(
            { name: 'Pergunta', value: question },
            { name: 'Resposta', value: `**${answer.text}**` },
          ),
      ],
    });
  },
};
