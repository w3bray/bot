import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';

const CHOICES = {
  pedra: { emoji: '🪨', beats: 'tesoura' },
  papel: { emoji: '📄', beats: 'pedra' },
  tesoura: { emoji: '✂️', beats: 'papel' },
};

const KEYS = Object.keys(CHOICES);

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('jokenpo')
    .setDescription('Joga pedra, papel ou tesoura contra o bot.')
    .addStringOption((option) =>
      option
        .setName('jogada')
        .setDescription('Sua escolha')
        .setRequired(true)
        .addChoices(
          { name: '🪨 Pedra', value: 'pedra' },
          { name: '📄 Papel', value: 'papel' },
          { name: '✂️ Tesoura', value: 'tesoura' },
        ),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction) {
    const player = interaction.options.getString('jogada');
    const bot = KEYS[Math.floor(Math.random() * KEYS.length)];

    const outcome =
      player === bot ? 'empate' : CHOICES[player].beats === bot ? 'vitoria' : 'derrota';

    const meta = {
      vitoria: { title: '🎉 Você venceu!', color: colors.success },
      derrota: { title: '😢 Você perdeu!', color: colors.danger },
      empate: { title: '🤝 Empate!', color: colors.warning },
    }[outcome];

    await interaction.reply({
      embeds: [
        embed
          .base(meta.color)
          .setTitle(meta.title)
          .setDescription(
            `Você: ${CHOICES[player].emoji} **${player}**\nEu: ${CHOICES[bot].emoji} **${bot}**`,
          ),
      ],
    });
  },
};
