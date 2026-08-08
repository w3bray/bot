import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { embed } from '../../lib/embeds.js';
import { updateProfile } from '../../services/profiles.js';

export default {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('bio')
    .setDescription('Define o texto que aparece no seu /perfil.')
    .addStringOption((option) =>
      option
        .setName('texto')
        .setDescription('Sua bio (deixe vazio para apagar)')
        .setMaxLength(200),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const text = interaction.options.getString('texto');

    updateProfile(interaction.guildId, interaction.user.id, { bio: text ?? null });

    await interaction.reply({
      embeds: [
        embed.success(text ? `Bio atualizada:\n> ${text}` : 'Sua bio foi apagada.'),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
