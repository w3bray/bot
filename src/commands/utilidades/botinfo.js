import { InteractionContextType, SlashCommandBuilder, version as djsVersion } from 'discord.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';
import { formatDuration } from '../../lib/time.js';
import { shardInfo, totalGuilds, totalMembers } from '../../lib/shard.js';
import { isEnabled as aiEnabled } from '../../services/ai.js';
import {
  galleryDlVersion,
  isEnabled as downloadEnabled,
  ytdlpVersion,
} from '../../services/downloader.js';

export default {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Mostra estatísticas e status do bot.')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction, client) {
    await interaction.deferReply();

    const memory = process.memoryUsage().heapUsed / 1024 / 1024;
    const { sharded, ids, count } = shardInfo(client);

    // Estes números somam todos os shards; `partial` indica que algum shard
    // ainda não respondeu e o valor mostrado é só o deste processo.
    const guilds = await totalGuilds(client);
    const members = await totalMembers(client);
    const suffix = (result) => (result.partial ? ' *(parcial)*' : '');

    const info = embed
      .base(colors.primary)
      .setTitle(`Sobre ${client.user.username}`)
      .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Servidores', value: `${guilds.total}${suffix(guilds)}`, inline: true },
        {
          name: 'Membros alcançados',
          value: `${members.total.toLocaleString('pt-BR')}${suffix(members)}`,
          inline: true,
        },
        { name: 'Comandos', value: `${client.commands.size}`, inline: true },
        { name: 'Online há', value: formatDuration(client.uptime), inline: true },
        { name: 'Memória (deste shard)', value: `${memory.toFixed(1)} MB`, inline: true },
        { name: 'Latência', value: `${Math.round(client.ws.ping)}ms`, inline: true },
        {
          name: 'Sharding',
          value: sharded
            ? `shard **${ids.join(', ')}** de **${count}**\neste servidor está no shard ${ids[0]}`
            : 'desativado (processo único)',
          inline: true,
        },
        { name: 'discord.js', value: `v${djsVersion}`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        {
          name: 'Recursos opcionais',
          value: [
            `\`/ia\`: ${aiEnabled ? 'ativo' : 'desativado'}`,
            `\`/baixar\`: ${
              downloadEnabled
                ? `ativo (yt-dlp ${ytdlpVersion ?? 'indisponível'} · gallery-dl ${galleryDlVersion ?? 'indisponível'})`
                : 'desativado'
            }`,
          ].join('\n'),
        },
      )
      .setFooter({ text: 'Use /ajuda para ver todos os comandos' })
      .setTimestamp();

    await interaction.editReply({ embeds: [info] });
  },
};
