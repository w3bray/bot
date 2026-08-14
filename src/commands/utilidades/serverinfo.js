import { ChannelType, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, truncate } from '../../lib/embeds.js';
import { timestamp } from '../../lib/time.js';
import { quantidade } from '../../lib/portugues.js';

const VERIFICATION = ['nenhuma', 'baixa', 'média', 'alta', 'muito alta'];

const RECURSOS = {
  ANIMATED_BANNER: 'banner animado',
  ANIMATED_ICON: 'ícone animado',
  AUTO_MODERATION: 'moderação automática',
  BANNER: 'banner',
  COMMUNITY: 'comunidade',
  CREATOR_MONETIZABLE_PROVISIONAL: 'monetização para criadores',
  CREATOR_STORE_PAGE: 'página da loja do criador',
  DISCOVERABLE: 'descoberta pública',
  FEATURABLE: 'destaque público',
  INVITES_DISABLED: 'convites desativados',
  MEMBER_VERIFICATION_GATE_ENABLED: 'verificação de membros',
  MORE_SOUNDBOARD: 'mais sons no painel',
  NEWS: 'canais de anúncios',
  PARTNERED: 'servidor parceiro',
  PREVIEW_ENABLED: 'prévia pública',
  ROLE_ICONS: 'ícones de cargos',
  SOUNDBOARD: 'painel de sons',
  VANITY_URL: 'link personalizado',
  VERIFIED: 'servidor verificado',
  VIP_REGIONS: 'regiões de voz VIP',
};

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('info-servidor')
    .setDescription('Mostra informações sobre este servidor.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);
    const channels = guild.channels.cache;

    const count = (type) => channels.filter((channel) => channel.type === type).size;

    const info = embed
      .base(colors.primary)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        {
          name: 'Proprietário',
          value: owner ? `${owner.user.tag}` : 'Desconhecido',
          inline: true,
        },
        { name: 'ID', value: `\`${guild.id}\``, inline: true },
        { name: 'Criado em', value: timestamp(guild.createdAt, 'D'), inline: true },
        {
          name: 'Membros',
          value: `${guild.memberCount.toLocaleString('pt-BR')}`,
          inline: true,
        },
        { name: 'Cargos', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true },
        {
          name: 'Canais',
          value: [
            `💬 ${count(ChannelType.GuildText)} de texto`,
            `🔊 ${count(ChannelType.GuildVoice)} de voz`,
            `📁 ${count(ChannelType.GuildCategory)} categorias`,
            `📢 ${count(ChannelType.GuildAnnouncement)} de anúncios`,
          ].join('\n'),
          inline: true,
        },
        {
          name: 'Impulsos',
          value: `Nível ${guild.premiumTier} · ${quantidade(guild.premiumSubscriptionCount ?? 0, 'impulso')}`,
          inline: true,
        },
        {
          name: 'Verificação',
          value: VERIFICATION[guild.verificationLevel] ?? 'Desconhecida',
          inline: true,
        },
      );

    if (guild.description) info.setDescription(guild.description);
    if (guild.bannerURL()) info.setImage(guild.bannerURL({ size: 1024 }));

    if (guild.features.length > 0) {
      info.addFields({
        name: 'Recursos',
        value: truncate(
          guild.features
            .map((feature) => `\`${RECURSOS[feature] ?? feature.toLowerCase().replaceAll('_', ' ')}\``)
            .join(', '),
        ),
      });
    }

    await interaction.reply({ embeds: [info] });
  },
};
