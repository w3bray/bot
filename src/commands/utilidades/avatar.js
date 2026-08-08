import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Mostra o avatar de um usuário em tamanho grande.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quem? (padrão: você)'),
    )
    .addBooleanOption((option) =>
      option
        .setName('servidor')
        .setDescription('Mostrar o avatar específico deste servidor, se houver'),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const user = interaction.options.getUser('usuario') ?? interaction.user;
    const preferGuild = interaction.options.getBoolean('servidor') ?? false;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const url =
      preferGuild && member
        ? member.displayAvatarURL({ size: 4096 })
        : user.displayAvatarURL({ size: 4096 });

    const links = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(`${url}`),
      new ButtonBuilder()
        .setLabel('WebP')
        .setStyle(ButtonStyle.Link)
        .setURL(user.displayAvatarURL({ extension: 'webp', size: 4096 })),
    );

    await interaction.reply({
      embeds: [
        embed
          .base(member?.displayColor || colors.primary)
          .setTitle(`Avatar de ${user.tag}`)
          .setImage(url),
      ],
      components: [links],
    });
  },
};
