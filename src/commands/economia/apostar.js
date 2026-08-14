import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { addBalance, formatMoney, getAccount } from '../../services/economy.js';

// Casa com vantagem leve: 47% de chance de vitória.
const WIN_CHANCE = 0.47;
const MAX_BET = 10_000;

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('apostar')
    .setDescription('Aposta moedas virtuais em uma rodada de cara ou coroa.')
    .addIntegerOption((option) =>
      option
        .setName('quantidade')
        .setDescription(`Quanto apostar (máximo ${MAX_BET.toLocaleString('pt-BR')})`)
        .setRequired(true)
        .setMinValue(10)
        .setMaxValue(MAX_BET),
    )
    .addStringOption((option) =>
      option
        .setName('lado')
        .setDescription('Sua escolha')
        .addChoices({ name: 'Cara', value: 'cara' }, { name: 'Coroa', value: 'coroa' }),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const bet = interaction.options.getInteger('quantidade');
    const choice = interaction.options.getString('lado') ?? 'cara';
    const settings = getGuildConfig(interaction.guildId);

    const account = getAccount(interaction.guildId, interaction.user.id);
    if (account.balance < bet) {
      return replyError(
        interaction,
        `Você só tem **${formatMoney(account.balance, settings.currency_name)}** em mãos.`,
      );
    }

    const won = Math.random() < WIN_CHANCE;
    const result = won ? choice : choice === 'cara' ? 'coroa' : 'cara';
    const updated = addBalance(interaction.guildId, interaction.user.id, won ? bet : -bet);

    await interaction.reply({
      embeds: [
        embed
          .base(won ? colors.success : colors.danger)
          .setTitle(won ? '🎉 Você ganhou!' : '💸 Você perdeu…')
          .setDescription(
            [
              `A moeda caiu em **${result}** — você apostou em **${choice}**.`,
              won
                ? `Você ganhou **${formatMoney(bet, settings.currency_name)}**.`
                : `Você perdeu **${formatMoney(bet, settings.currency_name)}**.`,
            ].join('\n'),
          )
          .addFields({
            name: 'Saldo atual',
            value: formatMoney(updated.balance, settings.currency_name),
            inline: true,
          })
          .setFooter({ text: 'Use com responsabilidade. A aposta envolve somente a moeda virtual do servidor.' }),
      ],
    });
  },
};
