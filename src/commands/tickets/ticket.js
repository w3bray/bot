import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getGuildConfig } from '../../lib/db.js';
import { colors, emojis } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { closeTicket, getTicket, openTicket } from '../../services/tickets.js';

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Sistema de atendimento por tickets.')
    .addSubcommand((sub) =>
      sub
        .setName('abrir')
        .setDescription('Abre um ticket de atendimento.')
        .addStringOption((option) =>
          option.setName('assunto').setDescription('Resumo do seu problema').setMaxLength(200),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('fechar').setDescription('Fecha o ticket atual (use dentro do canal do ticket).'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('adicionar')
        .setDescription('Adiciona um membro ao ticket atual.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('Quem adicionar').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('painel')
        .setDescription('Publica o painel com o botão de abrir ticket. (Gerenciar Servidor)')
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Onde publicar o painel (padrão: canal atual)')
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((option) =>
          option.setName('titulo').setDescription('Título do painel').setMaxLength(200),
        )
        .addStringOption((option) =>
          option.setName('descricao').setDescription('Texto do painel').setMaxLength(2000),
        ),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'abrir') return open(interaction);
    if (subcommand === 'fechar') return close(interaction);
    if (subcommand === 'adicionar') return addMember(interaction);
    return publishPanel(interaction);
  },
};

async function open(interaction) {
  const subject = interaction.options.getString('assunto');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await openTicket(interaction.guild, interaction.user, subject).catch(() => ({
    ok: false,
    reason: 'Não consegui criar o canal. Verifique se tenho a permissão **Gerenciar Canais**.',
  }));

  if (!result.ok) return interaction.editReply({ embeds: [embed.error(result.reason)] });

  await interaction.editReply({
    embeds: [embed.success(`Seu ticket foi criado: ${result.channel}`)],
  });
}

async function close(interaction) {
  const ticket = getTicket(interaction.channelId);
  if (!ticket) return replyError(interaction, 'Este comando só funciona dentro de um canal de ticket.');

  const settings = getGuildConfig(interaction.guildId);
  const isStaff =
    interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    (settings.ticket_role && interaction.member.roles.cache.has(settings.ticket_role));

  if (ticket.user_id !== interaction.user.id && !isStaff) {
    return replyError(interaction, 'Só quem abriu o ticket ou a equipe pode fechá-lo.');
  }

  await interaction.reply({
    embeds: [embed.warning('Fechando o ticket em 5 segundos… A transcrição será enviada.')],
  });

  await closeTicket(interaction.channel, interaction.user);
  setTimeout(() => interaction.channel.delete().catch(() => null), 5000);
}

async function addMember(interaction) {
  const ticket = getTicket(interaction.channelId);
  if (!ticket) return replyError(interaction, 'Este comando só funciona dentro de um canal de ticket.');

  const target = interaction.options.getUser('usuario');
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return replyError(interaction, 'Esse usuário não está no servidor.');

  try {
    await interaction.channel.permissionOverwrites.edit(target.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
  } catch {
    return replyError(interaction, 'Não consegui alterar as permissões deste canal.');
  }

  await interaction.reply({
    embeds: [embed.success(`${target} foi adicionado ao ticket.`)],
  });
}

async function publishPanel(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return replyError(interaction, 'Você precisa da permissão **Gerenciar Servidor** para publicar o painel.');
  }

  const channel = interaction.options.getChannel('canal') ?? interaction.channel;
  const title = interaction.options.getString('titulo') ?? `${emojis.ticket} Central de Atendimento`;
  const description =
    interaction.options.getString('descricao') ??
    'Precisa de ajuda? Clique no botão abaixo para abrir um ticket privado com a equipe.';

  const panel = embed
    .base(colors.primary)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'Abuso do sistema de tickets pode resultar em punição.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:create')
      .setLabel('Abrir ticket')
      .setEmoji(emojis.ticket)
      .setStyle(ButtonStyle.Primary),
  );

  const sent = await channel.send({ embeds: [panel], components: [row] }).catch(() => null);
  if (!sent) return replyError(interaction, `Não consegui enviar mensagens em ${channel}.`);

  await interaction.reply({
    embeds: [embed.success(`Painel publicado em ${channel}.`)],
    flags: MessageFlags.Ephemeral,
  });
}
