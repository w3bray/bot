import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db, getGuildConfig, setGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';

const TEXT_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configura os recursos do bot neste servidor.')
    .addSubcommand((sub) => sub.setName('ver').setDescription('Mostra a configuração atual.'))
    .addSubcommand((sub) =>
      sub
        .setName('logs')
        .setDescription('Define os canais de log.')
        .addStringOption((option) =>
          option
            .setName('tipo')
            .setDescription('Qual log configurar')
            .setRequired(true)
            .addChoices(
              { name: 'Moderação (punições)', value: 'mod_log_channel' },
              { name: 'Servidor (entradas, saídas, mensagens)', value: 'server_log_channel' },
            ),
        )
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal de destino (vazio para desativar)')
            .addChannelTypes(...TEXT_CHANNELS),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('boasvindas')
        .setDescription('Configura a mensagem de entrada.')
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal das boas-vindas (vazio para desativar)')
            .addChannelTypes(...TEXT_CHANNELS),
        )
        .addStringOption((option) =>
          option
            .setName('mensagem')
            .setDescription('Use {user}, {username}, {tag}, {server}, {count}')
            .setMaxLength(1000),
        )
        .addBooleanOption((option) =>
          option.setName('desativar').setDescription('Desliga as mensagens de entrada'),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('saida')
        .setDescription('Configura a mensagem de saída.')
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal de despedida')
            .addChannelTypes(...TEXT_CHANNELS),
        )
        .addStringOption((option) =>
          option
            .setName('mensagem')
            .setDescription('Use {user}, {username}, {tag}, {server}, {count}')
            .setMaxLength(1000),
        )
        .addBooleanOption((option) =>
          option.setName('desativar').setDescription('Desliga as mensagens de saída'),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('autorole')
        .setDescription('Cargo dado automaticamente a quem entra.')
        .addRoleOption((option) =>
          option.setName('cargo').setDescription('Cargo (vazio para desativar)'),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('niveis')
        .setDescription('Configura o sistema de níveis.')
        .addBooleanOption((option) =>
          option.setName('ativar').setDescription('Ligar ou desligar o ganho de XP'),
        )
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal dos anúncios de nível (vazio: no próprio canal)')
            .addChannelTypes(...TEXT_CHANNELS),
        )
        .addStringOption((option) =>
          option
            .setName('mensagem')
            .setDescription('Use {user}, {username}, {level}, {server}')
            .setMaxLength(500),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('recompensa')
        .setDescription('Cargo entregue ao alcançar um nível.')
        .addIntegerOption((option) =>
          option
            .setName('nivel')
            .setDescription('Nível necessário')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(500),
        )
        .addRoleOption((option) =>
          option.setName('cargo').setDescription('Cargo a entregar (vazio para remover a regra)'),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('starboard')
        .setDescription('Mural das mensagens mais estreladas.')
        .addChannelOption((option) =>
          option
            .setName('canal')
            .setDescription('Canal do starboard (vazio para desativar)')
            .addChannelTypes(...TEXT_CHANNELS),
        )
        .addIntegerOption((option) =>
          option
            .setName('minimo')
            .setDescription('Quantas ⭐ para aparecer (padrão: 3)')
            .setMinValue(1)
            .setMaxValue(50),
        )
        .addBooleanOption((option) =>
          option.setName('desativar').setDescription('Desliga o starboard'),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('tickets')
        .setDescription('Configura o sistema de tickets.')
        .addChannelOption((option) =>
          option
            .setName('categoria')
            .setDescription('Categoria onde os tickets serão criados')
            .addChannelTypes(ChannelType.GuildCategory),
        )
        .addRoleOption((option) =>
          option.setName('cargo').setDescription('Cargo da equipe de atendimento'),
        )
        .addChannelOption((option) =>
          option
            .setName('log')
            .setDescription('Canal que recebe as transcrições')
            .addChannelTypes(...TEXT_CHANNELS),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('moeda')
        .setDescription('Muda o nome da moeda da economia.')
        .addStringOption((option) =>
          option
            .setName('nome')
            .setDescription('Ex.: moedas, créditos, pontos')
            .setRequired(true)
            .setMaxLength(20),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const handlers = {
      ver: showConfig,
      logs: setLogs,
      boasvindas: (i) => setGreeting(i, 'welcome'),
      saida: (i) => setGreeting(i, 'goodbye'),
      autorole: setAutorole,
      niveis: setLevels,
      recompensa: setReward,
      starboard: setStarboard,
      tickets: setTickets,
      moeda: setCurrency,
    };

    return handlers[interaction.options.getSubcommand()](interaction);
  },
};

function channelMention(id) {
  return id ? `<#${id}>` : '*desativado*';
}

async function showConfig(interaction) {
  const settings = getGuildConfig(interaction.guildId);
  const rewards = db
    .prepare('SELECT * FROM level_rewards WHERE guild_id = ? ORDER BY level')
    .all(interaction.guildId);

  await interaction.reply({
    embeds: [
      embed
        .base(colors.primary)
        .setTitle(`⚙️ Configuração de ${interaction.guild.name}`)
        .addFields(
          {
            name: '📋 Logs',
            value: [
              `Moderação: ${channelMention(settings.mod_log_channel)}`,
              `Servidor: ${channelMention(settings.server_log_channel)}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '👋 Entrada e saída',
            value: [
              `Boas-vindas: ${channelMention(settings.welcome_channel)}`,
              `Saída: ${channelMention(settings.goodbye_channel)}`,
              `Autorole: ${settings.autorole ? `<@&${settings.autorole}>` : '*desativado*'}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '📈 Níveis',
            value: [
              `Estado: ${settings.levels_enabled ? 'ativo' : 'desativado'}`,
              `Anúncios: ${settings.levels_channel ? channelMention(settings.levels_channel) : '*canal da mensagem*'}`,
              `XP por mensagem: ${settings.xp_min}–${settings.xp_max}`,
              `Recompensas: ${rewards.length > 0 ? rewards.map((r) => `nível ${r.level} → <@&${r.role_id}>`).join(', ') : '*nenhuma*'}`,
            ].join('\n'),
          },
          {
            name: '⭐ Starboard',
            value: `${channelMention(settings.starboard_channel)} · mínimo de ${settings.starboard_min} ⭐`,
            inline: true,
          },
          {
            name: '🎫 Tickets',
            value: [
              `Categoria: ${settings.ticket_category ? `<#${settings.ticket_category}>` : '*nenhuma*'}`,
              `Equipe: ${settings.ticket_role ? `<@&${settings.ticket_role}>` : '*nenhuma*'}`,
              `Transcrições: ${channelMention(settings.ticket_log)}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🪙 Economia',
            value: `Moeda: **${settings.currency_name}**`,
            inline: true,
          },
        )
        .setFooter({ text: 'Use /automod ver para as regras de moderação automática.' }),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function setLogs(interaction) {
  const column = interaction.options.getString('tipo');
  const channel = interaction.options.getChannel('canal');

  setGuildConfig(interaction.guildId, { [column]: channel?.id ?? null });

  const label = column === 'mod_log_channel' ? 'moderação' : 'servidor';
  await interaction.reply({
    embeds: [
      embed.success(
        channel
          ? `Log de **${label}** definido para ${channel}.`
          : `Log de **${label}** desativado.`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function setGreeting(interaction, kind) {
  const channel = interaction.options.getChannel('canal');
  const message = interaction.options.getString('mensagem');
  const disable = interaction.options.getBoolean('desativar') ?? false;
  const label = kind === 'welcome' ? 'boas-vindas' : 'saída';

  if (disable) {
    setGuildConfig(interaction.guildId, { [`${kind}_channel`]: null });
    return interaction.reply({
      embeds: [embed.success(`Mensagens de **${label}** desativadas.`)],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!channel && !message) {
    return replyError(
      interaction,
      'Informe o canal, a mensagem, ou use `desativar: true` para desligar.',
    );
  }

  const patch = {};
  if (channel) patch[`${kind}_channel`] = channel.id;
  if (message) patch[`${kind}_message`] = message;
  setGuildConfig(interaction.guildId, patch);

  const current = getGuildConfig(interaction.guildId);
  await interaction.reply({
    embeds: [
      embed
        .success(`Mensagem de **${label}** atualizada.`)
        .addFields(
          {
            name: 'Canal',
            value: channelMention(current[`${kind}_channel`]),
            inline: true,
          },
          ...(message ? [{ name: 'Modelo', value: message }] : []),
        ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function setAutorole(interaction) {
  const role = interaction.options.getRole('cargo');

  if (role) {
    if (role.managed) {
      return replyError(interaction, 'Esse cargo é gerenciado por uma integração e não pode ser atribuído.');
    }
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return replyError(interaction, 'Esse cargo está acima do meu — não conseguirei entregá-lo.');
    }
  }

  setGuildConfig(interaction.guildId, { autorole: role?.id ?? null });

  await interaction.reply({
    embeds: [
      embed.success(
        role ? `Novos membros receberão o cargo ${role}.` : 'Autorole desativado.',
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function setLevels(interaction) {
  const enabled = interaction.options.getBoolean('ativar');
  const channel = interaction.options.getChannel('canal');
  const message = interaction.options.getString('mensagem');

  const patch = {};
  if (enabled !== null) patch.levels_enabled = enabled ? 1 : 0;
  if (channel) patch.levels_channel = channel.id;
  if (message) patch.levels_message = message;

  if (Object.keys(patch).length === 0) {
    return replyError(interaction, 'Informe pelo menos uma opção para alterar.');
  }

  setGuildConfig(interaction.guildId, patch);

  await interaction.reply({
    embeds: [embed.success('Configuração de níveis atualizada.')],
    flags: MessageFlags.Ephemeral,
  });
}

async function setReward(interaction) {
  const level = interaction.options.getInteger('nivel');
  const role = interaction.options.getRole('cargo');

  if (!role) {
    const result = db
      .prepare('DELETE FROM level_rewards WHERE guild_id = ? AND level = ?')
      .run(interaction.guildId, level);

    return interaction.reply({
      embeds: [
        result.changes > 0
          ? embed.success(`Recompensa do nível **${level}** removida.`)
          : embed.warning(`Não havia recompensa configurada para o nível ${level}.`),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (role.position >= interaction.guild.members.me.roles.highest.position) {
    return replyError(interaction, 'Esse cargo está acima do meu — não conseguirei entregá-lo.');
  }

  db.prepare(
    `INSERT INTO level_rewards (guild_id, level, role_id) VALUES (?, ?, ?)
     ON CONFLICT (guild_id, level) DO UPDATE SET role_id = excluded.role_id`,
  ).run(interaction.guildId, level, role.id);

  await interaction.reply({
    embeds: [embed.success(`Quem alcançar o nível **${level}** receberá o cargo ${role}.`)],
    flags: MessageFlags.Ephemeral,
  });
}

async function setStarboard(interaction) {
  const channel = interaction.options.getChannel('canal');
  const minimum = interaction.options.getInteger('minimo');
  const disable = interaction.options.getBoolean('desativar') ?? false;

  if (disable) {
    setGuildConfig(interaction.guildId, { starboard_channel: null });
    return interaction.reply({
      embeds: [embed.success('Starboard desativado.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!channel && !minimum) {
    return replyError(
      interaction,
      'Informe o canal, o mínimo de estrelas, ou use `desativar: true`.',
    );
  }

  const patch = {};
  if (channel) patch.starboard_channel = channel.id;
  if (minimum) patch.starboard_min = minimum;
  setGuildConfig(interaction.guildId, patch);

  const current = getGuildConfig(interaction.guildId);
  await interaction.reply({
    embeds: [
      embed.success(
        current.starboard_channel
          ? `Starboard ativo em <#${current.starboard_channel}> com mínimo de **${current.starboard_min}** ⭐.`
          : `Mínimo definido em **${current.starboard_min}** ⭐. Defina um canal para ativar.`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function setTickets(interaction) {
  const category = interaction.options.getChannel('categoria');
  const role = interaction.options.getRole('cargo');
  const log = interaction.options.getChannel('log');

  const patch = {};
  if (category) patch.ticket_category = category.id;
  if (role) patch.ticket_role = role.id;
  if (log) patch.ticket_log = log.id;

  if (Object.keys(patch).length === 0) {
    return replyError(interaction, 'Informe pelo menos uma opção para alterar.');
  }

  setGuildConfig(interaction.guildId, patch);

  await interaction.reply({
    embeds: [
      embed.success('Configuração de tickets atualizada. Publique o painel com `/ticket painel`.'),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function setCurrency(interaction) {
  const name = interaction.options.getString('nome').trim();
  setGuildConfig(interaction.guildId, { currency_name: name });

  await interaction.reply({
    embeds: [embed.success(`A moeda do servidor agora se chama **${name}**.`)],
    flags: MessageFlags.Ephemeral,
  });
}
