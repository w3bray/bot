import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { embed, replyError } from '../../lib/embeds.js';
import { divorce } from '../../services/profiles.js';

export default {
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName('divorciar')
    .setDescription('Desfaz seu casamento.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const result = divorce(interaction.guildId, interaction.user.id);

    if (!result.ok) return replyError(interaction, `Não deu: ${result.reason}.`);

    await interaction.reply({
      embeds: [
        embed.warning(
          `${interaction.user} e <@${result.partner}> não estão mais casados. 💔`,
          '💔 Divórcio',
        ),
      ],
    });
  },
};
