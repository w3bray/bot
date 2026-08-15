import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { isOwner } from '../../lib/owner.js';
import { rotasDoComando } from '../../lib/rotas.js';
import { nomeLocalizado, nomePtBr, semAcentos } from '../../lib/localizacao.js';

const CATEGORIES = {
  moderacao: { label: '🛡️ Moderação', order: 1 },
  automod: { label: '🤖 Moderação automática', order: 2 },
  configuracao: { label: '⚙️ Configuração', order: 3 },
  servidor: { label: '🏗️ Servidor', order: 4 },
  texto: { label: '✍️ Texto e código', order: 5 },
  utilidades: { label: '🔧 Utilidades', order: 6 },
  social: { label: '💞 Social', order: 7 },
  niveis: { label: '📈 Níveis', order: 8 },
  economia: { label: '🪙 Economia', order: 9 },
  jogos: { label: '🎮 Jogos', order: 10 },
  diversao: { label: '🎲 Sorteios e lazer', order: 11 },
  sorteios: { label: '🎉 Sorteios', order: 12 },
  tickets: { label: '🎫 Atendimento', order: 13 },
  ia: { label: '🧠 Inteligência Artificial', order: 14 },
  dono: { label: '👑 Dono do bot', order: 15 },
};

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Lista os comandos disponíveis.')
    .addStringOption((option) =>
      option
        .setName('comando')
        .setDescription('Ver detalhes de um comando específico')
        .setAutocomplete(true),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async autocomplete(interaction, client) {
    const focused = semAcentos(interaction.options.getFocused());
    const choices = [...client.commands.keys()]
      .filter((name) => semAcentos(nomePtBr(name)).includes(focused))
      .slice(0, 25)
      .map((name) => ({ name: `/${nomePtBr(name)}`, value: name }));

    await interaction.respond(choices);
  },

  async execute(interaction, client) {
    const requested = interaction.options.getString('comando');
    if (requested) return showCommand(interaction, client, requested);

    const owner = isOwner(interaction.user.id);
    const grouped = new Map();
    let principalCount = 0;
    let routeCount = 0;

    for (const command of client.commands.values()) {
      // Comandos de dono só aparecem para quem pode usá-los.
      if (command.ownerOnly && !owner) continue;

      const category = command.category ?? 'utilidades';
      const routes = rotasDoComando(command, 'pt-BR');

      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(...routes);
      principalCount += 1;
      routeCount += routes.length;
    }

    const sections = [...grouped.entries()]
      .sort((a, b) => (CATEGORIES[a[0]]?.order ?? 99) - (CATEGORIES[b[0]]?.order ?? 99))
      .map(([category, routes]) => ({
        label: CATEGORIES[category]?.label ?? category,
        routes: routes.sort((a, b) => a.localeCompare(b, 'pt-BR')),
      }));
    const pages = paginateRouteSections(sections);

    if (pages.length === 0) {
      return replyError(interaction, 'Nenhum comando está disponível para você.');
    }

    const intro = [
      `**${principalCount} comandos principais · ${routeCount} rotas executáveis**`,
      'A lista abaixo inclui literalmente cada comando, subcomando e grupo disponível.',
      'Use `/ajuda comando:<nome>` para ver detalhes e opções de um comando principal.',
    ].join('\n');

    for (let index = 0; index < pages.length; index += 1) {
      const help = embed
        .base(colors.primary)
        .setTitle(`Comandos de ${client.user.username} · Página ${index + 1}/${pages.length}`)
        .setDescription(index === 0 ? `${intro}\n\n${pages[index]}` : pages[index])
        .setFooter({ text: 'Alguns comandos exigem permissões específicas.' });

      if (index === 0) help.setThumbnail(client.user.displayAvatarURL({ size: 256 }));

      const payload = { embeds: [help], flags: MessageFlags.Ephemeral };
      if (index === 0) await interaction.reply(payload);
      else await interaction.followUp(payload);
    }
  },
};

function paginateRouteSections(sections, maxLength = 3500) {
  const pages = [];
  let current = '';

  const flush = () => {
    const page = current.trim();
    if (page) pages.push(page);
    current = '';
  };

  for (const section of sections) {
    const heading = `### ${section.label} (${section.routes.length} rotas)\n`;

    if (current && current.length + heading.length > maxLength) flush();
    current += heading;

    for (const route of section.routes) {
      const token = `\`${route}\` `;

      if (current.length + token.length > maxLength) {
        flush();
        current = `### ${section.label} (continuação)\n`;
      }

      current += token;
    }

    current = `${current.trimEnd()}\n\n`;
  }

  flush();
  return pages;
}

async function showCommand(interaction, client, name) {
  const nomeInterno = client.commands.has(name)
    ? name
    : [...client.commands.keys()].find(
        (candidate) => semAcentos(nomePtBr(candidate)) === semAcentos(name),
      );
  const command = client.commands.get(nomeInterno);
  if (!command) return replyError(interaction, `O comando \`/${name}\` não existe.`);

  const json = command.data.toJSON();
  const nomeComando = nomeLocalizado(json);
  const detail = embed
    .base(colors.primary)
    .setTitle(`/${nomeComando}`)
    .setDescription(json.description)
    .addFields({
      name: 'Categoria',
      value: CATEGORIES[command.category]?.label ?? command.category ?? '—',
      inline: true,
    });

  if (command.cooldown) {
    detail.addFields({ name: 'Tempo de espera', value: `${command.cooldown}s`, inline: true });
  }

  const subcommands = (json.options ?? []).filter((option) => option.type === 1);
  const groups = (json.options ?? []).filter((option) => option.type === 2);
  const plainOptions = (json.options ?? []).filter((option) => option.type > 2);

  if (subcommands.length > 0) {
    // Um campo de embed aceita 1024 caracteres. Com 25 subcomandos descritos a
    // lista passa disso e o Discord recusa a mensagem inteira, então quebramos
    // em quantos campos forem necessários.
    const linhas = subcommands.map(
      (sub) => `\`/${nomeComando} ${nomeLocalizado(sub)}\` — ${sub.description}`,
    );
    let parte = [];
    let tamanho = 0;
    let indice = 0;

    const despejar = () => {
      if (parte.length === 0) return;
      indice += 1;
      detail.addFields({
        name: indice === 1 ? `Subcomandos (${subcommands.length})` : '​',
        value: parte.join('\n'),
      });
      parte = [];
      tamanho = 0;
    };

    for (const linha of linhas) {
      if (tamanho + linha.length + 1 > 1024) despejar();
      parte.push(linha);
      tamanho += linha.length + 1;
    }
    despejar();
  }

  for (const group of groups) {
    const nomeGrupo = nomeLocalizado(group);
    detail.addFields({
      name: `Grupo: ${nomeGrupo}`,
      value: (group.options ?? [])
        .map(
          (sub) =>
            `\`/${nomeComando} ${nomeGrupo} ${nomeLocalizado(sub)}\` — ${sub.description}`,
        )
        .join('\n'),
    });
  }

  if (plainOptions.length > 0) {
    detail.addFields({
      name: 'Opções',
      value: plainOptions
        .map(
          (option) =>
            `\`${nomeLocalizado(option)}\`${option.required ? ' *(obrigatório)*' : ''} — ${option.description}`,
        )
        .join('\n'),
    });
  }

  await interaction.reply({ embeds: [detail], flags: MessageFlags.Ephemeral });
}
