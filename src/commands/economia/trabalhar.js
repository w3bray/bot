import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatDuration, timestamp } from '../../lib/time.js';
import {
  WORK_COOLDOWN,
  WORK_SCENARIOS,
  getAccount,
  updateAccount,
} from '../../services/economy.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('trabalhar')
    .setDescription('Faz um bico e ganha algumas moedas.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const settings = getGuildConfig(interaction.guildId);
    const account = getAccount(interaction.guildId, interaction.user.id);
    const now = Date.now();

    if (now - account.last_work < WORK_COOLDOWN) {
      const nextAt = account.last_work + WORK_COOLDOWN;
      return replyError(
        interaction,
        `Você precisa descansar. Volte ${timestamp(nextAt, 'R')} (faltam **${formatDuration(nextAt - now)}**).`,
      );
    }

    const scenario = WORK_SCENARIOS[Math.floor(Math.random() * WORK_SCENARIOS.length)];
    const earned =
      Math.floor(Math.random() * (scenario.max - scenario.min + 1)) + scenario.min;

    const updated = updateAccount(interaction.guildId, interaction.user.id, {
      balance: account.balance + earned,
      last_work: now,
    });

    await interaction.reply({
      embeds: [
        embed
          .base(colors.economy)
          .setTitle('💼 Trabalho concluído')
          .setDescription(
            `${scenario.text} e ganhou **${earned.toLocaleString('pt-BR')} ${settings.currency_name}**.`,
          )
          .addFields({
            name: 'Novo saldo',
            value: `${updated.balance.toLocaleString('pt-BR')} ${settings.currency_name}`,
            inline: true,
          })
          .setFooter({ text: 'Você pode trabalhar de novo em 1 hora.' }),
      ],
    });
  },
};
