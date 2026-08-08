import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { embed, replyError } from '../../lib/embeds.js';
import { checkHierarchy } from '../../lib/permissions.js';
import { createCase, notifyUser } from '../../services/modcase.js';
import { formatDuration, parseDuration, timestamp } from '../../lib/time.js';

// Limite imposto pela API do Discord para timeouts.
const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000;

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('castigo')
    .setDescription('Aplica ou remove o castigo (timeout) de um membro.')
    .addSubcommand((sub) =>
      sub
        .setName('aplicar')
        .setDescription('Silencia um membro por um período.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('Quem será castigado').setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('tempo')
            .setDescription('Duração: 10m, 2h, 1d… (máximo 28 dias)')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option.setName('motivo').setDescription('Motivo do castigo').setMaxLength(400),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove o castigo de um membro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('Quem será liberado').setRequired(true),
        )
        .addStringOption((option) =>
          option.setName('motivo').setDescription('Motivo da remoção').setMaxLength(400),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const target = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo') ?? 'Sem motivo informado.';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return replyError(interaction, 'Esse usuário não está no servidor.');

    const problem = checkHierarchy(interaction.member, member, interaction.guild.members.me);
    if (problem) return replyError(interaction, problem);
    if (!member.moderatable) {
      return replyError(interaction, 'Não tenho permissão para castigar esse membro.');
    }

    if (subcommand === 'remover') return removeTimeout(interaction, member, reason);
    return applyTimeout(interaction, member, reason);
  },
};

async function applyTimeout(interaction, member, reason) {
  const duration = parseDuration(interaction.options.getString('tempo'));

  if (!duration) {
    return replyError(
      interaction,
      'Duração inválida. Use formatos como `10m`, `2h`, `1d` ou `1h30m`.',
    );
  }
  if (duration > MAX_TIMEOUT) {
    return replyError(interaction, 'O Discord permite castigos de no máximo **28 dias**.');
  }

  await interaction.deferReply();
  const notified = await notifyUser(member.user, interaction.guild, {
    type: 'timeout',
    reason,
    duration,
  });

  try {
    await member.timeout(duration, `${interaction.user.tag}: ${reason}`);
  } catch {
    return interaction.editReply({ embeds: [embed.error('Não consegui castigar esse membro.')] });
  }

  const caseNumber = await createCase(interaction.guild, {
    type: 'timeout',
    user: member.user,
    moderator: interaction.user,
    reason,
    duration,
  });

  await interaction.editReply({
    embeds: [
      embed
        .success(
          `**${member.user.tag}** ficará em silêncio por **${formatDuration(duration)}**.`,
          `🔇 Castigo · Caso #${caseNumber}`,
        )
        .addFields(
          { name: 'Motivo', value: reason },
          { name: 'Expira', value: timestamp(Date.now() + duration, 'R'), inline: true },
          { name: 'Aviso por DM', value: notified ? 'entregue' : 'não entregue', inline: true },
        ),
    ],
  });
}

async function removeTimeout(interaction, member, reason) {
  if (!member.isCommunicationDisabled()) {
    return replyError(interaction, 'Esse membro não está de castigo.');
  }

  await interaction.deferReply();

  try {
    await member.timeout(null, `${interaction.user.tag}: ${reason}`);
  } catch {
    return interaction.editReply({ embeds: [embed.error('Não consegui remover o castigo.')] });
  }

  const caseNumber = await createCase(interaction.guild, {
    type: 'untimeout',
    user: member.user,
    moderator: interaction.user,
    reason,
  });

  await interaction.editReply({
    embeds: [
      embed.success(
        `O castigo de **${member.user.tag}** foi removido.`,
        `🔊 Castigo removido · Caso #${caseNumber}`,
      ),
    ],
  });
}
