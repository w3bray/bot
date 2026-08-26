import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { replyError } from '../../lib/embeds.js';
import { renderPanel, renderPicker } from '../../components/builder.js';
import { isOwner } from '../../lib/owner.js';
import { EXTRAS, exigeDono, templatesPublicos } from '../../services/templates.js';

export default {
  cooldown: 30,

  data: new SlashCommandBuilder()
    .setName('construir')
    .setDescription('Monta o servidor inteiro — categorias, canais e cargos — a partir de um modelo.')
    .addStringOption((option) =>
      option
        .setName('modelo')
        .setDescription('Pula a escolha e já abre a prévia desse modelo')
        // Só os modelos públicos: a lista de escolhas é a mesma para todo mundo,
        // então um modelo restrito ali seria uma vitrine do que ninguém pode usar.
        .addChoices(
          ...templatesPublicos().map(([key, template]) => ({
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

    const dono = isOwner(interaction.user.id);
    const requested = interaction.options.getString('modelo');

    // O modelo restrito não está nas escolhas, mas o Discord aceita valor
    // digitado quando o cliente é modificado — então recusamos aqui também.
    if (requested && exigeDono(requested) && !dono) {
      return replyError(interaction, 'Esse modelo não existe.');
    }

    // Com modelo escolhido já abrimos a prévia; sem ele, o menu de modelos.
    const payload = requested ? renderPanel(requested, Object.keys(EXTRAS)) : renderPicker(dono);

    await interaction.reply(payload);
  },
};
