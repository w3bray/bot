import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError, truncate } from '../../lib/embeds.js';
import { timestamp } from '../../lib/time.js';
import { recall } from '../../services/snipe.js';

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('apagada')
    .setDescription('Mostra a última mensagem apagada neste canal (guardada por 10 minutos).')
    // Restrito a quem modera: recuperar mensagem apagada é uma ação sensível.
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const entry = recall(interaction.channelId);

    if (!entry) {
      return replyError(
        interaction,
        'Não tenho nenhuma mensagem apagada recente guardada deste canal.',
      );
    }

    const result = embed
      .base(colors.warning)
      .setAuthor({ name: entry.authorTag, iconURL: entry.avatar })
      .setDescription(truncate(entry.content || '*(sem texto)*', 4000))
      .addFields(
        { name: 'Autor', value: `<@${entry.authorId}>`, inline: true },
        { name: 'Enviada', value: timestamp(entry.createdAt, 'R'), inline: true },
        { name: 'Apagada', value: timestamp(entry.deletedAt, 'R'), inline: true },
      )
      .setFooter({ text: 'Guardado apenas em memória, por 10 minutos.' });

    if (entry.attachments.length > 0) {
      result.addFields({ name: 'Anexos', value: truncate(entry.attachments.join(', ')) });
    }

    await interaction.reply({ embeds: [result] });
  },
};
