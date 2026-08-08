import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Mostra a latência do bot e da API do Discord.')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction, client) {
    const sent = await interaction.reply({ content: '⏳ Medindo…', withResponse: true });
    // `resource` é anulável na tipagem; se vier vazio, medimos com o relógio local.
    const sentAt = sent.resource?.message?.createdTimestamp ?? Date.now();
    const roundtrip = Math.max(0, sentAt - interaction.createdTimestamp);
    const gateway = Math.round(client.ws.ping);

    const quality = (value) => (value < 200 ? '🟢' : value < 500 ? '🟡' : '🔴');

    await interaction.editReply({
      content: null,
      embeds: [
        embed
          .base(colors.primary)
          .setTitle('🏓 Pong!')
          .addFields(
            {
              name: 'Resposta',
              value: `${quality(roundtrip)} ${roundtrip}ms`,
              inline: true,
            },
            {
              name: 'WebSocket',
              value: gateway < 0 ? '⚪ medindo…' : `${quality(gateway)} ${gateway}ms`,
              inline: true,
            },
          ),
      ],
    });
  },
};
