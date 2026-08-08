import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { MARKS, boardRows, setGame } from '../../services/games.js';

export default {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('velha')
    .setDescription('Joga uma partida de jogo da velha contra outro membro.')
    .addUserOption((option) =>
      option.setName('adversario').setDescription('Contra quem?').setRequired(true),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const opponent = interaction.options.getUser('adversario');

    if (opponent.id === interaction.user.id) {
      return replyError(interaction, 'Jogar contra si mesmo não tem graça.');
    }
    if (opponent.bot) return replyError(interaction, 'Bots não jogam jogo da velha.');

    const member = await interaction.guild.members.fetch(opponent.id).catch(() => null);
    if (!member) return replyError(interaction, 'Esse membro não está no servidor.');

    await interaction.deferReply();
    const message = await interaction.fetchReply();

    const board = Array(9).fill(null);
    // O jogador 0 (❌) sempre começa e é quem chamou o comando.
    setGame(message.id, {
      type: 'velha',
      players: [interaction.user.id, opponent.id],
      board,
      turn: 0,
    });

    await interaction.editReply({
      content: `${opponent}`,
      embeds: [
        embed
          .base(colors.primary)
          .setTitle('⭕❌ Jogo da velha')
          .setDescription(
            [
              `${MARKS[0]} ${interaction.user}`,
              `${MARKS[1]} ${opponent}`,
              '',
              `É a vez de ${interaction.user}.`,
            ].join('\n'),
          )
          .setFooter({ text: 'A partida expira após 15 minutos sem jogadas.' }),
      ],
      components: boardRows(message.id, board),
    });
  },
};
