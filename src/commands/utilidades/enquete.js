import {
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../../lib/db.js';
import { replyError } from '../../lib/embeds.js';
import { parseDuration } from '../../lib/time.js';
import { pollEmbed, pollRow } from '../../services/polls.js';

const MAX_DURATION = 30 * 24 * 60 * 60 * 1000;

export default {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('enquete')
    .setDescription('Cria uma enquete com botões e barra de resultados ao vivo.')
    .addStringOption((option) =>
      option
        .setName('pergunta')
        .setDescription('A pergunta da enquete')
        .setRequired(true)
        .setMaxLength(200),
    )
    .addStringOption((option) =>
      option.setName('opcao1').setDescription('Primeira opção').setRequired(true).setMaxLength(80),
    )
    .addStringOption((option) =>
      option.setName('opcao2').setDescription('Segunda opção').setRequired(true).setMaxLength(80),
    )
    .addStringOption((option) =>
      option.setName('opcao3').setDescription('Terceira opção').setMaxLength(80),
    )
    .addStringOption((option) =>
      option.setName('opcao4').setDescription('Quarta opção').setMaxLength(80),
    )
    .addStringOption((option) =>
      option.setName('opcao5').setDescription('Quinta opção').setMaxLength(80),
    )
    .addStringOption((option) =>
      option.setName('duracao').setDescription('Duração da enquete, ex.: 1h, 2d (máximo 30 dias)'),
    )
    .addBooleanOption((option) =>
      option.setName('multipla').setDescription('Permitir votar em mais de uma opção'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const question = interaction.options.getString('pergunta');
    const multi = interaction.options.getBoolean('multipla') ?? false;
    const rawDuration = interaction.options.getString('duracao');

    const options = [1, 2, 3, 4, 5]
      .map((index) => interaction.options.getString(`opcao${index}`))
      .filter(Boolean);

    let endsAt = null;
    if (rawDuration) {
      const duration = parseDuration(rawDuration);
      if (!duration) return replyError(interaction, 'Duração inválida. Use `1h`, `2d`, `30m`…');
      if (duration > MAX_DURATION) {
        return replyError(interaction, 'A duração máxima de uma enquete é **30 dias**.');
      }
      endsAt = Date.now() + duration;
    }

    await interaction.deferReply();
    const message = await interaction.fetchReply();

    const poll = {
      message_id: message.id,
      guild_id: interaction.guildId,
      channel_id: interaction.channelId,
      author_id: interaction.user.id,
      question,
      options: JSON.stringify(options),
      multi: multi ? 1 : 0,
      ends_at: endsAt,
      ended: 0,
    };

    db.prepare(
      `INSERT INTO polls (message_id, guild_id, channel_id, author_id, question, options, multi, ends_at)
       VALUES (@message_id, @guild_id, @channel_id, @author_id, @question, @options, @multi, @ends_at)`,
    ).run(poll);

    await interaction.editReply({
      embeds: [pollEmbed(poll)],
      components: [pollRow(message.id, options)],
    });
  },
};
