import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { timestamp } from '../../lib/time.js';
import { getBadges, getProfile } from '../../services/profiles.js';
import { getUserLevel } from '../../services/leveling.js';
import { formatMoney, getAccount } from '../../services/economy.js';
import { ITEMS_BY_ID } from '../../services/shop.js';

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Mostra o perfil completo de um membro.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quem? (padrão: você)'),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const user = interaction.options.getUser('usuario') ?? interaction.user;
    if (user.bot) return replyError(interaction, 'Bots não têm perfil.');

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const settings = getGuildConfig(interaction.guildId);
    const profile = getProfile(interaction.guildId, user.id);
    const level = getUserLevel(interaction.guildId, user.id);
    const account = getAccount(interaction.guildId, user.id);

    const badges = getBadges(profile)
      .map((id) => ITEMS_BY_ID.get(id)?.emoji)
      .filter(Boolean)
      .join(' ');

    const ratio = level.neededXp === 0 ? 1 : level.currentLevelXp / level.neededXp;
    const filled = Math.round(ratio * 15);
    const bar = '█'.repeat(filled) + '░'.repeat(15 - filled);

    const card = embed
      .base(member?.displayColor || colors.primary)
      .setAuthor({
        name: `Perfil de ${user.tag}`,
        iconURL: user.displayAvatarURL({ size: 128 }),
      })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setDescription(profile.bio ? `*${profile.bio}*` : '*Sem bio. Use `/bio` para escrever uma.*')
      .addFields(
        {
          name: '📈 Nível',
          value: `**${level.level}** · #${level.rank} no ranking\n\`${bar}\` ${Math.round(ratio * 100)}%`,
          inline: true,
        },
        {
          name: '🪙 Patrimônio',
          value: formatMoney(account.balance + account.bank, settings.currency_name),
          inline: true,
        },
        {
          name: '⭐ Reputação',
          value: `${profile.reputation}`,
          inline: true,
        },
      );

    if (profile.married_to) {
      card.addFields({
        name: '💍 Casado(a) com',
        value: `<@${profile.married_to}> desde ${timestamp(profile.married_at, 'D')}`,
      });
    }

    if (badges) card.addFields({ name: '🎖️ Distintivos', value: badges });

    if (member?.joinedAt) {
      card.setFooter({ text: `No servidor desde` }).setTimestamp(member.joinedAt);
    }

    await interaction.reply({ embeds: [card] });
  },
};
