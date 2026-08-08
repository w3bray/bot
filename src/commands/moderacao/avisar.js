import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { db } from '../../lib/db.js';
import { embed, replyError } from '../../lib/embeds.js';
import { checkHierarchy } from '../../lib/permissions.js';
import { createCase, notifyUser } from '../../services/modcase.js';

// Punições automáticas por acúmulo de advertências ativas.
const ESCALATION = {
  3: { action: 'timeout', duration: 60 * 60 * 1000, label: 'castigo de 1 hora' },
  5: { action: 'timeout', duration: 24 * 60 * 60 * 1000, label: 'castigo de 1 dia' },
  7: { action: 'kick', label: 'expulsão' },
};

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('avisar')
    .setDescription('Aplica uma advertência a um membro.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Quem será advertido').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo da advertência')
        .setRequired(true)
        .setMaxLength(400),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const target = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('motivo');

    if (target.bot) return replyError(interaction, 'Não é possível advertir bots.');

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return replyError(interaction, 'Esse usuário não está no servidor.');

    const problem = checkHierarchy(interaction.member, member, interaction.guild.members.me);
    if (problem) return replyError(interaction, problem);

    await interaction.deferReply();

    const caseNumber = await createCase(interaction.guild, {
      type: 'warn',
      user: target,
      moderator: interaction.user,
      reason,
    });

    const total = db
      .prepare(
        "SELECT COUNT(*) AS total FROM cases WHERE guild_id = ? AND user_id = ? AND type = 'warn' AND active = 1",
      )
      .get(interaction.guild.id, target.id).total;

    await notifyUser(target, interaction.guild, { type: 'warn', reason });

    const escalation = ESCALATION[total];
    let escalationNote = null;

    if (escalation) {
      escalationNote = await applyEscalation(interaction, member, escalation, total);
    }

    await interaction.editReply({
      embeds: [
        embed
          .warning(
            `**${target.tag}** recebeu uma advertência.`,
            `⚠️ Advertência · Caso #${caseNumber}`,
          )
          .addFields(
            { name: 'Motivo', value: reason },
            { name: 'Total de advertências ativas', value: String(total), inline: true },
            ...(escalationNote ? [{ name: 'Punição automática', value: escalationNote }] : []),
          ),
      ],
    });
  },
};

async function applyEscalation(interaction, member, escalation, total) {
  const reason = `Punição automática ao atingir ${total} advertências`;

  try {
    if (escalation.action === 'timeout' && member.moderatable) {
      await member.timeout(escalation.duration, reason);
    } else if (escalation.action === 'kick' && member.kickable) {
      await member.kick(reason);
    } else {
      return `${escalation.label} não aplicada — sem permissão sobre esse membro.`;
    }
  } catch {
    return `${escalation.label} falhou por falta de permissão.`;
  }

  await createCase(interaction.guild, {
    type: escalation.action === 'kick' ? 'kick' : 'timeout',
    user: member.user,
    moderator: interaction.client.user,
    reason,
    duration: escalation.duration ?? null,
  });

  return `Aplicada automaticamente: **${escalation.label}**.`;
}
