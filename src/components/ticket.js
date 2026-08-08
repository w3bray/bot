import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { db, getGuildConfig } from '../lib/db.js';
import { embed } from '../lib/embeds.js';
import { closeTicket, getTicket, openTicket, ticketControls } from '../services/tickets.js';

export default {
  id: 'ticket',

  async execute(interaction, { action }) {
    if (action === 'create') return create(interaction);
    if (action === 'claim') return claim(interaction);
    if (action === 'close') return close(interaction);
  },
};

async function create(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await openTicket(interaction.guild, interaction.user, null).catch(() => ({
    ok: false,
    reason: 'Não consegui criar o canal. Avise a equipe: falta a permissão **Gerenciar Canais**.',
  }));

  if (!result.ok) return interaction.editReply({ embeds: [embed.error(result.reason)] });

  await interaction.editReply({
    embeds: [embed.success(`Seu ticket foi criado: ${result.channel}`)],
  });
}

async function claim(interaction) {
  const ticket = getTicket(interaction.channelId);
  if (!ticket) {
    return interaction.reply({
      embeds: [embed.error('Este canal não é um ticket ativo.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  const settings = getGuildConfig(interaction.guildId);
  const isStaff =
    interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    (settings.ticket_role && interaction.member.roles.cache.has(settings.ticket_role));

  if (!isStaff) {
    return interaction.reply({
      embeds: [embed.error('Apenas a equipe de atendimento pode assumir tickets.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (ticket.claimed_by) {
    return interaction.reply({
      embeds: [embed.warning(`Este ticket já foi assumido por <@${ticket.claimed_by}>.`)],
      flags: MessageFlags.Ephemeral,
    });
  }

  db.prepare('UPDATE tickets SET claimed_by = ? WHERE channel_id = ?').run(
    interaction.user.id,
    interaction.channelId,
  );

  await interaction.reply({
    embeds: [embed.success(`${interaction.user} assumiu este atendimento.`)],
  });
}

async function close(interaction) {
  const ticket = getTicket(interaction.channelId);
  if (!ticket) {
    return interaction.reply({
      embeds: [embed.error('Este canal não é um ticket ativo.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  const settings = getGuildConfig(interaction.guildId);
  const isStaff =
    interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    (settings.ticket_role && interaction.member.roles.cache.has(settings.ticket_role));

  if (ticket.user_id !== interaction.user.id && !isStaff) {
    return interaction.reply({
      embeds: [embed.error('Só quem abriu o ticket ou a equipe pode fechá-lo.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  // Desabilita os botões para evitar cliques duplos durante o fechamento.
  const disabled = ticketControls();
  for (const button of disabled.components) button.setDisabled(true);
  await interaction.update({ components: [disabled] }).catch(() => null);

  await interaction.followUp({
    embeds: [
      embed.warning(
        `Ticket fechado por ${interaction.user}. O canal será apagado em 5 segundos e a transcrição enviada.`,
      ),
    ],
  });

  await closeTicket(interaction.channel, interaction.user);
  setTimeout(() => interaction.channel.delete().catch(() => null), 5000);
}
