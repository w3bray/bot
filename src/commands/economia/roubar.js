import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { db, getGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatDuration, timestamp } from '../../lib/time.js';
import { ROB_COOLDOWN, formatMoney, getAccount, updateAccount } from '../../services/economy.js';

const SUCCESS_CHANCE = 0.4;
const MIN_TARGET_BALANCE = 200;
const MAX_STEAL_RATIO = 0.25;
const FINE_RATIO = 0.15;

/** Move o valor roubado entre as duas contas de uma vez só. */
const steal = db.transaction((guildId, thiefId, victimId, amount) => {
  db.prepare('UPDATE economy SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(
    amount,
    guildId,
    victimId,
  );
  db.prepare('UPDATE economy SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(
    amount,
    guildId,
    thiefId,
  );
});

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('roubar')
    .setDescription('Tenta roubar moedas de outro membro. Se falhar, você paga multa.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quem?').setRequired(true),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const target = interaction.options.getUser('usuario');
    const settings = getGuildConfig(interaction.guildId);
    const currency = settings.currency_name;

    if (target.id === interaction.user.id) {
      return replyError(interaction, 'Roubar de si mesmo não faz sentido.');
    }
    if (target.bot) return replyError(interaction, 'Bots não carregam moedas.');

    const thief = getAccount(interaction.guildId, interaction.user.id);
    const now = Date.now();

    if (now - thief.last_rob < ROB_COOLDOWN) {
      const nextAt = thief.last_rob + ROB_COOLDOWN;
      return replyError(
        interaction,
        `A polícia ainda está de olho em você. Tente ${timestamp(nextAt, 'R')} (faltam **${formatDuration(nextAt - now)}**).`,
      );
    }

    const victim = getAccount(interaction.guildId, target.id);

    if (victim.balance < MIN_TARGET_BALANCE) {
      return replyError(
        interaction,
        `**${target.tag}** tem menos de ${formatMoney(MIN_TARGET_BALANCE, currency)} em mãos — não vale o risco.`,
      );
    }
    if (thief.balance < MIN_TARGET_BALANCE) {
      return replyError(
        interaction,
        `Você precisa de pelo menos ${formatMoney(MIN_TARGET_BALANCE, currency)} em mãos para cobrir uma eventual multa.`,
      );
    }

    const succeeded = Math.random() < SUCCESS_CHANCE;

    if (succeeded) {
      const amount = Math.max(
        1,
        Math.floor(victim.balance * MAX_STEAL_RATIO * (0.4 + Math.random() * 0.6)),
      );
      steal(interaction.guildId, interaction.user.id, target.id, amount);
      updateAccount(interaction.guildId, interaction.user.id, { last_rob: now });

      return interaction.reply({
        embeds: [
          embed
            .base(colors.success)
            .setTitle('🦝 Roubo bem-sucedido!')
            .setDescription(
              `Você surrupiou **${formatMoney(amount, currency)}** de ${target} e saiu ileso.`,
            )
            .setFooter({ text: 'Dica para a vítima: guarde as moedas com /banco depositar.' }),
        ],
      });
    }

    const fine = Math.max(1, Math.floor(thief.balance * FINE_RATIO));
    updateAccount(interaction.guildId, interaction.user.id, {
      balance: Math.max(0, thief.balance - fine),
      last_rob: now,
    });

    await interaction.reply({
      embeds: [
        embed
          .base(colors.danger)
          .setTitle('🚔 Você foi pego!')
          .setDescription(
            `A tentativa de roubar ${target} deu errado e você pagou **${formatMoney(fine, currency)}** de multa.`,
          ),
      ],
    });
  },
};
