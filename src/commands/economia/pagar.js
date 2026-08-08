import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../../lib/db.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatMoney, getAccount, transfer } from '../../services/economy.js';

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('pagar')
    .setDescription('Transfere moedas para outro membro.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Quem vai receber').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('quantidade')
        .setDescription('Quantas moedas transferir')
        .setRequired(true)
        .setMinValue(1),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const target = interaction.options.getUser('usuario');
    const amount = interaction.options.getInteger('quantidade');
    const settings = getGuildConfig(interaction.guildId);

    if (target.id === interaction.user.id) {
      return replyError(interaction, 'Você não pode transferir moedas para si mesmo.');
    }
    if (target.bot) return replyError(interaction, 'Bots não recebem moedas.');

    const sender = getAccount(interaction.guildId, interaction.user.id);
    if (sender.balance < amount) {
      return replyError(
        interaction,
        `Saldo insuficiente. Você tem **${formatMoney(sender.balance, settings.currency_name)}** em mãos.`,
      );
    }

    const result = transfer(interaction.guildId, interaction.user.id, target.id, amount);
    if (!result.ok) return replyError(interaction, `Transferência cancelada: ${result.reason}.`);

    const updated = getAccount(interaction.guildId, interaction.user.id);

    await interaction.reply({
      embeds: [
        embed
          .success(
            `Você transferiu **${formatMoney(amount, settings.currency_name)}** para ${target}.`,
            '💸 Transferência concluída',
          )
          .addFields({
            name: 'Seu novo saldo',
            value: formatMoney(updated.balance, settings.currency_name),
            inline: true,
          }),
      ],
    });
  },
};
