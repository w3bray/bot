import { MessageFlags } from 'discord.js';
import { getGuildConfig } from '../lib/db.js';
import { colors } from '../config.js';
import { embed } from '../lib/embeds.js';
import { QUIZ_LETTERS, QUIZ_REWARD, deleteGame, getGame, quizRow } from '../services/games.js';
import { addBalance, formatMoney } from '../services/economy.js';

export default {
  id: 'quiz',

  async execute(interaction, { action, args }) {
    if (action !== 'answer') return;

    const [messageId, rawChoice] = args;
    const choice = Number(rawChoice);
    const game = getGame(messageId ?? interaction.message.id);

    if (!game || game.type !== 'quiz') {
      return interaction.reply({
        embeds: [embed.error('Esse quiz já terminou.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (Date.now() > game.expiresAt) {
      deleteGame(messageId);
      return interaction.update({
        embeds: [
          embed
            .base(colors.warning)
            .setTitle('⏰ Tempo esgotado')
            .setDescription(
              `Ninguém respondeu a tempo.\nA resposta certa era ${QUIZ_LETTERS[game.answer]} **${game.options[game.answer]}**.`,
            ),
        ],
        components: [quizRow(messageId, game.options, { disabled: true, answer: game.answer })],
      });
    }

    // Cada pessoa tem uma tentativa só, para não chutar todas as alternativas.
    if (game.answered.includes(interaction.user.id)) {
      return interaction.reply({
        embeds: [embed.warning('Você já tentou nesta rodada.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (choice !== game.answer) {
      game.answered.push(interaction.user.id);
      return interaction.reply({
        embeds: [embed.error('Resposta errada! Deixe outra pessoa tentar.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    deleteGame(messageId);

    const settings = getGuildConfig(interaction.guildId);
    addBalance(interaction.guildId, interaction.user.id, QUIZ_REWARD);

    await interaction.update({
      embeds: [
        embed
          .base(colors.success)
          .setTitle('🎉 Resposta certa!')
          .setDescription(
            [
              `**${game.question}**`,
              '',
              `${QUIZ_LETTERS[game.answer]} **${game.options[game.answer]}**`,
              '',
              `${interaction.user} acertou e ganhou **${formatMoney(QUIZ_REWARD, settings.currency_name)}**!`,
            ].join('\n'),
          ),
      ],
      components: [quizRow(messageId, game.options, { disabled: true, answer: game.answer })],
    });
  },
};
