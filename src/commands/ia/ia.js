import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { ask, isEnabled } from '../../services/ai.js';

// Limite de caracteres da descrição de um embed, com folga para o rodapé.
const MAX_LENGTH = 3800;

export default {
  cooldown: 20,
  data: new SlashCommandBuilder()
    .setName('ia')
    .setDescription('Faz uma pergunta para a inteligência artificial.')
    .addStringOption((option) =>
      option
        .setName('pergunta')
        .setDescription('O que você quer perguntar?')
        .setRequired(true)
        .setMaxLength(1500),
    )
    .addBooleanOption((option) =>
      option.setName('privado').setDescription('Mostrar a resposta só para você'),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction) {
    if (!isEnabled) {
      return replyError(
        interaction,
        'O comando de IA não está configurado. O dono do bot precisa definir `ANTHROPIC_API_KEY`.',
      );
    }

    const question = interaction.options.getString('pergunta');
    const isPrivate = interaction.options.getBoolean('privado') ?? false;

    // A chamada pode levar alguns segundos: o defer evita o timeout de 3s.
    await interaction.deferReply(isPrivate ? { flags: MessageFlags.Ephemeral } : {});

    const result = await ask(question, { username: interaction.user.username });

    if (result.error) {
      return interaction.editReply({ embeds: [embed.error(result.error)] });
    }

    const answer =
      result.text.length > MAX_LENGTH
        ? `${result.text.slice(0, MAX_LENGTH)}…\n\n*(resposta cortada por limite do Discord)*`
        : result.text;

    await interaction.editReply({
      embeds: [
        embed
          .base(colors.primary)
          .setAuthor({
            name: `Pergunta de ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL({ size: 128 }),
          })
          .setTitle('🧠 Resposta da IA')
          .setDescription(answer)
          .addFields({ name: 'Pergunta', value: question.slice(0, 1000) })
          .setFooter({ text: `Gerado por ${result.model} · a IA pode errar` })
          .setTimestamp(),
      ],
    });
  },
};
