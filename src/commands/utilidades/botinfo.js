import { InteractionContextType, SlashCommandBuilder, version as djsVersion } from 'discord.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';
import { formatDuration, timestamp } from '../../lib/time.js';
import { isEnabled as aiEnabled } from '../../services/ai.js';

export default {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Mostra estatísticas e status do bot.')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction, client) {
    const memory = process.memoryUsage().heapUsed / 1024 / 1024;
    const members = client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0);

    await interaction.reply({
      embeds: [
        embed
          .base(colors.primary)
          .setTitle(`Sobre ${client.user.username}`)
          .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: 'Servidores', value: `${client.guilds.cache.size}`, inline: true },
            { name: 'Membros alcançados', value: members.toLocaleString('pt-BR'), inline: true },
            { name: 'Comandos', value: `${client.commands.size}`, inline: true },
            { name: 'Online há', value: formatDuration(client.uptime), inline: true },
            { name: 'Memória', value: `${memory.toFixed(1)} MB`, inline: true },
            { name: 'Latência', value: `${Math.round(client.ws.ping)}ms`, inline: true },
            { name: 'discord.js', value: `v${djsVersion}`, inline: true },
            { name: 'Node.js', value: process.version, inline: true },
            { name: 'Comando /ia', value: aiEnabled ? 'ativo' : 'desativado', inline: true },
          )
          .setFooter({ text: 'Use /ajuda para ver todos os comandos' })
          .setTimestamp(),
      ],
    });
  },
};
