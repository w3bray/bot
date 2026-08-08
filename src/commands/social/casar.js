import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { getProfile } from '../../services/profiles.js';

export default {
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName('casar')
    .setDescription('Pede alguém em casamento. A pessoa precisa aceitar.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Quem você quer pedir?').setRequired(true),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const target = interaction.options.getUser('usuario');

    if (target.id === interaction.user.id) {
      return replyError(interaction, 'Você não pode se casar consigo mesmo.');
    }
    if (target.bot) return replyError(interaction, 'Bots não se casam.');

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return replyError(interaction, 'Essa pessoa não está no servidor.');

    const own = getProfile(interaction.guildId, interaction.user.id);
    if (own.married_to) {
      return replyError(
        interaction,
        `Você já está casado(a) com <@${own.married_to}>. Use \`/divorciar\` primeiro.`,
      );
    }

    const other = getProfile(interaction.guildId, target.id);
    if (other.married_to) {
      return replyError(interaction, `**${target.tag}** já está casado(a) com outra pessoa.`);
    }

    // Os IDs vão no custom_id para que só o par certo consiga responder.
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`marry:accept:${interaction.user.id}:${target.id}`)
        .setLabel('Aceitar')
        .setEmoji('💍')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`marry:decline:${interaction.user.id}:${target.id}`)
        .setLabel('Recusar')
        .setEmoji('💔')
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({
      content: `${target}`,
      embeds: [
        embed
          .base(colors.danger)
          .setTitle('💍 Pedido de casamento')
          .setDescription(
            `${interaction.user} está pedindo ${target} em casamento!\n\nE aí, ${target}, aceita?`,
          )
          .setFooter({ text: 'Só a pessoa pedida pode responder.' }),
      ],
      components: [row],
    });
  },
};
