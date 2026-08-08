import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';

/**
 * Compatibilidade determinística: o mesmo par sempre dá o mesmo resultado,
 * independentemente da ordem em que os nomes foram informados.
 */
function compatibility(idA, idB) {
  const seed = [idA, idB].sort().join('');
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 101;
  }
  return hash;
}

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('Calcula a compatibilidade entre duas pessoas (só brincadeira!).')
    .addUserOption((option) =>
      option.setName('pessoa1').setDescription('Primeira pessoa').setRequired(true),
    )
    .addUserOption((option) =>
      option.setName('pessoa2').setDescription('Segunda pessoa (padrão: você)'),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const first = interaction.options.getUser('pessoa1');
    const second = interaction.options.getUser('pessoa2') ?? interaction.user;

    if (first.id === second.id) {
      return interaction.reply({
        embeds: [embed.info('Amor-próprio é **100%** sempre. ❤️')],
      });
    }

    const percent = compatibility(first.id, second.id);
    const filled = Math.round(percent / 5);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);

    const verdict =
      percent >= 80
        ? 'Casal perfeito! 💞'
        : percent >= 60
          ? 'Tem futuro aí. 💕'
          : percent >= 40
            ? 'Dá pra tentar… 🤔'
            : percent >= 20
              ? 'Melhor ficar na amizade. 🤝'
              : 'Nem em outra vida. 💔';

    const shipName =
      first.username.slice(0, Math.ceil(first.username.length / 2)) +
      second.username.slice(Math.floor(second.username.length / 2));

    await interaction.reply({
      embeds: [
        embed
          .base(colors.danger)
          .setTitle('💘 Medidor de compatibilidade')
          .setDescription(
            [
              `${first} 💗 ${second}`,
              '',
              `**${shipName}**`,
              `\`${bar}\` **${percent}%**`,
              '',
              verdict,
            ].join('\n'),
          )
          .setFooter({ text: 'Resultado gerado por brincadeira, sem valor científico.' }),
      ],
    });
  },
};
