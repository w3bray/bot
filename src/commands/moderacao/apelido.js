import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { embed, replyError } from '../../lib/embeds.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('apelido')
    .setDescription('Altera ou remove o apelido de um membro.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('De quem?').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('novo')
        .setDescription('Novo apelido (deixe vazio para remover)')
        .setMaxLength(32),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const target = interaction.options.getUser('usuario');
    const nickname = interaction.options.getString('novo');

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return replyError(interaction, 'Esse usuário não está no servidor.');

    if (!member.manageable) {
      return replyError(
        interaction,
        'Não consigo alterar o apelido desse membro (cargo acima do meu ou é o dono do servidor).',
      );
    }

    const previous = member.displayName;

    try {
      await member.setNickname(nickname, `Alterado por ${interaction.user.tag}`);
    } catch {
      return replyError(interaction, 'Não consegui alterar o apelido.');
    }

    await interaction.reply({
      embeds: [
        embed.success(
          nickname
            ? `Apelido de **${target.tag}** alterado de \`${previous}\` para \`${nickname}\`.`
            : `Apelido de **${target.tag}** removido.`,
        ),
      ],
    });
  },
};
