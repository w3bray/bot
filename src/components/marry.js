import { MessageFlags } from 'discord.js';
import { colors } from '../config.js';
import { embed } from '../lib/embeds.js';
import { marry } from '../services/profiles.js';

export default {
  id: 'marry',

  async execute(interaction, { action, args }) {
    const [proposerId, targetId] = args;

    // Só quem foi pedido pode responder ao pedido.
    if (interaction.user.id !== targetId) {
      return interaction.reply({
        embeds: [embed.error('Esse pedido não é para você.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === 'decline') {
      return interaction.update({
        embeds: [
          embed.warning(
            `<@${targetId}> recusou o pedido de <@${proposerId}>. Fica para a próxima. 💔`,
            '💔 Pedido recusado',
          ),
        ],
        components: [],
      });
    }

    const result = marry(interaction.guildId, proposerId, targetId);

    if (!result.ok) {
      return interaction.update({
        embeds: [embed.error(`O casamento não pôde ser realizado: ${result.reason}.`)],
        components: [],
      });
    }

    await interaction.update({
      embeds: [
        embed
          .base(colors.success)
          .setTitle('💍 Casamento realizado!')
          .setDescription(
            `<@${proposerId}> e <@${targetId}> agora estão casados!\nParabéns aos dois! 🎉`,
          )
          .setTimestamp(result.since),
      ],
      components: [],
    });
  },
};
