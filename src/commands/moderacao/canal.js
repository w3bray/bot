import {
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatDuration, parseDuration } from '../../lib/time.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('canal')
    .setDescription('Controla o canal: trancar, destrancar e modo lento.')
    .addSubcommand((sub) =>
      sub
        .setName('trancar')
        .setDescription('Impede que @everyone envie mensagens no canal.')
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal a trancar (padrão: o atual)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        )
        .addStringOption((option) =>
          option.setName('motivo').setDescription('Motivo').setMaxLength(400),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('destrancar')
        .setDescription('Devolve a permissão de enviar mensagens.')
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal a destrancar (padrão: o atual)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('lento')
        .setDescription('Define o modo lento do canal.')
        .addStringOption((option) =>
          option
            .setName('tempo')
            .setDescription('Ex.: 5s, 30s, 2m, 1h. Use 0 para desativar (máximo 6h)')
            .setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'lento') return setSlowmode(interaction);
    return toggleLock(interaction, subcommand === 'trancar');
  },
};

async function toggleLock(interaction, lock) {
  const channel = interaction.options.getChannel('canal') ?? interaction.channel;
  const reason = interaction.options.getString('motivo') ?? 'Sem motivo informado.';

  if (!channel.manageable) {
    return replyError(interaction, `Não tenho permissão para gerenciar ${channel}.`);
  }

  await interaction.deferReply();

  try {
    await channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      { SendMessages: lock ? false : null },
      { reason: `${interaction.user.tag}: ${reason}` },
    );
  } catch {
    return interaction.editReply({
      embeds: [embed.error('Não consegui alterar as permissões desse canal.')],
    });
  }

  const description = lock
    ? `${channel} foi trancado.\n**Motivo:** ${reason}`
    : `${channel} foi destrancado.`;

  await interaction.editReply({
    embeds: [embed.success(description, lock ? '🔒 Canal trancado' : '🔓 Canal destrancado')],
  });

  // Avisa no próprio canal quando o comando foi usado de outro lugar.
  if (channel.id !== interaction.channel.id) {
    await channel.send({ embeds: [embed.warning(description)] }).catch(() => null);
  }
}

async function setSlowmode(interaction) {
  const input = interaction.options.getString('tempo');
  const seconds = input === '0' ? 0 : Math.floor((parseDuration(input) ?? -1) / 1000);

  if (seconds < 0) {
    return replyError(interaction, 'Tempo inválido. Use `5s`, `30s`, `2m`, `1h` ou `0`.');
  }
  if (seconds > 21_600) {
    return replyError(interaction, 'O modo lento pode ser de no máximo **6 horas**.');
  }

  try {
    await interaction.channel.setRateLimitPerUser(seconds, `Definido por ${interaction.user.tag}`);
  } catch {
    return replyError(interaction, 'Não consegui alterar o modo lento deste canal.');
  }

  await interaction.reply({
    embeds: [
      embed.success(
        seconds === 0
          ? 'Modo lento **desativado** neste canal.'
          : `Modo lento definido para **${formatDuration(seconds * 1000)}** por mensagem.`,
      ),
    ],
  });
}
