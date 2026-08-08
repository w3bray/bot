import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../../lib/db.js';
import { embed, replyError } from '../../lib/embeds.js';
import { parseDuration } from '../../lib/time.js';
import { endGiveaway, giveawayEmbed, giveawayRow } from '../../services/giveaways.js';

const MAX_DURATION = 60 * 24 * 60 * 60 * 1000;

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('sorteio')
    .setDescription('Cria e gerencia sorteios.')
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Inicia um novo sorteio.')
        .addStringOption((option) =>
          option
            .setName('premio')
            .setDescription('O que está sendo sorteado')
            .setRequired(true)
            .setMaxLength(200),
        )
        .addStringOption((option) =>
          option
            .setName('duracao')
            .setDescription('Quanto tempo dura: 1h, 2d, 30m… (máximo 60 dias)')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('ganhadores')
            .setDescription('Quantos ganhadores (padrão: 1)')
            .setMinValue(1)
            .setMaxValue(20),
        )
        .addRoleOption((option) =>
          option.setName('cargo').setDescription('Exigir um cargo para participar'),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('encerrar')
        .setDescription('Encerra um sorteio antes da hora.')
        .addStringOption((option) =>
          option.setName('mensagem').setDescription('ID da mensagem do sorteio').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('resortear')
        .setDescription('Sorteia novos ganhadores de um sorteio já encerrado.')
        .addStringOption((option) =>
          option.setName('mensagem').setDescription('ID da mensagem do sorteio').setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'criar') return create(interaction);
    return finish(interaction, client, subcommand === 'resortear');
  },
};

async function create(interaction) {
  const prize = interaction.options.getString('premio');
  const winners = interaction.options.getInteger('ganhadores') ?? 1;
  const requiredRole = interaction.options.getRole('cargo');
  const duration = parseDuration(interaction.options.getString('duracao'));

  if (!duration) {
    return replyError(interaction, 'Duração inválida. Use formatos como `1h`, `2d` ou `30m`.');
  }
  if (duration > MAX_DURATION) {
    return replyError(interaction, 'Um sorteio pode durar no máximo **60 dias**.');
  }

  await interaction.deferReply();
  const message = await interaction.fetchReply();

  const giveaway = {
    message_id: message.id,
    guild_id: interaction.guildId,
    channel_id: interaction.channelId,
    host_id: interaction.user.id,
    prize,
    winners,
    required_role: requiredRole?.id ?? null,
    ends_at: Date.now() + duration,
    ended: 0,
  };

  db.prepare(
    `INSERT INTO giveaways (message_id, guild_id, channel_id, host_id, prize, winners, required_role, ends_at)
     VALUES (@message_id, @guild_id, @channel_id, @host_id, @prize, @winners, @required_role, @ends_at)`,
  ).run(giveaway);

  await interaction.editReply({
    embeds: [giveawayEmbed(giveaway, 0)],
    components: [giveawayRow(message.id)],
  });
}

async function finish(interaction, client, reroll) {
  const messageId = interaction.options.getString('mensagem').trim();

  const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
  if (!giveaway) return replyError(interaction, 'Não encontrei um sorteio com esse ID de mensagem.');
  if (giveaway.guild_id !== interaction.guildId) {
    return replyError(interaction, 'Esse sorteio pertence a outro servidor.');
  }
  if (reroll && !giveaway.ended) {
    return replyError(interaction, 'Esse sorteio ainda está em andamento. Encerre-o primeiro.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await endGiveaway(client, messageId, { reroll });

  if (!result.ok) {
    return interaction.editReply({ embeds: [embed.error(result.reason)] });
  }

  await interaction.editReply({
    embeds: [
      embed.success(
        result.winners.length > 0
          ? `Sorteio ${reroll ? 'resorteado' : 'encerrado'}. Ganhador(es): ${result.winners.map((id) => `<@${id}>`).join(', ')}`
          : 'Sorteio encerrado, mas ninguém participou.',
      ),
    ],
  });
}
