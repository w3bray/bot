import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { embed, replyError } from '../../lib/embeds.js';
import { createCase } from '../../services/modcase.js';
import { quantidade } from '../../lib/portugues.js';

// A API só apaga em massa mensagens com menos de 14 dias.
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('limpar')
    .setDescription('Apaga mensagens recentes do canal (máximo 100, até 14 dias).')
    .addIntegerOption((option) =>
      option
        .setName('quantidade')
        .setDescription('Quantas mensagens verificar (1 a 100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Apagar apenas mensagens deste usuário'),
    )
    .addStringOption((option) =>
      option
        .setName('filtro')
        .setDescription('Apagar apenas mensagens de um tipo')
        .addChoices(
          { name: 'Somente bots', value: 'bots' },
          { name: 'Somente com anexos', value: 'anexos' },
          { name: 'Somente com links', value: 'links' },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const amount = interaction.options.getInteger('quantidade');
    const user = interaction.options.getUser('usuario');
    const filter = interaction.options.getString('filtro');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const fetched = await interaction.channel.messages
      .fetch({ limit: amount })
      .catch(() => null);

    if (!fetched) return replyError(interaction, 'Não consegui ler as mensagens deste canal.');

    const cutoff = Date.now() - MAX_AGE;
    const targets = [...fetched.values()].filter((message) => {
      if (message.pinned) return false;
      if (message.createdTimestamp < cutoff) return false;
      if (user && message.author.id !== user.id) return false;
      if (filter === 'bots' && !message.author.bot) return false;
      if (filter === 'anexos' && message.attachments.size === 0) return false;
      if (filter === 'links' && !/https?:\/\//i.test(message.content)) return false;
      return true;
    });

    if (targets.length === 0) {
      return interaction.editReply({
        embeds: [
          embed.warning(
            'Nenhuma mensagem se encaixa nos critérios (mensagens fixadas e com mais de 14 dias são ignoradas).',
          ),
        ],
      });
    }

    const deleted = await interaction.channel.bulkDelete(targets, true).catch(() => null);

    if (!deleted) {
      return interaction.editReply({
        embeds: [embed.error('Não consegui apagar as mensagens. Verifique minhas permissões.')],
      });
    }

    await createCase(interaction.guild, {
      type: 'purge',
      user: interaction.user,
      moderator: interaction.user,
      reason: `${quantidade(deleted.size, 'mensagem apagada', 'mensagens apagadas')} em #${interaction.channel.name}${user ? ` · filtro: ${user.tag}` : ''}`,
    });

    await interaction.editReply({
      embeds: [embed.success(`Apaguei **${quantidade(deleted.size, 'mensagem')}**.`)],
    });
  },
};
