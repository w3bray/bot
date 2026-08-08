import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { db, getGuildConfig } from '../lib/db.js';
import { colors, emojis } from '../config.js';
import { embed } from '../lib/embeds.js';
import { sendToLog } from './modcase.js';
import { timestamp } from '../lib/time.js';

const insertTicket = db.prepare(`
  INSERT INTO tickets (channel_id, guild_id, user_id, number, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
const selectByChannel = db.prepare('SELECT * FROM tickets WHERE channel_id = ?');
const selectOpenByUser = db.prepare(
  'SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND open = 1',
);

/** Botões que aparecem dentro de um ticket aberto. */
export function ticketControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:claim')
      .setLabel('Assumir')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Fechar')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
  );
}

export function getTicket(channelId) {
  return selectByChannel.get(channelId);
}

/**
 * Cria o canal do ticket com permissões só para o autor e a equipe.
 * Retorna { ok, channel } ou { ok: false, reason }.
 */
export async function openTicket(guild, user, subject) {
  const settings = getGuildConfig(guild.id);

  const existing = selectOpenByUser.get(guild.id, user.id);
  if (existing) {
    const channel = await guild.channels.fetch(existing.channel_id).catch(() => null);
    if (channel) return { ok: false, reason: `Você já tem um ticket aberto: ${channel}` };
    // O canal foi apagado manualmente: libera o registro órfão.
    db.prepare('UPDATE tickets SET open = 0 WHERE channel_id = ?').run(existing.channel_id);
  }

  const number = settings.ticket_counter + 1;
  db.prepare('UPDATE guilds SET ticket_counter = ? WHERE guild_id = ?').run(number, guild.id);

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  if (settings.ticket_role && guild.roles.cache.has(settings.ticket_role)) {
    overwrites.push({
      id: settings.ticket_role,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: `ticket-${String(number).padStart(4, '0')}`,
    type: ChannelType.GuildText,
    parent: settings.ticket_category ?? null,
    topic: `Ticket de ${user.tag} (${user.id})`,
    permissionOverwrites: overwrites,
  });

  insertTicket.run(channel.id, guild.id, user.id, number, Date.now());

  const welcome = embed
    .base(colors.primary)
    .setTitle(`${emojis.ticket} Ticket #${String(number).padStart(4, '0')}`)
    .setDescription(
      [
        `Olá ${user}, obrigado por abrir um ticket.`,
        'Descreva sua situação com detalhes — a equipe responderá assim que possível.',
        '',
        subject ? `**Assunto:** ${subject}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setTimestamp();

  await channel.send({
    content: settings.ticket_role ? `<@&${settings.ticket_role}>` : null,
    embeds: [welcome],
    components: [ticketControls()],
  });

  return { ok: true, channel, number };
}

/**
 * Fecha o ticket: gera a transcrição, envia para o log e apaga o canal.
 */
export async function closeTicket(channel, closedBy) {
  const ticket = selectByChannel.get(channel.id);
  if (!ticket) return { ok: false, reason: 'Este canal não é um ticket.' };

  db.prepare('UPDATE tickets SET open = 0 WHERE channel_id = ?').run(channel.id);

  const settings = getGuildConfig(channel.guild.id);
  const transcript = await buildTranscript(channel, ticket);

  const logEmbed = embed
    .base(colors.neutral)
    .setTitle(`${emojis.ticket} Ticket #${String(ticket.number).padStart(4, '0')} fechado`)
    .addFields(
      { name: 'Aberto por', value: `<@${ticket.user_id}>`, inline: true },
      { name: 'Fechado por', value: `${closedBy}`, inline: true },
      { name: 'Aberto em', value: timestamp(ticket.created_at, 'f'), inline: true },
    )
    .setTimestamp();

  if (settings.ticket_log) {
    const logChannel = await channel.guild.channels
      .fetch(settings.ticket_log)
      .catch(() => null);
    if (logChannel?.isTextBased()) {
      await logChannel.send({ embeds: [logEmbed], files: [transcript] }).catch(() => null);
    }
  } else {
    await sendToLog(channel.guild, settings.mod_log_channel, logEmbed);
  }

  // Envia a transcrição por DM para quem abriu o ticket.
  const author = await channel.client.users.fetch(ticket.user_id).catch(() => null);
  if (author) {
    await author
      .send({
        embeds: [
          embed.info(
            `Seu ticket **#${String(ticket.number).padStart(4, '0')}** em **${channel.guild.name}** foi fechado. A transcrição está anexada.`,
          ),
        ],
        files: [await buildTranscript(channel, ticket)],
      })
      .catch(() => null);
  }

  return { ok: true };
}

async function buildTranscript(channel, ticket) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const lines = [
    `Transcrição do ticket #${String(ticket.number).padStart(4, '0')}`,
    `Servidor: ${channel.guild.name}`,
    `Canal: #${channel.name}`,
    `Aberto por: ${ticket.user_id}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '='.repeat(60),
    '',
  ];

  if (messages) {
    const ordered = [...messages.values()].reverse();
    for (const message of ordered) {
      const time = new Date(message.createdTimestamp).toLocaleString('pt-BR');
      const attachments = message.attachments.map((a) => a.url).join(' ');
      lines.push(`[${time}] ${message.author.tag}: ${message.content || ''} ${attachments}`.trim());
    }
  }

  return new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), {
    name: `ticket-${String(ticket.number).padStart(4, '0')}.txt`,
  });
}
