import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { embed, replyError } from '../../lib/embeds.js';
import { createCase } from '../../services/modcase.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('desbanir')
    .setDescription('Remove o banimento de um usuário.')
    .addStringOption((option) =>
      option
        .setName('usuario')
        .setDescription('ID do usuário banido (use o autocomplete)')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option.setName('motivo').setDescription('Motivo do desbanimento').setMaxLength(400),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const bans = await interaction.guild.bans.fetch().catch(() => null);
    if (!bans) return interaction.respond([]);

    const choices = [...bans.values()]
      .filter(({ user }) => user.tag.toLowerCase().includes(focused) || user.id.includes(focused))
      .slice(0, 25)
      .map(({ user }) => ({ name: `${user.tag} (${user.id})`.slice(0, 100), value: user.id }));

    await interaction.respond(choices);
  },

  async execute(interaction) {
    const userId = interaction.options.getString('usuario').trim();
    const reason = interaction.options.getString('motivo') ?? 'Sem motivo informado.';

    if (!/^\d{17,20}$/.test(userId)) {
      return replyError(interaction, 'Informe um ID de usuário válido (17 a 20 dígitos).');
    }

    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) return replyError(interaction, 'Esse usuário não está banido.');

    await interaction.deferReply();

    try {
      await interaction.guild.bans.remove(userId, `${interaction.user.tag}: ${reason}`);
    } catch {
      return interaction.editReply({
        embeds: [embed.error('Não consegui remover esse banimento.')],
      });
    }

    const caseNumber = await createCase(interaction.guild, {
      type: 'unban',
      user: ban.user,
      moderator: interaction.user,
      reason,
    });

    await interaction.editReply({
      embeds: [
        embed
          .success(`**${ban.user.tag}** foi desbanido.`, `🔓 Desbanimento · Caso #${caseNumber}`)
          .addFields({ name: 'Motivo', value: reason }),
      ],
    });
  },
};
