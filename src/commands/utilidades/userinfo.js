import { InteractionContextType, SlashCommandBuilder, UserFlags } from 'discord.js';
import { colors } from '../../config.js';
import { embed, truncate } from '../../lib/embeds.js';
import { timestamp } from '../../lib/time.js';

const BADGES = {
  [UserFlags.Staff]: 'Equipe Discord',
  [UserFlags.Partner]: 'Parceiro',
  [UserFlags.Hypesquad]: 'HypeSquad',
  [UserFlags.BugHunterLevel1]: 'Caçador de Bugs',
  [UserFlags.BugHunterLevel2]: 'Caçador de Bugs II',
  [UserFlags.HypeSquadOnlineHouse1]: 'Bravery',
  [UserFlags.HypeSquadOnlineHouse2]: 'Brilliance',
  [UserFlags.HypeSquadOnlineHouse3]: 'Balance',
  [UserFlags.PremiumEarlySupporter]: 'Apoiador Inicial',
  [UserFlags.VerifiedDeveloper]: 'Desenvolvedor Verificado',
  [UserFlags.CertifiedModerator]: 'Moderador Certificado',
  [UserFlags.ActiveDeveloper]: 'Desenvolvedor Ativo',
};

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Mostra informações sobre um usuário.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quem? (padrão: você)'),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const user = await (interaction.options.getUser('usuario') ?? interaction.user).fetch();
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const badges = user.flags
      ?.toArray()
      .map((flag) => BADGES[UserFlags[flag]])
      .filter(Boolean);

    const info = embed
      .base(member?.displayColor || colors.primary)
      .setTitle(`Informações de ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Usuário', value: `${user}`, inline: true },
        { name: 'ID', value: `\`${user.id}\``, inline: true },
        { name: 'Bot', value: user.bot ? 'sim' : 'não', inline: true },
        { name: 'Conta criada', value: timestamp(user.createdAt, 'F'), inline: false },
      );

    if (user.banner) info.setImage(user.bannerURL({ size: 1024 }));
    if (badges?.length) info.addFields({ name: 'Selos', value: badges.join(', ') });

    if (member) {
      const roles = member.roles.cache
        .filter((role) => role.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => `${role}`);

      info.addFields(
        {
          name: 'Entrou no servidor',
          value: member.joinedAt ? timestamp(member.joinedAt, 'F') : 'desconhecido',
        },
        {
          name: 'Apelido',
          value: member.nickname ?? '*nenhum*',
          inline: true,
        },
        {
          name: 'Cargo mais alto',
          value: `${member.roles.highest}`,
          inline: true,
        },
        {
          name: `Cargos (${roles.length})`,
          value: truncate(roles.join(' ') || '*nenhum*'),
        },
      );

      if (member.isCommunicationDisabled()) {
        info.addFields({
          name: '🔇 Castigo ativo',
          value: `expira ${timestamp(member.communicationDisabledUntil, 'R')}`,
        });
      }
      if (member.premiumSince) {
        info.addFields({
          name: '💎 Impulsionando desde',
          value: timestamp(member.premiumSince, 'R'),
          inline: true,
        });
      }
    } else {
      info.setFooter({ text: 'Este usuário não está no servidor.' });
    }

    await interaction.reply({ embeds: [info] });
  },
};
