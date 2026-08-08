import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { db } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError, truncate } from '../../lib/embeds.js';
import { formatDuration, parseDuration, timestamp } from '../../lib/time.js';
import { createReminder, listReminders } from '../../services/scheduler.js';

const MAX_PER_USER = 25;
const MAX_DELAY = 365 * 24 * 60 * 60 * 1000;

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('lembrete')
    .setDescription('Cria lembretes pessoais.')
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Agenda um lembrete.')
        .addStringOption((option) =>
          option
            .setName('tempo')
            .setDescription('Daqui a quanto tempo? Ex.: 30m, 2h, 1d')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('sobre')
            .setDescription('O que devo lembrar?')
            .setRequired(true)
            .setMaxLength(500),
        ),
    )
    .addSubcommand((sub) => sub.setName('listar').setDescription('Mostra seus lembretes pendentes.'))
    .addSubcommand((sub) =>
      sub
        .setName('cancelar')
        .setDescription('Cancela um lembrete pelo número.')
        .addIntegerOption((option) =>
          option.setName('id').setDescription('ID mostrado em /lembrete listar').setRequired(true),
        ),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'criar') return create(interaction);
    if (subcommand === 'listar') return list(interaction);
    return cancel(interaction);
  },
};

async function create(interaction) {
  const delay = parseDuration(interaction.options.getString('tempo'));
  const content = interaction.options.getString('sobre');

  if (!delay) {
    return replyError(interaction, 'Tempo inválido. Use formatos como `30m`, `2h`, `1d` ou `1h30m`.');
  }
  if (delay > MAX_DELAY) {
    return replyError(interaction, 'O prazo máximo de um lembrete é **1 ano**.');
  }

  const pending = listReminders(interaction.user.id).length;
  if (pending >= MAX_PER_USER) {
    return replyError(
      interaction,
      `Você já tem ${MAX_PER_USER} lembretes pendentes. Cancele algum antes de criar outro.`,
    );
  }

  const remindAt = Date.now() + delay;
  const reminder = createReminder({
    userId: interaction.user.id,
    channelId: interaction.channelId,
    guildId: interaction.guildId,
    content,
    remindAt,
  });

  await interaction.reply({
    embeds: [
      embed
        .success(
          `Vou te lembrar ${timestamp(remindAt, 'R')} (${timestamp(remindAt, 'f')}).`,
          '⏰ Lembrete agendado',
        )
        .addFields(
          { name: 'Sobre', value: truncate(content) },
          { name: 'ID', value: `\`${reminder.id}\``, inline: true },
          { name: 'Daqui a', value: formatDuration(delay), inline: true },
        )
        .setFooter({ text: 'Aviso enviado por DM; se estiver fechada, envio aqui no canal.' }),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function list(interaction) {
  const reminders = listReminders(interaction.user.id);

  if (reminders.length === 0) {
    return interaction.reply({
      embeds: [embed.info('Você não tem lembretes pendentes.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.reply({
    embeds: [
      embed
        .base(colors.primary)
        .setTitle('⏰ Seus lembretes')
        .setDescription(
          reminders
            .map(
              (reminder) =>
                `\`#${reminder.id}\` · ${timestamp(reminder.remind_at, 'R')}\n> ${truncate(reminder.content, 150)}`,
            )
            .join('\n\n'),
        )
        .setFooter({ text: 'Cancele com /lembrete cancelar id:<número>' }),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function cancel(interaction) {
  const id = interaction.options.getInteger('id');

  const result = db
    .prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?')
    .run(id, interaction.user.id);

  if (result.changes === 0) {
    return replyError(interaction, `Não encontrei um lembrete seu com o ID \`${id}\`.`);
  }

  await interaction.reply({
    embeds: [embed.success(`Lembrete \`#${id}\` cancelado.`)],
    flags: MessageFlags.Ephemeral,
  });
}
