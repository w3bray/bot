import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { db, getGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatMoney, getAccount } from '../../services/economy.js';

/**
 * Depósitos e saques movem valor entre `balance` e `bank` na mesma transação.
 * O dinheiro no banco não pode ser roubado por `/roubar`.
 */
const move = db.transaction((guildId, userId, amount, toBank) => {
  const account = db
    .prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);

  const source = toBank ? account.balance : account.bank;
  if (source < amount) return { ok: false };

  db.prepare(
    `UPDATE economy SET balance = balance ${toBank ? '-' : '+'} ?, bank = bank ${toBank ? '+' : '-'} ?
     WHERE guild_id = ? AND user_id = ?`,
  ).run(amount, amount, guildId, userId);

  return {
    ok: true,
    account: db
      .prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?')
      .get(guildId, userId),
  };
});

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('banco')
    .setDescription('Guarda ou retira moedas do banco. O que está no banco não pode ser roubado.')
    .addSubcommand((sub) =>
      sub
        .setName('depositar')
        .setDescription('Guarda moedas no banco.')
        .addStringOption((option) =>
          option
            .setName('quantidade')
            .setDescription('Um número ou "tudo"')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('sacar')
        .setDescription('Retira moedas do banco.')
        .addStringOption((option) =>
          option
            .setName('quantidade')
            .setDescription('Um número ou "tudo"')
            .setRequired(true),
        ),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const toBank = interaction.options.getSubcommand() === 'depositar';
    const raw = interaction.options.getString('quantidade').trim().toLowerCase();
    const settings = getGuildConfig(interaction.guildId);
    const account = getAccount(interaction.guildId, interaction.user.id);

    const available = toBank ? account.balance : account.bank;
    const amount = raw === 'tudo' || raw === 'all' ? available : Number.parseInt(raw, 10);

    if (!Number.isFinite(amount) || amount <= 0) {
      return replyError(interaction, 'Informe um número positivo ou a palavra `tudo`.');
    }

    if (available < amount) {
      return replyError(
        interaction,
        toBank
          ? `Você só tem **${formatMoney(account.balance, settings.currency_name)}** em mãos.`
          : `Você só tem **${formatMoney(account.bank, settings.currency_name)}** no banco.`,
      );
    }

    const result = move(interaction.guildId, interaction.user.id, amount, toBank);
    if (!result.ok) return replyError(interaction, 'Saldo insuficiente para essa operação.');

    await interaction.reply({
      embeds: [
        embed
          .base(colors.economy)
          .setTitle(toBank ? '🏦 Depósito realizado' : '💵 Saque realizado')
          .setDescription(
            toBank
              ? `Você guardou **${formatMoney(amount, settings.currency_name)}** no banco.`
              : `Você retirou **${formatMoney(amount, settings.currency_name)}** do banco.`,
          )
          .addFields(
            {
              name: 'Em mãos',
              value: formatMoney(result.account.balance, settings.currency_name),
              inline: true,
            },
            {
              name: 'No banco',
              value: formatMoney(result.account.bank, settings.currency_name),
              inline: true,
            },
          ),
      ],
    });
  },
};
