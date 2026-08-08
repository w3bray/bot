import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatDuration, timestamp } from '../../lib/time.js';
import {
  DAILY_BASE,
  DAILY_COOLDOWN,
  DAILY_STREAK_BONUS,
  MAX_STREAK_BONUS,
  getAccount,
  updateAccount,
} from '../../services/economy.js';

// Depois desse prazo sem coletar, a sequência zera.
const STREAK_GRACE = 48 * 60 * 60 * 1000;

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Coleta sua recompensa diária de moedas.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const settings = getGuildConfig(interaction.guildId);
    const account = getAccount(interaction.guildId, interaction.user.id);
    const now = Date.now();
    const elapsed = now - account.last_daily;

    if (account.last_daily > 0 && elapsed < DAILY_COOLDOWN) {
      const nextAt = account.last_daily + DAILY_COOLDOWN;
      return replyError(
        interaction,
        `Você já coletou hoje. Volte ${timestamp(nextAt, 'R')} (faltam **${formatDuration(nextAt - now)}**).`,
      );
    }

    const keepsStreak = account.last_daily > 0 && elapsed < STREAK_GRACE;
    const streak = keepsStreak ? account.streak + 1 : 1;
    const bonus = Math.min(streak * DAILY_STREAK_BONUS, MAX_STREAK_BONUS);
    const total = DAILY_BASE + bonus;

    const updated = updateAccount(interaction.guildId, interaction.user.id, {
      balance: account.balance + total,
      last_daily: now,
      streak,
    });

    await interaction.reply({
      embeds: [
        embed
          .base(colors.economy)
          .setTitle('🎁 Recompensa diária coletada!')
          .setDescription(
            `Você recebeu **${total.toLocaleString('pt-BR')} ${settings.currency_name}**.`,
          )
          .addFields(
            { name: 'Base', value: `${DAILY_BASE.toLocaleString('pt-BR')}`, inline: true },
            {
              name: `Bônus de sequência (${streak} dia(s))`,
              value: `+${bonus.toLocaleString('pt-BR')}`,
              inline: true,
            },
            {
              name: 'Novo saldo',
              value: `${updated.balance.toLocaleString('pt-BR')} ${settings.currency_name}`,
              inline: true,
            },
          )
          .setFooter({
            text: keepsStreak
              ? 'Continue coletando todo dia para aumentar o bônus!'
              : 'Sua sequência recomeçou do zero.',
          }),
      ],
    });
  },
};
