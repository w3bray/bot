import {
  InteractionContextType,
  MessageFlags,
  OAuth2Scopes,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { colors, config } from '../../config.js';
import { db } from '../../lib/db.js';
import { embed, replyError, truncate } from '../../lib/embeds.js';
import { logger } from '../../lib/logger.js';
import { ownerIds } from '../../lib/owner.js';
import { shardLabel, totalGuilds, totalMembers } from '../../lib/shard.js';
import { addBalance, formatMoney } from '../../services/economy.js';
import { levelFromXp, xpForLevel } from '../../services/leveling.js';

const PAGE_SIZE = 10;

export default {
  ownerOnly: true,
  // Vale em DM também: dá para administrar o bot sem estar em servidor nenhum.
  guildOnly: false,

  data: new SlashCommandBuilder()
    .setName('dono')
    .setDescription('Painel de controle do dono do bot.')
    // Some do menu de comandos de quem não é administrador do servidor. Não é a
    // trava — a trava é o ownerOnly, verificado no servidor a cada uso — mas
    // evita que o comando fique à vista de todo mundo convidando a tentativa.
    .setDefaultMemberPermissions(0n)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
    .addSubcommand((sub) =>
      sub
        .setName('servidores')
        .setDescription('Lista todos os servidores em que o bot está.')
        .addIntegerOption((option) =>
          option.setName('pagina').setDescription('Página da lista').setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('sair')
        .setDescription('Faz o bot sair de um servidor.')
        .addStringOption((option) =>
          option.setName('servidor').setDescription('ID do servidor').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('deploy')
        .setDescription('Registra os comandos de barra novamente.')
        .addStringOption((option) =>
          option
            .setName('escopo')
            .setDescription('Onde registrar')
            .setRequired(true)
            .addChoices(
              { name: 'Global — todos os servidores (até 1h para aparecer)', value: 'global' },
              { name: 'Aqui — só este servidor (instantâneo)', value: 'aqui' },
              { name: 'Limpar — remove os comandos deste servidor', value: 'limpar' },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('moedas')
        .setDescription('Cria ou remove moedas de alguém neste servidor.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('Quem recebe').setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('quantidade')
            .setDescription('Use um número negativo para remover')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('nivel')
        .setDescription('Define o nível de alguém neste servidor.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('Quem recebe').setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('nivel')
            .setDescription('Nível desejado (0 zera)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(500),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('convite').setDescription('Gera o link para adicionar o bot em qualquer servidor.'),
    )
    .addSubcommand((sub) => sub.setName('stats').setDescription('Números do bot em todos os shards.')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'servidores') return listGuilds(interaction, client);
    if (sub === 'sair') return leaveGuild(interaction, client);
    if (sub === 'deploy') return deploy(interaction, client);
    if (sub === 'moedas') return giveCoins(interaction);
    if (sub === 'nivel') return setLevel(interaction);
    if (sub === 'convite') return invite(interaction, client);
    if (sub === 'stats') return stats(interaction, client);
  },
};

/**
 * Todos os servidores, somando os shards.
 *
 * Com sharding cada processo só conhece os próprios servidores, então a lista
 * completa só existe juntando o resultado de todos via broadcastEval.
 */
async function allGuilds(client) {
  const local = () =>
    client.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      members: guild.memberCount,
    }));

  if (!client.shard) return local();

  try {
    const results = await client.shard.broadcastEval((instance) =>
      instance.guilds.cache.map((guild) => ({
        id: guild.id,
        name: guild.name,
        members: guild.memberCount,
      })),
    );
    return results.flat();
  } catch {
    // Algum shard ainda não respondeu: melhor a lista parcial do que erro.
    return local();
  }
}

async function listGuilds(interaction, client) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guilds = (await allGuilds(client)).sort((a, b) => b.members - a.members);
  const pages = Math.max(1, Math.ceil(guilds.length / PAGE_SIZE));
  const page = Math.min(interaction.options.getInteger('pagina') ?? 1, pages);
  const slice = guilds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const lines = slice.map(
    (guild, index) =>
      `**${(page - 1) * PAGE_SIZE + index + 1}.** ${guild.name}\n` +
      `└ \`${guild.id}\` · ${guild.members.toLocaleString('pt-BR')} membros`,
  );

  await interaction.editReply({
    embeds: [
      embed
        .base(colors.primary)
        .setTitle(`Servidores (${guilds.length})`)
        .setDescription(truncate(lines.join('\n') || '_Nenhum servidor._', 4096))
        .setFooter({ text: `Página ${page}/${pages} · /dono sair servidor:<id> para sair` }),
    ],
  });
}

async function leaveGuild(interaction, client) {
  const id = interaction.options.getString('servidor').trim();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // O servidor pode estar em outro shard, onde este processo não o enxerga.
  const leave = (instance, guildId) => {
    const guild = instance.guilds.cache.get(guildId);
    if (!guild) return null;
    const name = guild.name;
    return guild.leave().then(() => name);
  };

  try {
    let name = null;

    if (client.shard) {
      const results = await client.shard.broadcastEval(leave, { context: id });
      name = results.find(Boolean) ?? null;
    } else {
      name = await leave(client, id);
    }

    if (!name) return replyError(interaction, `Não estou em nenhum servidor com o ID \`${id}\`.`);

    logger.info(`Saí do servidor ${name} (${id}) a pedido de ${interaction.user.tag}.`);
    await interaction.editReply({ embeds: [embed.success(`Saí de **${name}** (\`${id}\`).`)] });
  } catch (error) {
    await replyError(interaction, `Não consegui sair: ${error.message}`);
  }
}

async function deploy(interaction, client) {
  const scope = interaction.options.getString('escopo');

  if (scope !== 'global' && !interaction.inGuild()) {
    return replyError(interaction, 'Esse escopo só funciona dentro de um servidor.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const body = scope === 'limpar' ? [] : client.commands.map((command) => command.data.toJSON());
  const route =
    scope === 'global'
      ? Routes.applicationCommands(config.clientId)
      : Routes.applicationGuildCommands(config.clientId, interaction.guildId);

  try {
    const rest = new REST().setToken(config.token);
    const result = await rest.put(route, { body });

    const description =
      scope === 'global'
        ? `**${result.length}** comandos registrados globalmente. Podem levar até **1 hora** para aparecer em todos os servidores.`
        : scope === 'limpar'
          ? 'Comandos deste servidor removidos. Os globais continuam valendo.'
          : `**${result.length}** comandos registrados neste servidor. Já estão valendo.`;

    await interaction.editReply({ embeds: [embed.success(description)] });
  } catch (error) {
    await replyError(interaction, `Falha ao registrar: ${error.message}`);
  }
}

async function giveCoins(interaction) {
  if (!interaction.inGuild()) {
    return replyError(interaction, 'A economia é por servidor — use este comando dentro de um.');
  }

  const user = interaction.options.getUser('usuario');
  const amount = interaction.options.getInteger('quantidade');
  const account = addBalance(interaction.guildId, user.id, amount);

  await interaction.reply({
    embeds: [
      embed.success(
        `${amount >= 0 ? 'Adicionei' : 'Removi'} **${formatMoney(Math.abs(amount))}** ` +
          `${amount >= 0 ? 'para' : 'de'} ${user}.\nSaldo agora: **${formatMoney(account.balance)}**.`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

const upsertLevel = db.prepare(`
  INSERT INTO levels (guild_id, user_id, xp, level)
  VALUES (@guild_id, @user_id, @xp, @level)
  ON CONFLICT (guild_id, user_id) DO UPDATE SET xp = @xp, level = @level
`);

async function setLevel(interaction) {
  if (!interaction.inGuild()) {
    return replyError(interaction, 'Os níveis são por servidor — use este comando dentro de um.');
  }

  const user = interaction.options.getUser('usuario');
  const level = interaction.options.getInteger('nivel');
  // Guardamos o XP exato do início do nível para o /rank continuar coerente.
  const xp = xpForLevel(level);

  upsertLevel.run({ guild_id: interaction.guildId, user_id: user.id, xp, level: levelFromXp(xp) });

  await interaction.reply({
    embeds: [
      embed.success(
        `${user} agora está no **nível ${level}** (${xp.toLocaleString('pt-BR')} XP).`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

// O conjunto sem Administrator: tudo que os 55 comandos precisam, e nada além.
const PERMISSOES_MINIMAS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.MentionEveryone,
];

async function invite(interaction, client) {
  const scopes = [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands];
  const completo = client.generateInvite({
    scopes,
    permissions: [PermissionFlagsBits.Administrator],
  });
  const minimo = client.generateInvite({ scopes, permissions: PERMISSOES_MINIMAS });

  await interaction.reply({
    embeds: [
      embed
        .base(colors.primary)
        .setTitle('Adicionar o bot a um servidor')
        .setDescription(
          [
            `**[Convidar com Administrador](${completo})**`,
            'Nada falha por falta de permissão. Use nos seus próprios servidores.',
            '',
            `**[Convidar com o mínimo necessário](${minimo})**`,
            'Só o que os comandos usam. Prefira este em servidor dos outros.',
            '',
            'Os dois valem para **quantos servidores você quiser** — não precisa cadastrar ID nenhum.',
            'Para os comandos aparecerem em todos, rode `/dono deploy escopo:Global` uma vez.',
          ].join('\n'),
        ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function stats(interaction, client) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [guilds, members] = await Promise.all([totalGuilds(client), totalMembers(client)]);
  const memory = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const uptime = Math.floor((Date.now() - client.uptime) / 1000);

  await interaction.editReply({
    embeds: [
      embed
        .base(colors.primary)
        .setTitle('Painel do dono')
        .addFields(
          {
            name: 'Alcance',
            value: `**${guilds.total}** servidores · **${members.total.toLocaleString('pt-BR')}** membros${guilds.partial ? '\n_(parcial: nem todo shard respondeu)_' : ''}`,
          },
          { name: 'Processo', value: `${shardLabel(client)} · ${memory} MB · ping ${client.ws.ping}ms` },
          { name: 'No ar desde', value: `<t:${uptime}:R>` },
          { name: 'Donos', value: ownerIds().map((id) => `<@${id}>`).join(' ') || '_nenhum_' },
        ),
    ],
  });
}
