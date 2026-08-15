import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatDuration } from '../../lib/time.js';
import { getTopReputation, giveReputation } from '../../services/profiles.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('reputacao')
    .setDescription('Dá um ponto de reputação para alguém (uma vez a cada 12 horas).')
    .addSubcommand((sub) =>
      sub
        .setName('dar')
        .setDescription('Dá reputação a um membro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('Quem merece?').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('ranking').setDescription('Mostra o ranking de reputação do servidor.'),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'ranking') return showTop(interaction);

    const target = interaction.options.getUser('usuario');

    if (target.id === interaction.user.id) {
      return replyError(interaction, 'Dar reputação para si mesmo não vale.');
    }
    if (target.bot) return replyError(interaction, 'Bots não têm reputação.');

    const result = giveReputation(interaction.guildId, interaction.user.id, target.id);

    if (!result.ok) {
      return replyError(
        interaction,
        `Você já deu reputação recentemente. Tente de novo em **${formatDuration(result.remaining)}**.`,
      );
    }

    await interaction.reply({
      embeds: [
        embed.success(
          `${interaction.user} deu +1 de reputação para ${target}!\nAgora ${target} tem **${result.total} ${result.total === 1 ? 'ponto' : 'pontos'}**.`,
        ),
      ],
    });
  },
};

async function showTop(interaction) {
  const rows = getTopReputation(interaction.guildId, 10);

  if (rows.length === 0) {
    return interaction.reply({
      embeds: [embed.info('Ninguém recebeu reputação ainda. Use `/reputação dar` para começar.')],
    });
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = await Promise.all(
    rows.map(async (row, index) => {
      const user = await interaction.client.users.fetch(row.user_id).catch(() => null);
      const prefix = medals[index] ?? `\`#${String(index + 1).padStart(2, ' ')}\``;
      return `${prefix} **${user ? user.tag : row.user_id}** — ${row.reputation} ${row.reputation === 1 ? 'ponto' : 'pontos'}`;
    }),
  );

  await interaction.reply({
    embeds: [
      embed
        .base(colors.primary)
        .setTitle(`⭐ Ranking de reputação · ${interaction.guild.name}`)
        .setDescription(lines.join('\n')),
    ],
  });
}
