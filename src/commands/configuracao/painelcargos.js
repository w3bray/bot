import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { quantidade } from '../../lib/portugues.js';

const MAX_ROLES = 5;

export default {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('painel-cargos')
    .setDescription('Publica um painel onde os membros pegam cargos clicando em botões.')
    .addRoleOption((option) =>
      option.setName('cargo1').setDescription('Primeiro cargo').setRequired(true),
    )
    .addRoleOption((option) => option.setName('cargo2').setDescription('Segundo cargo'))
    .addRoleOption((option) => option.setName('cargo3').setDescription('Terceiro cargo'))
    .addRoleOption((option) => option.setName('cargo4').setDescription('Quarto cargo'))
    .addRoleOption((option) => option.setName('cargo5').setDescription('Quinto cargo'))
    .addStringOption((option) =>
      option.setName('titulo').setDescription('Título do painel').setMaxLength(200),
    )
    .addStringOption((option) =>
      option.setName('descricao').setDescription('Texto do painel').setMaxLength(2000),
    )
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Onde publicar (padrão: canal atual)')
        .addChannelTypes(ChannelType.GuildText),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const roles = Array.from({ length: MAX_ROLES }, (_, index) =>
      interaction.options.getRole(`cargo${index + 1}`),
    ).filter(Boolean);

    const unique = [...new Map(roles.map((role) => [role.id, role])).values()];
    const me = interaction.guild.members.me;

    for (const role of unique) {
      if (role.managed) {
        return replyError(interaction, `O cargo ${role} é gerenciado por uma integração.`);
      }
      if (role.id === interaction.guild.id) {
        return replyError(interaction, 'O cargo @everyone não pode ser distribuído.');
      }
      if (role.position >= me.roles.highest.position) {
        return replyError(
          interaction,
          `O cargo ${role} está acima do meu — mova meu cargo para cima na lista.`,
        );
      }
    }

    const channel = interaction.options.getChannel('canal') ?? interaction.channel;
    const title = interaction.options.getString('titulo') ?? '🎭 Escolha seus cargos';
    const description =
      interaction.options.getString('descricao') ??
      'Clique nos botões abaixo para pegar ou remover um cargo.';

    const panel = embed
      .base(colors.primary)
      .setTitle(title)
      .setDescription(
        [description, '', unique.map((role) => `• ${role}`).join('\n')].join('\n'),
      );

    const row = new ActionRowBuilder().addComponents(
      unique.map((role) =>
        new ButtonBuilder()
          .setCustomId(`role:toggle:${role.id}`)
          .setLabel(role.name.slice(0, 80))
          .setStyle(ButtonStyle.Secondary),
      ),
    );

    const sent = await channel.send({ embeds: [panel], components: [row] }).catch(() => null);
    if (!sent) return replyError(interaction, `Não consegui enviar mensagens em ${channel}.`);

    const insert = db.prepare(
      'INSERT OR REPLACE INTO role_buttons (message_id, guild_id, role_id) VALUES (?, ?, ?)',
    );
    for (const role of unique) insert.run(sent.id, interaction.guildId, role.id);

    await interaction.reply({
      embeds: [
        embed.success(`Painel com **${quantidade(unique.length, 'cargo')}** publicado em ${channel}.`),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
