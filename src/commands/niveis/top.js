import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';
import { getLeaderboard } from '../../services/leveling.js';
import { getRichest, formatMoney } from '../../services/economy.js';
import { getGuildConfig } from '../../lib/db.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export default {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Mostra os rankings do servidor.')
    .addSubcommand((sub) =>
      sub.setName('niveis').setDescription('Ranking de XP e níveis.'),
    )
    .addSubcommand((sub) =>
      sub.setName('moedas').setDescription('Ranking de patrimônio da economia.'),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    await interaction.deferReply();

    if (interaction.options.getSubcommand() === 'moedas') return showRichest(interaction);
    return showLevels(interaction);
  },
};

async function showLevels(interaction) {
  const rows = getLeaderboard(interaction.guildId, 10);

  if (rows.length === 0) {
    return interaction.editReply({
      embeds: [embed.info('Ninguém tem XP neste servidor ainda.')],
    });
  }

  const lines = await Promise.all(
    rows.map(async (row, index) => {
      const user = await interaction.client.users.fetch(row.user_id).catch(() => null);
      const name = user ? user.tag : `Usuário desconhecido (${row.user_id})`;
      const prefix = MEDALS[index] ?? `\`#${String(index + 1).padStart(2, ' ')}\``;
      return `${prefix} **${name}** — nível **${row.level}** · ${row.xp.toLocaleString('pt-BR')} XP`;
    }),
  );

  await interaction.editReply({
    embeds: [
      embed
        .base(colors.level)
        .setTitle(`📈 Ranking de níveis · ${interaction.guild.name}`)
        .setDescription(lines.join('\n'))
        .setThumbnail(interaction.guild.iconURL({ size: 256 }))
        .setFooter({ text: 'Use /rank para ver sua posição detalhada.' }),
    ],
  });
}

async function showRichest(interaction) {
  const settings = getGuildConfig(interaction.guildId);
  const rows = getRichest(interaction.guildId, 10);

  if (rows.length === 0) {
    return interaction.editReply({
      embeds: [embed.info('Ninguém tem moedas neste servidor ainda. Use `/daily` para começar!')],
    });
  }

  const lines = await Promise.all(
    rows.map(async (row, index) => {
      const user = await interaction.client.users.fetch(row.user_id).catch(() => null);
      const name = user ? user.tag : `Usuário desconhecido (${row.user_id})`;
      const prefix = MEDALS[index] ?? `\`#${String(index + 1).padStart(2, ' ')}\``;
      return `${prefix} **${name}** — ${formatMoney(row.total, settings.currency_name)}`;
    }),
  );

  await interaction.editReply({
    embeds: [
      embed
        .base(colors.economy)
        .setTitle(`🪙 Ranking de riqueza · ${interaction.guild.name}`)
        .setDescription(lines.join('\n'))
        .setThumbnail(interaction.guild.iconURL({ size: 256 }))
        .setFooter({ text: 'Carteira + banco.' }),
    ],
  });
}
