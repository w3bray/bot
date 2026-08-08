import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { embed, replyError } from '../../lib/embeds.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('cargo')
    .setDescription('Adiciona ou remove um cargo de um membro.')
    .addSubcommand((sub) =>
      sub
        .setName('adicionar')
        .setDescription('Dá um cargo a um membro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('Quem receberá o cargo').setRequired(true),
        )
        .addRoleOption((option) =>
          option.setName('cargo').setDescription('Qual cargo').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remove um cargo de um membro.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('De quem remover').setRequired(true),
        )
        .addRoleOption((option) =>
          option.setName('cargo').setDescription('Qual cargo').setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const add = interaction.options.getSubcommand() === 'adicionar';
    const target = interaction.options.getUser('usuario');
    const role = interaction.options.getRole('cargo');

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return replyError(interaction, 'Esse usuário não está no servidor.');

    if (role.managed) {
      return replyError(interaction, 'Esse cargo é gerenciado por uma integração e não pode ser atribuído.');
    }
    if (role.id === interaction.guild.id) {
      return replyError(interaction, 'O cargo @everyone não pode ser atribuído.');
    }

    const me = interaction.guild.members.me;
    if (role.position >= me.roles.highest.position) {
      return replyError(interaction, 'Esse cargo está acima do meu — mova meu cargo para cima na lista.');
    }
    if (
      interaction.user.id !== interaction.guild.ownerId &&
      role.position >= interaction.member.roles.highest.position
    ) {
      return replyError(interaction, 'Você não pode gerenciar um cargo igual ou acima do seu.');
    }

    const hasRole = member.roles.cache.has(role.id);
    if (add && hasRole) return replyError(interaction, `${target} já tem o cargo ${role}.`);
    if (!add && !hasRole) return replyError(interaction, `${target} não tem o cargo ${role}.`);

    try {
      if (add) await member.roles.add(role, `Por ${interaction.user.tag}`);
      else await member.roles.remove(role, `Por ${interaction.user.tag}`);
    } catch {
      return replyError(interaction, 'Não consegui alterar os cargos desse membro.');
    }

    await interaction.reply({
      embeds: [
        embed.success(
          add ? `Cargo ${role} adicionado a ${target}.` : `Cargo ${role} removido de ${target}.`,
        ),
      ],
    });
  },
};
