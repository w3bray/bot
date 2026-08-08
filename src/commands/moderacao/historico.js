import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { db } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError, truncate } from '../../lib/embeds.js';
import { formatDuration, timestamp } from '../../lib/time.js';
import { CASE_LABELS } from '../../services/modcase.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('historico')
    .setDescription('Consulta o histórico de punições.')
    .addSubcommand((sub) =>
      sub
        .setName('usuario')
        .setDescription('Mostra todas as punições de um membro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('De quem?').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('caso')
        .setDescription('Mostra os detalhes de um caso específico.')
        .addIntegerOption((option) =>
          option.setName('numero').setDescription('Número do caso').setRequired(true).setMinValue(1),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'caso') return showCase(interaction);
    return showUser(interaction);
  },
};

async function showUser(interaction) {
  const target = interaction.options.getUser('usuario');

  const entries = db
    .prepare(
      'SELECT * FROM cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 15',
    )
    .all(interaction.guild.id, target.id);

  if (entries.length === 0) {
    return interaction.reply({
      embeds: [embed.info(`**${target.tag}** não tem punições registradas. 🎉`)],
    });
  }

  const counts = db
    .prepare('SELECT type, COUNT(*) AS total FROM cases WHERE guild_id = ? AND user_id = ? GROUP BY type')
    .all(interaction.guild.id, target.id)
    .map((row) => `${CASE_LABELS[row.type]?.label ?? row.type}: **${row.total}**`)
    .join(' · ');

  const list = entries.map((entry) => {
    const meta = CASE_LABELS[entry.type] ?? { label: entry.type, emoji: '📄' };
    const status = entry.type === 'warn' && !entry.active ? ' *(removida)*' : '';
    return `${meta.emoji} **#${entry.case_number} · ${meta.label}**${status} — ${timestamp(entry.created_at, 'd')}\n> ${truncate(entry.reason ?? 'Sem motivo.', 150)}`;
  });

  await interaction.reply({
    embeds: [
      embed
        .base(colors.primary)
        .setTitle(`📋 Histórico de ${target.tag}`)
        .setDescription(list.join('\n'))
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .setFooter({ text: `Mostrando os ${entries.length} casos mais recentes` })
        .addFields({ name: 'Resumo', value: counts }),
    ],
  });
}

async function showCase(interaction) {
  const number = interaction.options.getInteger('numero');

  const entry = db
    .prepare('SELECT * FROM cases WHERE guild_id = ? AND case_number = ?')
    .get(interaction.guild.id, number);

  if (!entry) return replyError(interaction, `O caso #${number} não existe.`);

  const meta = CASE_LABELS[entry.type] ?? { label: entry.type, color: colors.neutral, emoji: '📄' };
  const user = await interaction.client.users.fetch(entry.user_id).catch(() => null);

  const detail = embed
    .base(meta.color)
    .setTitle(`${meta.emoji} Caso #${entry.case_number} · ${meta.label}`)
    .addFields(
      { name: 'Usuário', value: `<@${entry.user_id}> \`${entry.user_id}\``, inline: true },
      { name: 'Moderador', value: `<@${entry.moderator_id}>`, inline: true },
      { name: 'Data', value: timestamp(entry.created_at, 'f'), inline: true },
      { name: 'Motivo', value: truncate(entry.reason ?? 'Sem motivo informado.') },
    )
    .setTimestamp(entry.created_at);

  if (entry.duration) {
    detail.addFields({ name: 'Duração', value: formatDuration(entry.duration), inline: true });
  }
  if (entry.type === 'warn') {
    detail.addFields({
      name: 'Status',
      value: entry.active ? 'ativa' : 'removida',
      inline: true,
    });
  }
  if (user) detail.setThumbnail(user.displayAvatarURL({ size: 128 }));

  await interaction.reply({ embeds: [detail] });
}
