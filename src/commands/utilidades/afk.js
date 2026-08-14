import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { db } from '../../lib/db.js';
import { embed } from '../../lib/embeds.js';

export default {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('ausente')
    .setDescription('Marca você como ausente. Quem te mencionar será avisado.')
    .addStringOption((option) =>
      option.setName('motivo').setDescription('Por que você está saindo?').setMaxLength(200),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const reason = interaction.options.getString('motivo') ?? null;

    db.prepare(
      `INSERT INTO afk (guild_id, user_id, reason, since) VALUES (?, ?, ?, ?)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET reason = excluded.reason, since = excluded.since`,
    ).run(interaction.guildId, interaction.user.id, reason, Date.now());

    // Marca visualmente no apelido quando o bot tem permissão para isso.
    if (
      interaction.member.manageable &&
      !interaction.member.displayName.startsWith('[Ausente] ')
    ) {
      await interaction.member
        .setNickname(`[Ausente] ${interaction.member.displayName}`.slice(0, 32))
        .catch(() => null);
    }

    await interaction.reply({
      embeds: [
        embed.success(
          reason
            ? `Você está ausente: **${reason}**\nO aviso some assim que você mandar uma mensagem.`
            : 'Você está ausente. O aviso some assim que você mandar uma mensagem.',
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
