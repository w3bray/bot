import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, truncate } from '../../lib/embeds.js';
import { quantidade } from '../../lib/portugues.js';
import { timestamp } from '../../lib/time.js';

const PERMISSOES = {
  Administrator: 'Administrador',
  ManageGuild: 'Gerenciar servidor',
  ManageRoles: 'Gerenciar cargos',
  ManageChannels: 'Gerenciar canais',
  BanMembers: 'Banir membros',
  KickMembers: 'Expulsar membros',
  ModerateMembers: 'Moderar membros',
  ManageMessages: 'Gerenciar mensagens',
  MentionEveryone: 'Mencionar todos',
};

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('info-cargo')
    .setDescription('Mostra informações sobre um cargo.')
    .addRoleOption((option) =>
      option.setName('cargo').setDescription('Qual cargo?').setRequired(true),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const role = interaction.options.getRole('cargo');

    // Sem GuildPresences o cache pode estar incompleto; busca os membros na hora.
    await interaction.guild.members.fetch().catch(() => null);
    const members = role.members.size;

    const keyPermissions = role.permissions.toArray().filter((permission) => PERMISSOES[permission]);

    await interaction.reply({
      embeds: [
        embed
          .base(role.color || undefined)
          .setTitle(`Informações de ${role.name}`)
          .addFields(
            { name: 'ID', value: `\`${role.id}\``, inline: true },
            { name: 'Cor', value: role.hexColor, inline: true },
            { name: 'Membros', value: quantidade(members, 'membro'), inline: true },
            { name: 'Posição', value: `${role.position}`, inline: true },
            { name: 'Exibido separadamente', value: role.hoist ? 'sim' : 'não', inline: true },
            { name: 'Mencionável', value: role.mentionable ? 'sim' : 'não', inline: true },
            { name: 'Criado em', value: timestamp(role.createdAt, 'F') },
            {
              name: 'Permissões importantes',
              value: truncate(
                keyPermissions.length > 0
                  ? keyPermissions.map((permission) => `\`${PERMISSOES[permission]}\``).join(', ')
                  : '*Nenhuma permissão sensível.*',
              ),
            },
          ),
      ],
    });
  },
};
