import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getAutomod, readJson, setAutomod } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError, truncate } from '../../lib/embeds.js';

const MAX_WORDS = 100;

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configura a moderação automática.')
    .addSubcommand((sub) => sub.setName('ver').setDescription('Mostra as regras ativas.'))
    .addSubcommand((sub) =>
      sub
        .setName('filtros')
        .setDescription('Liga ou desliga os filtros de conteúdo.')
        .addBooleanOption((option) =>
          option.setName('convites').setDescription('Bloquear convites de outros servidores'),
        )
        .addBooleanOption((option) =>
          option.setName('links').setDescription('Bloquear qualquer link'),
        )
        .addBooleanOption((option) =>
          option.setName('spam').setDescription('Bloquear flood de mensagens'),
        )
        .addBooleanOption((option) =>
          option.setName('caps').setDescription('Bloquear excesso de letras maiúsculas'),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('limites')
        .setDescription('Ajusta os limites numéricos dos filtros.')
        .addIntegerOption((option) =>
          option
            .setName('mensagens_spam')
            .setDescription('Máximo de mensagens na janela de tempo (padrão: 5)')
            .setMinValue(2)
            .setMaxValue(20),
        )
        .addIntegerOption((option) =>
          option
            .setName('janela_segundos')
            .setDescription('Janela do antispam em segundos (padrão: 5)')
            .setMinValue(1)
            .setMaxValue(60),
        )
        .addIntegerOption((option) =>
          option
            .setName('percentual_caps')
            .setDescription('A partir de quantos % de maiúsculas bloquear (padrão: 70)')
            .setMinValue(30)
            .setMaxValue(100),
        )
        .addIntegerOption((option) =>
          option
            .setName('mencoes')
            .setDescription('Máximo de menções por mensagem (0 desativa)')
            .setMinValue(0)
            .setMaxValue(50),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('punicao')
        .setDescription('Define o que acontece com quem infringe as regras.')
        .addStringOption((option) =>
          option
            .setName('acao')
            .setDescription('Ação aplicada')
            .setRequired(true)
            .addChoices(
              { name: 'Apenas apagar a mensagem', value: 'delete' },
              { name: 'Apagar e castigar', value: 'timeout' },
              { name: 'Apagar e expulsar', value: 'kick' },
              { name: 'Apagar e banir', value: 'ban' },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName('minutos')
            .setDescription('Duração do castigo, se a ação for castigar (padrão: 10)')
            .setMinValue(1)
            .setMaxValue(40_320),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('palavras')
        .setDescription('Gerencia a lista de palavras proibidas.')
        .addStringOption((option) =>
          option
            .setName('acao')
            .setDescription('O que fazer')
            .setRequired(true)
            .addChoices(
              { name: 'Adicionar', value: 'add' },
              { name: 'Remover', value: 'remove' },
              { name: 'Listar', value: 'list' },
              { name: 'Limpar tudo', value: 'clear' },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('palavras')
            .setDescription('Palavras separadas por vírgula')
            .setMaxLength(1000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('ignorar')
        .setDescription('Define cargos e canais isentos do automod.')
        .addStringOption((option) =>
          option
            .setName('acao')
            .setDescription('O que fazer')
            .setRequired(true)
            .addChoices(
              { name: 'Adicionar à lista de isentos', value: 'add' },
              { name: 'Remover da lista de isentos', value: 'remove' },
            ),
        )
        .addRoleOption((option) => option.setName('cargo').setDescription('Cargo isento'))
        .addChannelOption((option) => option.setName('canal').setDescription('Canal isento')),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const handlers = {
      ver: show,
      filtros: setFilters,
      limites: setLimits,
      punicao: setPunishment,
      palavras: manageWords,
      ignorar: manageExemptions,
    };

    return handlers[interaction.options.getSubcommand()](interaction);
  },
};

const PUNISHMENT_LABELS = {
  delete: 'apagar a mensagem',
  timeout: 'apagar e castigar',
  kick: 'apagar e expulsar',
  ban: 'apagar e banir',
};

function state(value) {
  return value ? '🟢 ativo' : '⚪ desligado';
}

async function show(interaction) {
  const settings = getAutomod(interaction.guildId);
  const words = readJson(settings.banned_words);
  const roles = readJson(settings.ignored_roles);
  const channels = readJson(settings.ignored_channels);

  await interaction.reply({
    embeds: [
      embed
        .base(colors.primary)
        .setTitle('🤖 AutoMod')
        .addFields(
          {
            name: 'Filtros',
            value: [
              `Convites: ${state(settings.anti_invite)}`,
              `Links: ${state(settings.anti_link)}`,
              `Spam: ${state(settings.anti_spam)}`,
              `Maiúsculas: ${state(settings.anti_caps)}`,
              `Menções: ${settings.mention_limit > 0 ? `🟢 máximo de ${settings.mention_limit}` : '⚪ desligado'}`,
              `Palavras proibidas: ${words.length > 0 ? `🟢 ${words.length} palavra(s)` : '⚪ nenhuma'}`,
            ].join('\n'),
          },
          {
            name: 'Limites',
            value: [
              `Spam: ${settings.spam_messages} mensagens em ${settings.spam_window / 1000}s`,
              `Maiúsculas: a partir de ${settings.caps_percent}%`,
            ].join('\n'),
            inline: true,
          },
          {
            name: 'Punição',
            value: `${PUNISHMENT_LABELS[settings.punishment]}${settings.punishment === 'timeout' ? ` (${settings.timeout_minutes} min)` : ''}`,
            inline: true,
          },
          {
            name: 'Isentos',
            value: [
              `Cargos: ${roles.length > 0 ? roles.map((id) => `<@&${id}>`).join(' ') : '*nenhum*'}`,
              `Canais: ${channels.length > 0 ? channels.map((id) => `<#${id}>`).join(' ') : '*nenhum*'}`,
            ].join('\n'),
          },
        )
        .setFooter({ text: 'Quem pode gerenciar mensagens é sempre isento.' }),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function setFilters(interaction) {
  const mapping = {
    convites: 'anti_invite',
    links: 'anti_link',
    spam: 'anti_spam',
    caps: 'anti_caps',
  };

  const patch = {};
  for (const [option, column] of Object.entries(mapping)) {
    const value = interaction.options.getBoolean(option);
    if (value !== null) patch[column] = value ? 1 : 0;
  }

  if (Object.keys(patch).length === 0) {
    return replyError(interaction, 'Informe pelo menos um filtro para alterar.');
  }

  setAutomod(interaction.guildId, patch);

  await interaction.reply({
    embeds: [embed.success('Filtros atualizados. Use `/automod ver` para conferir.')],
    flags: MessageFlags.Ephemeral,
  });
}

async function setLimits(interaction) {
  const patch = {};
  const spamMessages = interaction.options.getInteger('mensagens_spam');
  const window = interaction.options.getInteger('janela_segundos');
  const caps = interaction.options.getInteger('percentual_caps');
  const mentions = interaction.options.getInteger('mencoes');

  if (spamMessages !== null) patch.spam_messages = spamMessages;
  if (window !== null) patch.spam_window = window * 1000;
  if (caps !== null) patch.caps_percent = caps;
  if (mentions !== null) patch.mention_limit = mentions;

  if (Object.keys(patch).length === 0) {
    return replyError(interaction, 'Informe pelo menos um limite para alterar.');
  }

  setAutomod(interaction.guildId, patch);

  await interaction.reply({
    embeds: [embed.success('Limites atualizados. Use `/automod ver` para conferir.')],
    flags: MessageFlags.Ephemeral,
  });
}

async function setPunishment(interaction) {
  const action = interaction.options.getString('acao');
  const minutes = interaction.options.getInteger('minutos');

  const patch = { punishment: action };
  if (minutes !== null) patch.timeout_minutes = minutes;

  setAutomod(interaction.guildId, patch);

  await interaction.reply({
    embeds: [
      embed.success(
        `Punição do automod definida como **${PUNISHMENT_LABELS[action]}**${action === 'timeout' ? ` por ${minutes ?? getAutomod(interaction.guildId).timeout_minutes} minuto(s)` : ''}.`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function manageWords(interaction) {
  const action = interaction.options.getString('acao');
  const input = interaction.options.getString('palavras');
  const settings = getAutomod(interaction.guildId);
  const current = readJson(settings.banned_words);

  if (action === 'list') {
    return interaction.reply({
      embeds: [
        current.length > 0
          ? embed
              .base(colors.primary)
              .setTitle('🚫 Palavras proibidas')
              .setDescription(truncate(current.map((word) => `\`${word}\``).join(', '), 4000))
              .setFooter({ text: `${current.length} palavra(s)` })
          : embed.info('Nenhuma palavra proibida configurada.'),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (action === 'clear') {
    setAutomod(interaction.guildId, { banned_words: '[]' });
    return interaction.reply({
      embeds: [embed.success('Lista de palavras proibidas limpa.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!input) return replyError(interaction, 'Informe as palavras separadas por vírgula.');

  const words = input
    .split(',')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);

  if (words.length === 0) return replyError(interaction, 'Nenhuma palavra válida informada.');

  const updated =
    action === 'add'
      ? [...new Set([...current, ...words])]
      : current.filter((word) => !words.includes(word));

  if (updated.length > MAX_WORDS) {
    return replyError(interaction, `A lista pode ter no máximo ${MAX_WORDS} palavras.`);
  }

  setAutomod(interaction.guildId, { banned_words: JSON.stringify(updated) });

  await interaction.reply({
    embeds: [
      embed.success(
        action === 'add'
          ? `${words.length} palavra(s) adicionada(s). Total: **${updated.length}**.`
          : `Lista atualizada. Total: **${updated.length}** palavra(s).`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function manageExemptions(interaction) {
  const action = interaction.options.getString('acao');
  const role = interaction.options.getRole('cargo');
  const channel = interaction.options.getChannel('canal');

  if (!role && !channel) {
    return replyError(interaction, 'Informe um cargo, um canal, ou os dois.');
  }

  const settings = getAutomod(interaction.guildId);
  const patch = {};

  if (role) {
    const roles = readJson(settings.ignored_roles);
    const updated =
      action === 'add'
        ? [...new Set([...roles, role.id])]
        : roles.filter((id) => id !== role.id);
    patch.ignored_roles = JSON.stringify(updated);
  }

  if (channel) {
    const channels = readJson(settings.ignored_channels);
    const updated =
      action === 'add'
        ? [...new Set([...channels, channel.id])]
        : channels.filter((id) => id !== channel.id);
    patch.ignored_channels = JSON.stringify(updated);
  }

  setAutomod(interaction.guildId, patch);

  await interaction.reply({
    embeds: [
      embed.success(
        action === 'add'
          ? `Adicionado à lista de isentos: ${[role, channel].filter(Boolean).join(' ')}`
          : `Removido da lista de isentos: ${[role, channel].filter(Boolean).join(' ')}`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}
