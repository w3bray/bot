import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { db } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError, truncate } from '../../lib/embeds.js';
import { timestamp } from '../../lib/time.js';
import { quantidade } from '../../lib/portugues.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('avisos')
    .setDescription('Consulta e gerencia as advertências de um membro.')
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Mostra as advertências ativas de um membro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('De quem?').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove uma advertência específica pelo número do caso.')
        .addIntegerOption((option) =>
          option.setName('caso').setDescription('Número do caso').setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('limpar')
        .setDescription('Remove todas as advertências ativas de um membro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('De quem?').setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'listar') return listWarnings(interaction);
    if (subcommand === 'remover') return removeWarning(interaction);
    return clearWarnings(interaction);
  },
};

async function listWarnings(interaction) {
  const target = interaction.options.getUser('usuario');

  const warnings = db
    .prepare(
      `SELECT * FROM cases
       WHERE guild_id = ? AND user_id = ? AND type = 'warn' AND active = 1
       ORDER BY created_at DESC LIMIT 15`,
    )
    .all(interaction.guild.id, target.id);

  if (warnings.length === 0) {
    return interaction.reply({
      embeds: [embed.info(`**${target.tag}** não tem advertências ativas.`)],
    });
  }

  const list = warnings.map(
    (warning) =>
      `**#${warning.case_number}** · ${timestamp(warning.created_at, 'd')} · por <@${warning.moderator_id}>\n> ${truncate(warning.reason ?? 'Sem motivo.', 200)}`,
  );

  await interaction.reply({
    embeds: [
      embed
        .base(colors.warning)
        .setTitle(`⚠️ Advertências de ${target.tag}`)
        .setDescription(list.join('\n\n'))
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .setFooter({ text: quantidade(warnings.length, 'advertência ativa', 'advertências ativas') }),
    ],
  });
}

async function removeWarning(interaction) {
  const caseNumber = interaction.options.getInteger('caso');

  const warning = db
    .prepare(
      "SELECT * FROM cases WHERE guild_id = ? AND case_number = ? AND type = 'warn'",
    )
    .get(interaction.guild.id, caseNumber);

  if (!warning) return replyError(interaction, `Não encontrei a advertência #${caseNumber}.`);
  if (!warning.active) return replyError(interaction, `A advertência #${caseNumber} já foi removida.`);

  db.prepare('UPDATE cases SET active = 0 WHERE id = ?').run(warning.id);

  await interaction.reply({
    embeds: [
      embed.success(
        `Advertência **#${caseNumber}** de <@${warning.user_id}> foi removida.`,
      ),
    ],
  });
}

async function clearWarnings(interaction) {
  const target = interaction.options.getUser('usuario');

  const result = db
    .prepare(
      "UPDATE cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'warn' AND active = 1",
    )
    .run(interaction.guild.id, target.id);

  if (result.changes === 0) {
    return replyError(interaction, `**${target.tag}** não tem advertências ativas.`);
  }

  await interaction.reply({
    embeds: [
      embed.success(`Removi **${quantidade(result.changes, 'advertência')}** de **${target.tag}**.`),
    ],
  });
}
