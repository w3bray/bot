import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';
import {
  QUIZ_LETTERS,
  QUIZ_REWARD,
  QUIZ_TIMEOUT,
  drawQuestion,
  quizRow,
  setGame,
} from '../../services/games.js';
import { getGuildConfig } from '../../lib/db.js';
import { formatMoney } from '../../services/economy.js';

export default {
  cooldown: 15,
  data: new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('Faz uma pergunta de conhecimentos gerais. Quem acertar primeiro ganha moedas.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const settings = getGuildConfig(interaction.guildId);
    const { question, options, answer } = drawQuestion();

    await interaction.deferReply();
    const message = await interaction.fetchReply();

    setGame(message.id, {
      type: 'quiz',
      answer,
      options,
      question,
      expiresAt: Date.now() + QUIZ_TIMEOUT,
      answered: [],
    });

    await interaction.editReply({
      embeds: [
        embed
          .base(colors.primary)
          .setTitle('🧩 Quiz')
          .setDescription(
            [
              `**${question}**`,
              '',
              ...options.map((option, index) => `${QUIZ_LETTERS[index]} ${option}`),
            ].join('\n'),
          )
          .setFooter({
            text: `Você tem ${QUIZ_TIMEOUT / 1000}s · quem acertar primeiro leva ${formatMoney(QUIZ_REWARD, settings.currency_name)}`,
          }),
      ],
      components: [quizRow(message.id, options)],
    });
  },
};
