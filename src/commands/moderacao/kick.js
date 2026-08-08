import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { embed, replyError } from '../../lib/embeds.js';
import { checkHierarchy } from '../../lib/permissions.js';
import { createCase, notifyUser } from '../../services/modcase.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa um membro do servidor.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Quem será expulso').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('motivo').setDescription('Motivo da expulsão').setMaxLength(400),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const target = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo') ?? 'Sem motivo informado.';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return replyError(interaction, 'Esse usuário não está no servidor.');

    const problem = checkHierarchy(interaction.member, member, interaction.guild.members.me);
    if (problem) return replyError(interaction, problem);
    if (!member.kickable) return replyError(interaction, 'Não tenho permissão para expulsar esse membro.');

    await interaction.deferReply();
    const notified = await notifyUser(target, interaction.guild, { type: 'kick', reason });

    try {
      await member.kick(`${interaction.user.tag}: ${reason}`);
    } catch {
      return interaction.editReply({ embeds: [embed.error('Não consegui expulsar esse membro.')] });
    }

    const caseNumber = await createCase(interaction.guild, {
      type: 'kick',
      user: target,
      moderator: interaction.user,
      reason,
    });

    await interaction.editReply({
      embeds: [
        embed
          .success(`**${target.tag}** foi expulso.`, `👢 Expulsão · Caso #${caseNumber}`)
          .addFields(
            { name: 'Motivo', value: reason },
            { name: 'Aviso por DM', value: notified ? 'entregue' : 'não entregue', inline: true },
          ),
      ],
    });
  },
};
