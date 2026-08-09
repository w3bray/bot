import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { replyError } from '../../lib/embeds.js';
import { renderPanel, renderPicker } from '../../components/builder.js';
import { EXTRAS, TEMPLATES } from '../../services/templates.js';

export default {
  cooldown: 30,

  data: new SlashCommandBuilder()
    .setName('construir')
    .setDescription('Monta o servidor inteiro — categorias, canais e cargos — a partir de um modelo.')
    .addStringOption((option) =>
      option
        .setName('modelo')
        .setDescription('Pula a escolha e já abre a prévia desse modelo')
        .addChoices(
          ...Object.entries(TEMPLATES).map(([key, template]) => ({
            name: `${template.emoji} ${template.label}`,
            value: key,
          })),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return replyError(
        interaction,
        'Preciso da permissão **Gerenciar Canais** para usar este comando.',
      );
    }

    const requested = interaction.options.getString('modelo');
    // Com modelo escolhido já abrimos a prévia; sem ele, o menu de modelos.
    const payload = requested ? renderPanel(requested, Object.keys(EXTRAS)) : renderPicker();

    await interaction.reply(payload);
  },
};
