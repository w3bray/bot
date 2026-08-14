import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { embed, replyError } from '../../lib/embeds.js';
import { checkHierarchy } from '../../lib/permissions.js';
import { createCase, notifyUser } from '../../services/modcase.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('banir')
    .setDescription('Bane um membro do servidor.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Quem será banido').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('motivo').setDescription('Motivo do banimento').setMaxLength(400),
    )
    .addIntegerOption((option) =>
      option
        .setName('apagar-dias')
        .setDescription('Apagar mensagens recentes desse usuário (0 a 7 dias)')
        .setMinValue(0)
        .setMaxValue(7),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const target = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo') ?? 'Sem motivo informado.';
    const deleteDays = interaction.options.getInteger('apagar-dias') ?? 0;

    const existingBan = await interaction.guild.bans.fetch(target.id).catch(() => null);
    if (existingBan) return replyError(interaction, 'Esse usuário já está banido.');

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (member) {
      const problem = checkHierarchy(interaction.member, member, interaction.guild.members.me);
      if (problem) return replyError(interaction, problem);
      if (!member.bannable) return replyError(interaction, 'Não tenho permissão para banir esse membro.');
    }

    await interaction.deferReply();

    // A DM precisa sair antes do ban: depois o bot perde o canal compartilhado.
    const notified = member
      ? await notifyUser(target, interaction.guild, { type: 'ban', reason })
      : false;

    try {
      await interaction.guild.bans.create(target.id, {
        reason: `${interaction.user.tag}: ${reason}`,
        deleteMessageSeconds: deleteDays * 86_400,
      });
    } catch {
      return interaction.editReply({
        embeds: [embed.error('Não consegui banir esse usuário. Verifique minhas permissões.')],
      });
    }

    const caseNumber = await createCase(interaction.guild, {
      type: 'ban',
      user: target,
      moderator: interaction.user,
      reason,
    });

    await interaction.editReply({
      embeds: [
        embed
          .success(`**${target.tag}** foi banido.`, `🔨 Banimento · Caso #${caseNumber}`)
          .addFields(
            { name: 'Motivo', value: reason },
            {
              name: 'Mensagem direta',
              value: notified
                ? 'Entregue.'
                : 'Não entregue (mensagens diretas fechadas ou usuário fora do servidor).',
              inline: true,
            },
          ),
      ],
    });
  },
};
