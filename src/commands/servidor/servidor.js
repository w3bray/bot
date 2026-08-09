import { ChannelType, GuildVerificationLevel, PermissionFlagsBits } from 'discord.js';
import { colors } from '../../config.js';
import { embed, truncate } from '../../lib/embeds.js';
import { aviso, bloco, familia, opt } from '../../lib/familia.js';

const NIVEL = {
  [GuildVerificationLevel.None]: 'Nenhum',
  [GuildVerificationLevel.Low]: 'Baixo (e-mail verificado)',
  [GuildVerificationLevel.Medium]: 'Médio (5 min de conta)',
  [GuildVerificationLevel.High]: 'Alto (10 min no servidor)',
  [GuildVerificationLevel.VeryHigh]: 'Muito alto (telefone verificado)',
};

const lista = (itens, vazio = '_nenhum_') =>
  itens.length === 0 ? vazio : truncate(itens.join(' · '), 4000);

const paginado = (itens, pagina, porPagina = 30) => {
  const paginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(Math.max(pagina ?? 1, 1), paginas);
  return { fatia: itens.slice((atual - 1) * porPagina, atual * porPagina), atual, paginas };
};

const PAGINA = opt.inteiro('pagina', 'Qual página mostrar', false, { min: 1, max: 100 });

/** Membros do servidor, buscando no Discord se o cache estiver frio. */
async function membros(guild) {
  if (guild.members.cache.size < guild.memberCount) {
    await guild.members.fetch().catch(() => null);
  }
  return guild.members.cache;
}

export default familia({
  name: 'servidor',
  description: 'Informações, listagens e estatísticas do servidor.',
  cooldown: 5,
  dm: false,
  subs: [
    {
      name: 'resumo',
      description: 'Visão geral do servidor.',
      run: async (_, interaction) => {
        const { guild } = interaction;
        const canais = guild.channels.cache;
        const dono = await guild.fetchOwner().catch(() => null);
        return {
          embeds: [
            embed
              .base(colors.primary)
              .setTitle(guild.name)
              .setThumbnail(guild.iconURL({ size: 256 }))
              .addFields(
                { name: 'Dono', value: dono ? `${dono.user.tag}` : '—', inline: true },
                { name: 'Membros', value: `${guild.memberCount.toLocaleString('pt-BR')}`, inline: true },
                { name: 'Criado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                {
                  name: 'Canais',
                  value: `${canais.filter((c) => c.type === ChannelType.GuildText).size} texto · ${canais.filter((c) => c.type === ChannelType.GuildVoice).size} voz · ${canais.filter((c) => c.type === ChannelType.GuildCategory).size} categorias`,
                  inline: true,
                },
                { name: 'Cargos', value: `${guild.roles.cache.size - 1}`, inline: true },
                { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true },
                { name: 'Verificação', value: NIVEL[guild.verificationLevel] ?? '—', inline: true },
                { name: 'Impulsos', value: `${guild.premiumSubscriptionCount ?? 0} (nível ${guild.premiumTier})`, inline: true },
                { name: 'ID', value: `\`${guild.id}\``, inline: true },
              ),
          ],
        };
      },
    },
    {
      name: 'icone',
      description: 'Mostra o ícone do servidor em tamanho grande.',
      run: (_, interaction) => {
        const url = interaction.guild.iconURL({ size: 1024 });
        if (!url) throw aviso('Este servidor não tem ícone.');
        return { embeds: [embed.base(colors.primary).setTitle(interaction.guild.name).setImage(url)] };
      },
    },
    {
      name: 'banner',
      description: 'Mostra o banner do servidor.',
      run: (_, interaction) => {
        const url = interaction.guild.bannerURL({ size: 1024 });
        if (!url) throw aviso('Este servidor não tem banner.');
        return { embeds: [embed.base(colors.primary).setImage(url)] };
      },
    },
    {
      name: 'cargos',
      description: 'Lista os cargos do servidor.',
      options: [PAGINA],
      run: ({ pagina }, interaction) => {
        const todos = [...interaction.guild.roles.cache.values()]
          .filter((r) => r.id !== interaction.guild.id)
          .sort((a, b) => b.position - a.position)
          .map((r) => `${r} (${r.members.size})`);
        const { fatia, atual, paginas } = paginado(todos, pagina);
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle(`Cargos (${todos.length})`)
              .setDescription(lista(fatia))
              .setFooter({ text: `Página ${atual}/${paginas}` }),
          ],
        };
      },
    },
    {
      name: 'canais',
      description: 'Lista os canais do servidor, por categoria.',
      run: (_, interaction) => {
        const canais = interaction.guild.channels.cache;
        const categorias = [...canais.filter((c) => c.type === ChannelType.GuildCategory).values()]
          .sort((a, b) => a.position - b.position);

        const bloco = (filhos) =>
          filhos
            .sort((a, b) => a.position - b.position)
            .map((c) => `${c.type === ChannelType.GuildVoice ? '🔊' : '#'} ${c.name}`)
            .join('\n') || '_vazia_';

        const soltos = [...canais.filter((c) => !c.parentId && c.type !== ChannelType.GuildCategory).values()];
        const campos = categorias.slice(0, 20).map((cat) => ({
          name: cat.name,
          value: truncate(bloco([...canais.filter((c) => c.parentId === cat.id).values()]), 1024),
          inline: true,
        }));
        if (soltos.length > 0) {
          campos.unshift({ name: 'Sem categoria', value: truncate(bloco(soltos), 1024), inline: true });
        }
        return {
          embeds: [
            embed.base(colors.primary).setTitle(`Canais (${canais.size})`).addFields(campos.slice(0, 25)),
          ],
        };
      },
    },
    {
      name: 'emojis',
      description: 'Lista os emojis do servidor.',
      options: [PAGINA],
      run: ({ pagina }, interaction) => {
        const todos = [...interaction.guild.emojis.cache.values()].map((e) => `${e}`);
        if (todos.length === 0) throw aviso('Este servidor não tem emojis próprios.');
        const { fatia, atual, paginas } = paginado(todos, pagina, 60);
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle(`Emojis (${todos.length})`)
              .setDescription(lista(fatia))
              .setFooter({ text: `Página ${atual}/${paginas}` }),
          ],
        };
      },
    },
    {
      name: 'emoji-info',
      description: 'Detalhes de um emoji do servidor.',
      options: [opt.texto('emoji', 'Cole o emoji aqui', true, { max: 100 })],
      run: ({ emoji }, interaction) => {
        const id = /<a?:\w+:(\d+)>/.exec(emoji)?.[1];
        const achado = id && interaction.guild.emojis.cache.get(id);
        if (!achado) throw aviso('Esse emoji não é deste servidor (ou é um emoji padrão do Discord).');
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle(`:${achado.name}:`)
              .setThumbnail(achado.imageURL({ size: 256 }))
              .addFields(
                { name: 'ID', value: `\`${achado.id}\``, inline: true },
                { name: 'Animado', value: achado.animated ? 'sim' : 'não', inline: true },
                { name: 'Criado', value: `<t:${Math.floor(achado.createdTimestamp / 1000)}:D>`, inline: true },
                { name: 'Para usar', value: `\`${achado}\`` },
              ),
          ],
        };
      },
    },
    {
      name: 'impulsos',
      description: 'Quem impulsiona o servidor.',
      run: async (_, interaction) => {
        const todos = await membros(interaction.guild);
        const boosters = [...todos.filter((m) => m.premiumSince).values()]
          .sort((a, b) => a.premiumSince - b.premiumSince);
        return {
          embeds: [
            embed.base(0xf47fff)
              .setTitle(`Impulsos: ${interaction.guild.premiumSubscriptionCount ?? 0} (nível ${interaction.guild.premiumTier})`)
              .setDescription(
                lista(
                  boosters.slice(0, 40).map((m) => `${m} desde <t:${Math.floor(m.premiumSince / 1000)}:d>`),
                  '_Ninguém impulsiona este servidor no momento._',
                ),
              ),
          ],
        };
      },
    },
    {
      name: 'bots',
      description: 'Lista os bots do servidor.',
      run: async (_, interaction) => {
        const todos = await membros(interaction.guild);
        const bots = [...todos.filter((m) => m.user.bot).values()];
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle(`Bots (${bots.length})`)
              .setDescription(lista(bots.map((m) => `${m}`))),
          ],
        };
      },
    },
    {
      name: 'novatos',
      description: 'Quem entrou por último no servidor.',
      options: [opt.inteiro('quantidade', 'Quantos mostrar', false, { min: 1, max: 25 })],
      run: async ({ quantidade }, interaction) => {
        const todos = await membros(interaction.guild);
        const recentes = [...todos.values()]
          .filter((m) => m.joinedTimestamp)
          .sort((a, b) => b.joinedTimestamp - a.joinedTimestamp)
          .slice(0, quantidade ?? 10);
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle('Entraram por último')
              .setDescription(
                recentes.map((m, i) => `**${i + 1}.** ${m} — <t:${Math.floor(m.joinedTimestamp / 1000)}:R>`).join('\n'),
              ),
          ],
        };
      },
    },
    {
      name: 'veteranos',
      description: 'Quem está há mais tempo no servidor.',
      options: [opt.inteiro('quantidade', 'Quantos mostrar', false, { min: 1, max: 25 })],
      run: async ({ quantidade }, interaction) => {
        const todos = await membros(interaction.guild);
        const antigos = [...todos.values()]
          .filter((m) => m.joinedTimestamp)
          .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
          .slice(0, quantidade ?? 10);
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle('Estão aqui há mais tempo')
              .setDescription(
                antigos.map((m, i) => `**${i + 1}.** ${m} — desde <t:${Math.floor(m.joinedTimestamp / 1000)}:D>`).join('\n'),
              ),
          ],
        };
      },
    },
    {
      name: 'sem-cargo',
      description: 'Membros que não têm nenhum cargo.',
      run: async (_, interaction) => {
        const todos = await membros(interaction.guild);
        const nus = [...todos.filter((m) => m.roles.cache.size === 1 && !m.user.bot).values()];
        return {
          embeds: [
            embed.base(colors.warning)
              .setTitle(`Sem cargo (${nus.length})`)
              .setDescription(lista(nus.slice(0, 50).map((m) => `${m}`), '_Todo mundo tem pelo menos um cargo._')),
          ],
        };
      },
    },
    {
      name: 'com-cargo',
      description: 'Quem tem um cargo específico.',
      options: [opt.cargo('cargo', 'O cargo', true)],
      run: ({ cargo }, interaction) => {
        const membrosDoCargo = interaction.guild.roles.cache.get(cargo.id)?.members ?? new Map();
        const nomes = [...membrosDoCargo.values()].map((m) => `${m}`);
        return {
          embeds: [
            embed.base(cargo.color || colors.primary)
              .setTitle(`${cargo.name} — ${nomes.length} membro(s)`)
              .setDescription(lista(nomes.slice(0, 50))),
          ],
        };
      },
    },
    {
      name: 'cargo-info',
      description: 'Detalhes de um cargo.',
      options: [opt.cargo('cargo', 'O cargo', true)],
      run: ({ cargo }) => {
        const permissoes = cargo.permissions.toArray();
        return {
          embeds: [
            embed.base(cargo.color || colors.neutral)
              .setTitle(cargo.name)
              .addFields(
                { name: 'ID', value: `\`${cargo.id}\``, inline: true },
                { name: 'Cor', value: cargo.hexColor, inline: true },
                { name: 'Membros', value: `${cargo.members.size}`, inline: true },
                { name: 'Posição', value: `${cargo.position}`, inline: true },
                { name: 'Separado', value: cargo.hoist ? 'sim' : 'não', inline: true },
                { name: 'Mencionável', value: cargo.mentionable ? 'sim' : 'não', inline: true },
                { name: 'Criado', value: `<t:${Math.floor(cargo.createdTimestamp / 1000)}:D>`, inline: true },
                {
                  name: `Permissões (${permissoes.length})`,
                  value: truncate(permissoes.length ? permissoes.map((p) => `\`${p}\``).join(' ') : '_nenhuma_', 1024),
                },
              ),
          ],
        };
      },
    },
    {
      name: 'canal-info',
      description: 'Detalhes de um canal.',
      options: [opt.canal('canal', 'O canal (padrão: este)', false)],
      run: ({ canal }, interaction) => {
        const alvo = canal ?? interaction.channel;
        const tipos = {
          [ChannelType.GuildText]: 'Texto',
          [ChannelType.GuildVoice]: 'Voz',
          [ChannelType.GuildCategory]: 'Categoria',
          [ChannelType.GuildAnnouncement]: 'Anúncios',
          [ChannelType.GuildForum]: 'Fórum',
          [ChannelType.GuildStageVoice]: 'Palco',
        };
        const campos = [
          { name: 'ID', value: `\`${alvo.id}\``, inline: true },
          { name: 'Tipo', value: tipos[alvo.type] ?? `${alvo.type}`, inline: true },
          { name: 'Criado', value: `<t:${Math.floor(alvo.createdTimestamp / 1000)}:D>`, inline: true },
        ];
        if (alvo.parent) campos.push({ name: 'Categoria', value: alvo.parent.name, inline: true });
        if (alvo.rateLimitPerUser) campos.push({ name: 'Modo lento', value: `${alvo.rateLimitPerUser}s`, inline: true });
        if (alvo.nsfw !== undefined) campos.push({ name: 'NSFW', value: alvo.nsfw ? 'sim' : 'não', inline: true });
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle(`#${alvo.name}`)
              .setDescription(alvo.topic ? truncate(alvo.topic, 500) : null)
              .addFields(campos),
          ],
        };
      },
    },
    {
      name: 'estatisticas',
      description: 'Distribuição de membros, bots e status.',
      run: async (_, interaction) => {
        const todos = await membros(interaction.guild);
        const bots = todos.filter((m) => m.user.bot).size;
        const humanos = todos.size - bots;
        const barra = (n, total) => {
          const pct = total === 0 ? 0 : (n / total) * 100;
          return `\`${'█'.repeat(Math.round(pct / 5)).padEnd(20, '░')}\` ${pct.toFixed(1)}%`;
        };
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle(`Estatísticas de ${interaction.guild.name}`)
              .addFields(
                { name: `Humanos — ${humanos}`, value: barra(humanos, todos.size) },
                { name: `Bots — ${bots}`, value: barra(bots, todos.size) },
                {
                  name: 'Cargos mais populares',
                  value:
                    [...interaction.guild.roles.cache.values()]
                      .filter((r) => r.id !== interaction.guild.id)
                      .sort((a, b) => b.members.size - a.members.size)
                      .slice(0, 5)
                      .map((r) => `${r} — ${r.members.size}`)
                      .join('\n') || '_nenhum_',
                },
              ),
          ],
        };
      },
    },
    {
      name: 'idade',
      description: 'Há quanto tempo o servidor existe.',
      run: (_, interaction) => {
        const { guild } = interaction;
        const dias = Math.floor((Date.now() - guild.createdTimestamp) / 86_400_000);
        return [
          `**${guild.name}** foi criado <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
          `Isso faz **${dias.toLocaleString('pt-BR')}** dias — <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
          `Em média, **${(guild.memberCount / Math.max(1, dias)).toFixed(2)}** membros novos por dia`,
        ].join('\n');
      },
    },
    {
      name: 'recursos',
      description: 'Recursos especiais liberados neste servidor.',
      run: (_, interaction) => {
        const recursos = interaction.guild.features;
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle(`Recursos (${recursos.length})`)
              .setDescription(lista(recursos.map((f) => `\`${f}\``), '_Nenhum recurso especial._')),
          ],
        };
      },
    },
    {
      name: 'minhas-permissoes',
      description: 'O que você pode fazer neste canal.',
      run: (_, interaction) => {
        const permissoes = interaction.channel.permissionsFor(interaction.member);
        const tem = permissoes.toArray();
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle(`Suas permissões em #${interaction.channel.name}`)
              .setDescription(truncate(tem.map((p) => `\`${p}\``).join(' '), 4000)),
          ],
        };
      },
    },
    {
      name: 'permissoes-bot',
      description: 'O que o bot pode fazer neste canal.',
      run: (_, interaction) => {
        const eu = interaction.guild.members.me;
        const aqui = interaction.channel.permissionsFor(eu);
        const importantes = [
          ['Ver Canal', PermissionFlagsBits.ViewChannel],
          ['Enviar Mensagens', PermissionFlagsBits.SendMessages],
          ['Inserir Links', PermissionFlagsBits.EmbedLinks],
          ['Anexar Arquivos', PermissionFlagsBits.AttachFiles],
          ['Gerenciar Mensagens', PermissionFlagsBits.ManageMessages],
          ['Gerenciar Canais', PermissionFlagsBits.ManageChannels],
          ['Gerenciar Cargos', PermissionFlagsBits.ManageRoles],
          ['Expulsar Membros', PermissionFlagsBits.KickMembers],
          ['Banir Membros', PermissionFlagsBits.BanMembers],
          ['Moderar Membros', PermissionFlagsBits.ModerateMembers],
        ];
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle('Permissões do bot neste canal')
              .setDescription(
                importantes.map(([nome, flag]) => `${aqui.has(flag) ? '✅' : '❌'} ${nome}`).join('\n'),
              )
              .setFooter({ text: `Posição do meu cargo: ${eu.roles.highest.position}` }),
          ],
        };
      },
    },
    {
      name: 'convites',
      description: 'Convites ativos do servidor.',
      run: async (_, interaction) => {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          throw aviso('Só quem tem **Gerenciar Servidor** pode ver os convites.');
        }
        const convites = await interaction.guild.invites.fetch().catch(() => null);
        if (!convites) throw aviso('Não consegui ler os convites — falta a permissão **Gerenciar Servidor** para o bot.');
        const linhas = [...convites.values()]
          .sort((a, b) => b.uses - a.uses)
          .slice(0, 20)
          .map((c) => `\`${c.code}\` — ${c.uses} uso(s) · ${c.inviter ? c.inviter.tag : 'desconhecido'}`);
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle(`Convites ativos (${convites.size})`)
              .setDescription(lista(linhas, '_Nenhum convite ativo._')),
          ],
        };
      },
    },
    {
      name: 'banidos',
      description: 'Lista quem está banido.',
      options: [PAGINA],
      run: async ({ pagina }, interaction) => {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
          throw aviso('Só quem tem **Banir Membros** pode ver essa lista.');
        }
        const bans = await interaction.guild.bans.fetch().catch(() => null);
        if (!bans) throw aviso('Não consegui ler a lista — falta a permissão **Banir Membros** para o bot.');
        const linhas = [...bans.values()].map((b) => `\`${b.user.tag}\` — ${b.reason ?? 'sem motivo'}`);
        const { fatia, atual, paginas } = paginado(linhas, pagina, 15);
        return {
          embeds: [
            embed.base(colors.danger)
              .setTitle(`Banidos (${linhas.length})`)
              .setDescription(fatia.join('\n') || '_Ninguém banido._')
              .setFooter({ text: `Página ${atual}/${paginas}` }),
          ],
        };
      },
    },
    {
      name: 'id',
      description: 'Mostra os IDs do servidor e deste canal.',
      run: (_, interaction) =>
        bloco(
          [
            `Servidor: ${interaction.guild.id}`,
            `Canal:    ${interaction.channel.id}`,
            `Você:     ${interaction.user.id}`,
          ].join('\n'),
        ),
    },
    {
      name: 'contagem',
      description: 'Contagem rápida de tudo no servidor.',
      run: (_, interaction) => {
        const { guild } = interaction;
        const c = guild.channels.cache;
        return bloco(
          [
            `Membros ......... ${guild.memberCount}`,
            `Cargos .......... ${guild.roles.cache.size - 1}`,
            `Emojis .......... ${guild.emojis.cache.size}`,
            `Figurinhas ...... ${guild.stickers.cache.size}`,
            `Canais de texto . ${c.filter((x) => x.type === ChannelType.GuildText).size}`,
            `Canais de voz ... ${c.filter((x) => x.type === ChannelType.GuildVoice).size}`,
            `Categorias ...... ${c.filter((x) => x.type === ChannelType.GuildCategory).size}`,
            `Impulsos ........ ${guild.premiumSubscriptionCount ?? 0}`,
          ].join('\n'),
        );
      },
    },
  ],
});
