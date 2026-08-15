import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db, getGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError, truncate } from '../../lib/embeds.js';

export const STATUS = {
  pendente: { label: '⏳ Pendente', color: colors.primary },
  aprovada: { label: '✅ Aprovada', color: colors.success },
  recusada: { label: '❌ Recusada', color: colors.danger },
};

/** Botões de voto. Desabilitados quando a sugestão é decidida. */
export function voteRow(messageId, up = 0, down = 0, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggestion:up:${messageId}`)
      .setEmoji('👍')
      .setLabel(String(up))
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`suggestion:down:${messageId}`)
      .setEmoji('👎')
      .setLabel(String(down))
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

export default {
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName('sugestao')
    .setDescription('Envia e gerencia sugestões para o servidor.')
    .addSubcommand((sub) =>
      sub
        .setName('enviar')
        .setDescription('Envia uma sugestão para o canal configurado.')
        .addStringOption((option) =>
          option
            .setName('texto')
            .setDescription('Sua sugestão')
            .setRequired(true)
            .setMaxLength(1500),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('decidir')
        .setDescription('Aprova ou recusa uma sugestão. (Gerenciar Servidor)')
        .addStringOption((option) =>
          option.setName('mensagem').setDescription('ID da mensagem da sugestão').setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('situacao')
            .setDescription('Nova situação')
            .setRequired(true)
            .addChoices(
              { name: '✅ Aprovar', value: 'aprovada' },
              { name: '❌ Recusar', value: 'recusada' },
            ),
        )
        .addStringOption((option) =>
          option.setName('motivo').setDescription('Justificativa da equipe').setMaxLength(500),
        ),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'enviar') return send(interaction);
    return decide(interaction);
  },
};

async function send(interaction) {
  const settings = getGuildConfig(interaction.guildId);

  if (!settings.suggestion_channel) {
    return replyError(
      interaction,
      'O canal de sugestões ainda não foi configurado. A equipe pode defini-lo com `/configurar sugestões`.',
    );
  }

  const channel = await interaction.guild.channels
    .fetch(settings.suggestion_channel)
    .catch(() => null);

  if (!channel?.isTextBased()) {
    return replyError(interaction, 'O canal de sugestões configurado não existe mais.');
  }

  const text = interaction.options.getString('texto');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const sent = await channel
    .send({
      embeds: [
        embed
          .base(colors.primary)
          .setAuthor({
            name: `Sugestão de ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL({ size: 128 }),
          })
          .setDescription(text)
          .addFields({ name: 'Situação', value: STATUS.pendente.label })
          .setTimestamp(),
      ],
    })
    .catch(() => null);

  if (!sent) return interaction.editReply({ embeds: [embed.error(`Não consigo enviar em ${channel}.`)] });

  // Os botões precisam do ID da mensagem, então editamos logo após enviar.
  await sent.edit({ components: [voteRow(sent.id)] }).catch(() => null);

  db.prepare(
    `INSERT INTO suggestions (message_id, guild_id, channel_id, author_id, content, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(sent.id, interaction.guildId, channel.id, interaction.user.id, text, Date.now());

  await interaction.editReply({
    embeds: [embed.success(`Sugestão enviada em ${channel}. Obrigado!`)],
  });
}

async function decide(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return replyError(interaction, 'Você precisa da permissão **Gerenciar Servidor** para decidir sugestões.');
  }

  const messageId = interaction.options.getString('mensagem').trim();
  const status = interaction.options.getString('situacao');
  const reason = interaction.options.getString('motivo');

  const suggestion = db.prepare('SELECT * FROM suggestions WHERE message_id = ?').get(messageId);

  if (!suggestion) return replyError(interaction, 'Não encontrei uma sugestão com esse ID.');
  if (suggestion.guild_id !== interaction.guildId) {
    return replyError(interaction, 'Essa sugestão pertence a outro servidor.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  db.prepare('UPDATE suggestions SET status = ? WHERE message_id = ?').run(status, messageId);

  const channel = await interaction.guild.channels
    .fetch(suggestion.channel_id)
    .catch(() => null);
  const message = channel?.isTextBased()
    ? await channel.messages.fetch(messageId).catch(() => null)
    : null;

  if (message) {
    const votes = db
      .prepare(
        'SELECT SUM(vote = 1) AS up, SUM(vote = -1) AS down FROM suggestion_votes WHERE message_id = ?',
      )
      .get(messageId);

    const author = await interaction.client.users.fetch(suggestion.author_id).catch(() => null);

    await message
      .edit({
        embeds: [
          embed
            .base(STATUS[status].color)
            .setAuthor({
              name: `Sugestão de ${author?.tag ?? suggestion.author_id}`,
              iconURL: author?.displayAvatarURL({ size: 128 }),
            })
            .setDescription(truncate(suggestion.content, 4000))
            .addFields(
              { name: 'Situação', value: STATUS[status].label, inline: true },
              { name: 'Decidido por', value: `${interaction.user}`, inline: true },
              ...(reason ? [{ name: 'Motivo', value: reason }] : []),
            )
            .setFooter({ text: `👍 ${votes.up ?? 0} · 👎 ${votes.down ?? 0}` })
            .setTimestamp(suggestion.created_at),
        ],
        components: [voteRow(messageId, votes.up ?? 0, votes.down ?? 0, true)],
      })
      .catch(() => null);
  }

  await interaction.editReply({
    embeds: [embed.success(`Sugestão marcada como **${STATUS[status].label}**.`)],
  });
}
