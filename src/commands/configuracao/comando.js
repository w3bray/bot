import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db, getGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError, truncate } from '../../lib/embeds.js';
import { quantidade } from '../../lib/portugues.js';

const MAX_COMMANDS = 100;
const NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('comando')
    .setDescription('Cria respostas automáticas próprias do servidor.')
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Cria ou atualiza um comando personalizado.')
        .addStringOption((option) =>
          option
            .setName('nome')
            .setDescription('Nome sem prefixo, só letras minúsculas, números, _ e -')
            .setRequired(true)
            .setMaxLength(32),
        )
        .addStringOption((option) =>
          option
            .setName('resposta')
            .setDescription('O que o bot responde. Use {user} e {server}')
            .setRequired(true)
            .setMaxLength(1500),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Apaga um comando personalizado.')
        .addStringOption((option) =>
          option
            .setName('nome')
            .setDescription('Nome do comando')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('listar').setDescription('Lista os comandos personalizados do servidor.'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const rows = db
      .prepare('SELECT name FROM custom_commands WHERE guild_id = ? ORDER BY name')
      .all(interaction.guildId);

    await interaction.respond(
      rows
        .filter((row) => row.name.includes(focused))
        .slice(0, 25)
        .map((row) => ({ name: row.name, value: row.name })),
    );
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'criar') return create(interaction);
    if (subcommand === 'remover') return remove(interaction);
    return list(interaction);
  },
};

async function create(interaction) {
  const name = interaction.options.getString('nome').trim().toLowerCase();
  const response = interaction.options.getString('resposta');

  if (!NAME_PATTERN.test(name)) {
    return replyError(
      interaction,
      'Nome inválido. Use apenas letras minúsculas, números, `_` e `-` (até 32 caracteres).',
    );
  }

  const total = db
    .prepare('SELECT COUNT(*) AS total FROM custom_commands WHERE guild_id = ?')
    .get(interaction.guildId).total;

  const exists = db
    .prepare('SELECT 1 FROM custom_commands WHERE guild_id = ? AND name = ?')
    .get(interaction.guildId, name);

  if (!exists && total >= MAX_COMMANDS) {
    return replyError(interaction, `O servidor já tem ${MAX_COMMANDS} comandos personalizados.`);
  }

  db.prepare(
    `INSERT INTO custom_commands (guild_id, name, response, created_by, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (guild_id, name) DO UPDATE SET response = excluded.response`,
  ).run(interaction.guildId, name, response, interaction.user.id, Date.now());

  const settings = getGuildConfig(interaction.guildId);

  await interaction.reply({
    embeds: [
      embed
        .success(
          `Comando ${exists ? 'atualizado' : 'criado'}: digite \`${settings.prefix}${name}\` no chat.`,
        )
        .addFields({ name: 'Resposta', value: truncate(response) }),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function remove(interaction) {
  const name = interaction.options.getString('nome').trim().toLowerCase();

  const result = db
    .prepare('DELETE FROM custom_commands WHERE guild_id = ? AND name = ?')
    .run(interaction.guildId, name);

  if (result.changes === 0) {
    return replyError(interaction, `Não existe um comando personalizado chamado \`${name}\`.`);
  }

  await interaction.reply({
    embeds: [embed.success(`Comando \`${name}\` removido.`)],
    flags: MessageFlags.Ephemeral,
  });
}

async function list(interaction) {
  const rows = db
    .prepare('SELECT * FROM custom_commands WHERE guild_id = ? ORDER BY uses DESC, name')
    .all(interaction.guildId);

  if (rows.length === 0) {
    return interaction.reply({
      embeds: [embed.info('Nenhum comando personalizado ainda. Crie um com `/comando criar`.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  const settings = getGuildConfig(interaction.guildId);

  await interaction.reply({
    embeds: [
      embed
        .base(colors.primary)
        .setTitle('💬 Comandos personalizados')
        .setDescription(
          truncate(
            rows
              .map((row) => `\`${settings.prefix}${row.name}\` — ${quantidade(row.uses, 'uso')}`)
              .join('\n'),
            4000,
          ),
        )
        .setFooter({ text: `${quantidade(rows.length, 'comando')} · prefixo atual: ${settings.prefix}` }),
    ],
    flags: MessageFlags.Ephemeral,
  });
}
