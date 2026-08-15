import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatMoney, getAccount } from '../../services/economy.js';
import { quantidade } from '../../lib/portugues.js';

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('Mostra o saldo de moedas seu ou de outro membro.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quem? (padrão: você)'),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const user = interaction.options.getUser('usuario') ?? interaction.user;
    if (user.bot) return replyError(interaction, 'Bots não têm carteira.');

    const settings = getGuildConfig(interaction.guildId);
    const account = getAccount(interaction.guildId, user.id);
    const currency = settings.currency_name;

    await interaction.reply({
      embeds: [
        embed
          .base(colors.economy)
          .setAuthor({
            name: `Carteira de ${user.tag}`,
            iconURL: user.displayAvatarURL({ size: 128 }),
          })
          .addFields(
            { name: '💵 Em mãos', value: formatMoney(account.balance, currency), inline: true },
            { name: '🏦 No banco', value: formatMoney(account.bank, currency), inline: true },
            {
              name: '💰 Total',
              value: formatMoney(account.balance + account.bank, currency),
              inline: true,
            },
            {
              name: '🔥 Sequência diária',
              value: quantidade(account.streak, 'dia'),
              inline: true,
            },
          )
          .setFooter({ text: 'Use /diário todos os dias para aumentar sua sequência.' }),
      ],
    });
  },
};
