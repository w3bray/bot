import { MessageFlags } from 'discord.js';
import { db } from '../lib/db.js';
import { embed } from '../lib/embeds.js';

const selectButton = db.prepare(
  'SELECT * FROM role_buttons WHERE message_id = ? AND role_id = ?',
);

export default {
  id: 'role',

  async execute(interaction, { action, args }) {
    if (action !== 'toggle') return;

    const roleId = args[0];

    // Só cargos registrados por /painel-cargos podem ser distribuídos assim.
    const registered = selectButton.get(interaction.message.id, roleId);
    if (!registered) {
      return interaction.reply({
        embeds: [embed.error('Este painel não é mais válido. Peça à equipe para recriá-lo.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
      return interaction.reply({
        embeds: [embed.error('Esse cargo foi apagado do servidor.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({
        embeds: [
          embed.error('Não consigo gerenciar esse cargo — ele está acima do meu na hierarquia.'),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const has = interaction.member.roles.cache.has(roleId);

    try {
      if (has) await interaction.member.roles.remove(role, 'Painel de cargos');
      else await interaction.member.roles.add(role, 'Painel de cargos');
    } catch {
      return interaction.reply({
        embeds: [embed.error('Não consegui alterar seus cargos. Avise a equipe.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      embeds: [
        has
          ? embed.success(`Cargo ${role} removido.`)
          : embed.success(`Cargo ${role} adicionado.`),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
