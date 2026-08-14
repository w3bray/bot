import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { embed } from '../../lib/embeds.js';
import { updateProfile } from '../../services/profiles.js';

export default {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('biografia')
    .setDescription('Define a biografia exibida no seu perfil.')
    .addStringOption((option) =>
      option
        .setName('texto')
        .setDescription('Sua biografia (deixe vazio para apagar)')
        .setMaxLength(200),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const text = interaction.options.getString('texto');

    updateProfile(interaction.guildId, interaction.user.id, { bio: text ?? null });

    await interaction.reply({
      embeds: [
        embed.success(
          text ? `Biografia atualizada:\n> ${text}` : 'Sua biografia foi apagada.',
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
