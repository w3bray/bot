import { MessageFlags } from 'discord.js';
import { colors } from '../config.js';
import { embed } from '../lib/embeds.js';
import { MARKS, boardRows, checkWinner, deleteGame, getGame, setGame } from '../services/games.js';

export default {
  id: 'ttt',

  async execute(interaction, { action, args }) {
    if (action !== 'play') return;

    const [messageId, rawIndex] = args;
    const index = Number(rawIndex);
    const game = getGame(messageId ?? interaction.message.id);

    if (!game || game.type !== 'velha') {
      return interaction.reply({
        embeds: [embed.error('Esta partida expirou ou já terminou.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const seat = game.players.indexOf(interaction.user.id);
    if (seat === -1) {
      return interaction.reply({
        embeds: [embed.error('Você não está nesta partida.')],
        flags: MessageFlags.Ephemeral,
      });
    }
    if (seat !== game.turn) {
      return interaction.reply({
        embeds: [embed.warning('Não é a sua vez.')],
        flags: MessageFlags.Ephemeral,
      });
    }
    if (game.board[index] !== null) {
      return interaction.reply({
        embeds: [embed.warning('Essa casa já está ocupada.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    game.board[index] = seat;
    const outcome = checkWinner(game.board);

    if (outcome === null) {
      game.turn = 1 - game.turn;
      setGame(messageId, game);

      return interaction.update({
        embeds: [
          embed
            .base(colors.primary)
            .setTitle('⭕❌ Jogo da velha')
            .setDescription(
              [
                `${MARKS[0]} <@${game.players[0]}>`,
                `${MARKS[1]} <@${game.players[1]}>`,
                '',
                `É a vez de <@${game.players[game.turn]}>.`,
              ].join('\n'),
            ),
        ],
        components: boardRows(messageId, game.board),
      });
    }

    deleteGame(messageId);

    const draw = outcome === 'empate';
    const winnerId = draw ? null : game.players[outcome.winner];

    await interaction.update({
      embeds: [
        embed
          .base(draw ? colors.warning : colors.success)
          .setTitle(draw ? '🤝 Deu velha!' : '🎉 Temos um vencedor!')
          .setDescription(
            draw
              ? 'Ninguém venceu — o tabuleiro encheu.'
              : `${MARKS[outcome.winner]} <@${winnerId}> venceu a partida!`,
          ),
      ],
      components: boardRows(messageId, game.board, {
        disabled: true,
        highlight: draw ? [] : outcome.line,
      }),
    });
  },
};
