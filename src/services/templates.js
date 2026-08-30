import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { italico, negritoItalico } from '../lib/fontes.js';

/**
 * Modelos de servidor usados pelo /construir.
 *
 * Cada modelo descreve categorias, canais e cargos. Nada aqui apaga o que já
 * existe: o construtor só cria. Isso é proposital — um comando que reorganiza
 * um servidor inteiro não pode ter um botão que destrói meses de histórico por
 * um clique errado.
 *
 * Formato de uma categoria:
 *   { name, voice?, staff?, channels: [{ name, topic?, limit?, announcement? }] }
 *
 *   voice  → cria canais de voz em vez de texto
 *   staff  → a categoria inteira nasce invisível para @everyone
 *
 * Um modelo com `dono: true` não aparece para ninguém além do dono do bot: fica
 * fora do menu de escolha, fora das opções do /construir e é recusado no
 * componente mesmo que alguém forje o clique.
 */

export const EXTRAS = {
  limpar: { label: 'Apagar tudo que já existe antes de montar', emoji: '🧨' },
  cargos: { label: 'Criar os cargos do modelo', emoji: '🎭' },
  voz: { label: 'Criar os canais de voz', emoji: '🔊' },
  staff: { label: 'Criar a área privada da equipe', emoji: '🔒' },
};

/** O que vem marcado quando o painel abre. A limpeza entra ligada. */
export const EXTRAS_PADRAO = Object.keys(EXTRAS);

/**
 * Atalhos do modelo estilizado.
 *
 * Categoria: `<emoji> | 𝑁𝑂𝑀𝐸` — o nome em itálico matemático, que é o que
 *            passa por "fonte diferente" no Discord.
 * Canal:     `<emoji> · nome` em texto normal, com acento.
 *
 * O espaço em volta do `·` é U+2005 (espaço de um quarto de quadratim), não o
 * espaço comum. Em nome de canal de texto o Discord troca espaço ASCII por
 * hífen — daí todo canal do mundo aparecer como `chat-geral` — e é justamente
 * por usarem espaços fora do ASCII que os servidores estilizados conseguem
 * exibir `📷 · mídias` com espaço de verdade.
 */
const ESPACO = ' ';

const cat = (emoji, nome, resto = {}) => ({
  name: `${emoji} | ${italico(nome)}`,
  ...resto,
});

const can = (emoji, nome, topic) => ({
  name: `${emoji}${ESPACO}·${ESPACO}${nome}`,
  ...(topic ? { topic } : {}),
});

export const TEMPLATES = {
  /**
   * Servidor completo: comunidade, loja, academia, área VIP e staff.
   *
   * Nomes de categoria em itálico matemático e prefixo de emoji em cada canal,
   * no estilo dos servidores estilizados. Os cargos são a única parte inferida:
   * a lista deles não aparecia nas capturas usadas como referência.
   */
  completo: {
    label: 'Servidor completo',
    emoji: '\u{1F48E}',
    short: 'Comunidade, loja, academia, área VIP e staff — 9 categorias',
    color: 0x2b0b12,
    dono: true,
    categories: [
      cat('\u265B', 'DIRECTIVES', {
        channels: [
          can('\u{1F4DC}', 'diretrizes', 'As regras da casa. Leia antes de participar.'),
          { ...can('\u{1F4E3}', 'comunicados', 'Avisos oficiais da equipe.'), announcement: true },
          can('\u{1F3C6}', 'membros-oficiais', 'Quem faz parte oficialmente.'),
          can('\u{1F5BC}\uFE0F', 'pfp', 'Fotos de perfil e banners.'),
        ],
      }),
      cat('\u{1F48E}', 'VIP LOUNGE', {
        channels: [
          can('\u{1F4B3}', 'chat-exclusivo', 'Conversa reservada a quem tem plano.'),
          can('\u{1F537}', 'materiais-vips', 'Arquivos e conteúdos exclusivos.'),
          can('\u{1F38A}', 'benefícios-vip', 'O que cada plano dá direito.'),
        ],
      }),
      cat('\u265F\uFE0F', 'INTELLIGENCE', {
        channels: [
          can('\u{1F3AF}', 'ataques', 'Registro e análise de incidentes.'),
          can('\u{1F4D2}', 'relatórios', 'Relatórios completos.'),
          can('\u{1F386}', 'alertas', 'Alertas urgentes.'),
          can('\u{1F50E}', 'investigação', 'Apurações em andamento.'),
        ],
      }),
      cat('\u{1F310}', 'COMMUNITY', {
        channels: [
          can('\u{1F4AC}', 'chat-geral', 'Conversa livre.'),
          can('\u{1F4F7}', 'mídias', 'Fotos, prints e vídeos.'),
          can('\u{1F3AC}', 'edits', 'Edições e montagens.'),
          can('\u{1F9F0}', 'suporte', 'Precisa de ajuda? Abra aqui.'),
          can('\u{1F4F1}', 'download-tiktok', 'Baixe vídeos do TikTok pelo bot.'),
          can('\u{1F54A}\uFE0F', 'versículos', 'Versículos e reflexões.'),
        ],
      }),
      cat('\u{1F4B0}', 'MARKETPLACE', {
        channels: [
          can('\u{1F6CD}\uFE0F', 'loja', 'Catálogo de produtos e serviços.'),
          can('\u{1F3C5}', 'planos-vip', 'O que cada plano inclui.'),
          can('\u{1F6D2}', 'comprar', 'Formas de pagamento e como fechar.'),
          can('\u{1F680}', 'meus-pedidos', 'Acompanhe o que você comprou.'),
          can('\u{1F381}', 'ofertas', 'Promoções e cupons.'),
        ],
      }),
      cat('\u{1F393}', 'ACADEMY', {
        channels: [
          can('\u{1F4DA}', 'biblioteca', 'Acervo de materiais.'),
          can('\u{1F4BB}', 'programação', 'Código, linguagens e projetos.'),
          can('\u{1F4DD}', 'materiais-e-resumos', 'Resumos e anotações compartilhadas.'),
          can('\u{1F4A1}', 'dúvidas-e-debates', 'Pergunte e discuta sem medo.'),
          can('\u{1F4D6}', 'estudos', 'Trilhas, metas e progresso.'),
        ],
      }),
      cat('\u{1F3A7}', 'LOUNGE', {
        voice: true,
        channels: [
          can('\u{1F50A}', 'lounge principal'),
          can('\u{1F3B5}', 'estúdio de música'),
          can('\u{1F512}', 'call invisível 2'),
        ],
      }),
      cat('\u{1F91D}', 'PARCERIAS', {
        channels: [
          can('\u{1F4C4}', 'requisitos-parceria', 'O que pedimos para fechar parceria.'),
          can('\u{1F4B3}', 'solicitar-parceria', 'Mande sua proposta por aqui.'),
          can('\u2705', 'parceiros-oficiais', 'Quem já é parceiro.'),
        ],
      }),
      cat('\u2728', 'STAFF', {
        staff: true,
        channels: [
          can('\u{1F4AC}', 'chat-staff', 'Conversa interna da equipe.'),
          can('\u{1F4CA}', 'vendas', 'Acompanhamento de vendas.'),
          can('\u{1F39F}\uFE0F', 'tickets', 'Atendimentos abertos.'),
          can('\u{1F4C1}', 'logs', 'Registro automático de moderação.'),
        ],
      }),
    ],
    roles: [
      {
        name: `\u{1F451} | ${negritoItalico('FOUNDER')}`,
        color: 0xffffff,
        hoist: true,
        permissions: [PermissionFlagsBits.Administrator],
      },
      {
        name: `\u265B | ${negritoItalico('ADMIN')}`,
        color: 0xe74c3c,
        hoist: true,
        permissions: [PermissionFlagsBits.Administrator],
      },
      {
        name: `\u265F\uFE0F | ${negritoItalico('MODERADOR')}`,
        color: 0x3498db,
        hoist: true,
        permissions: [
          PermissionFlagsBits.KickMembers,
          PermissionFlagsBits.BanMembers,
          PermissionFlagsBits.ModerateMembers,
          PermissionFlagsBits.ManageMessages,
        ],
      },
      { name: `\u{1F48E} | ${negritoItalico('VIP')}`, color: 0xf1c40f, hoist: true },
      { name: `\u{1F91D} | ${negritoItalico('PARCEIRO')}`, color: 0x9b59b6, hoist: true },
      { name: `\u{1F3C6} | ${negritoItalico('MEMBRO OFICIAL')}`, color: 0x2ecc71 },
      { name: `\u{1F310} | ${negritoItalico('MEMBRO')}`, color: 0x95a5a6 },
    ],
  },

  hacking: {
    label: 'Segurança e tecnologia',
    emoji: '🔐',
    short: 'CTF, soluções comentadas, ferramentas e estudo de segurança',
    color: 0x00ff9c,
    categories: [
      {
        name: '📌 início',
        channels: [
          { name: 'bem-vindo', topic: 'Apresentação do servidor e por onde começar.' },
          { name: 'regras', topic: 'Leia antes de participar.' },
          { name: 'anúncios', announcement: true, topic: 'Avisos oficiais da equipe.' },
          { name: 'apresente-se', topic: 'Conte quem é você e o que quer aprender.' },
        ],
      },
      {
        name: '🛡️ segurança',
        channels: [
          { name: 'ctf', topic: 'Competições de captura de bandeira: avisos e times.' },
          { name: 'soluções-ctf', topic: 'Soluções comentadas dos desafios já encerrados.' },
          { name: 'ferramentas', topic: 'Indicação e discussão de ferramentas.' },
          { name: 'laboratórios', topic: 'HackTheBox, TryHackMe, PortSwigger e afins.' },
          { name: 'certificações', topic: 'Trilhas de estudo e provas.' },
          { name: 'dúvidas', topic: 'Pergunte sem medo. Ninguém nasceu sabendo.' },
        ],
      },
      {
        name: '💻 desenvolvimento',
        channels: [
          { name: 'código', topic: 'Programação em geral.' },
          { name: 'automações', topic: 'Automações e ferramentas próprias.' },
          { name: 'projetos', topic: 'Mostre o que você está construindo.' },
        ],
      },
      {
        name: '💬 comunidade',
        channels: [
          { name: 'geral', topic: 'Conversa livre.' },
          { name: 'assuntos-diversos', topic: 'Qualquer assunto fora do tema.' },
          { name: 'vagas', topic: 'Oportunidades de trabalho e estágio.' },
          { name: 'memes', topic: 'O necessário.' },
        ],
      },
      {
        name: '🔊 voz',
        voice: true,
        channels: [{ name: 'Recepção' }, { name: 'Sala de CTF', limit: 10 }, { name: 'Foco', limit: 5 }],
      },
      {
        name: '🔒 equipe',
        staff: true,
        channels: [
          { name: 'conversa-equipe', topic: 'Conversa interna da equipe.' },
          { name: 'registros', topic: 'Registro automático de moderação.' },
          { name: 'denúncias', topic: 'Relatos recebidos dos membros.' },
        ],
      },
    ],
    roles: [
      { name: 'Administrador', color: 0xe74c3c, hoist: true, permissions: [PermissionFlagsBits.Administrator] },
      {
        name: 'Moderador',
        color: 0x3498db,
        hoist: true,
        permissions: [
          PermissionFlagsBits.KickMembers,
          PermissionFlagsBits.BanMembers,
          PermissionFlagsBits.ModerateMembers,
          PermissionFlagsBits.ManageMessages,
        ],
      },
      { name: 'Competidor de CTF', color: 0x00ff9c, hoist: true },
      { name: 'Membro', color: 0x95a5a6 },
      { name: 'Iniciante', color: 0xf1c40f },
    ],
  },

  comunidade: {
    label: 'Comunidade',
    emoji: '💬',
    short: 'Estrutura clássica: conversa, mídia, voz e equipe',
    color: 0x5865f2,
    categories: [
      {
        name: '📌 início',
        channels: [
          { name: 'bem-vindo', topic: 'Comece por aqui.' },
          { name: 'regras', topic: 'As regras da casa.' },
          { name: 'anúncios', announcement: true, topic: 'Avisos importantes.' },
        ],
      },
      {
        name: '💬 conversa',
        channels: [
          { name: 'geral', topic: 'Papo livre.' },
          { name: 'assuntos-diversos', topic: 'Assuntos aleatórios.' },
          { name: 'desabafo', topic: 'Espaço para desabafar com respeito.' },
        ],
      },
      {
        name: '🖼️ mídia',
        channels: [
          { name: 'fotos', topic: 'Suas fotos e prints.' },
          { name: 'memes', topic: 'Memes.' },
          { name: 'música', topic: 'O que você está ouvindo.' },
          { name: 'clipes', topic: 'Vídeos e cortes.' },
        ],
      },
      {
        name: '🤖 bots',
        channels: [{ name: 'comandos', topic: 'Use os comandos do bot aqui.' }],
      },
      {
        name: '🔊 voz',
        voice: true,
        channels: [{ name: 'Geral' }, { name: 'Música' }, { name: 'Ausente' }],
      },
      {
        name: '🔒 equipe',
        staff: true,
        channels: [
          { name: 'conversa-equipe', topic: 'Conversa da equipe.' },
          { name: 'registros', topic: 'Registro de moderação.' },
        ],
      },
    ],
    roles: [
      { name: 'Administrador', color: 0xe74c3c, hoist: true, permissions: [PermissionFlagsBits.Administrator] },
      {
        name: 'Moderador',
        color: 0x3498db,
        hoist: true,
        permissions: [
          PermissionFlagsBits.KickMembers,
          PermissionFlagsBits.ModerateMembers,
          PermissionFlagsBits.ManageMessages,
        ],
      },
      { name: 'Membro', color: 0x95a5a6 },
    ],
  },

  gaming: {
    label: 'Jogos',
    emoji: '🎮',
    short: 'Canais por jogo, procura de time e salas de voz',
    color: 0x9b59b6,
    categories: [
      {
        name: '📌 início',
        channels: [
          { name: 'bem-vindo' },
          { name: 'regras' },
          { name: 'anúncios', announcement: true },
        ],
      },
      {
        name: '🎮 jogos',
        channels: [
          { name: 'procura-time', topic: 'Chame gente para jogar.' },
          { name: 'clipes', topic: 'Suas melhores jogadas.' },
          { name: 'dicas', topic: 'Configurações, estratégias e guias.' },
          { name: 'sugestões-de-jogo', topic: 'O que jogamos depois?' },
        ],
      },
      {
        name: '💬 comunidade',
        channels: [{ name: 'geral' }, { name: 'assuntos-diversos' }, { name: 'memes' }],
      },
      {
        name: '🔊 voz',
        voice: true,
        channels: [
          { name: 'Recepção' },
          { name: 'Equipe 1', limit: 5 },
          { name: 'Equipe 2', limit: 5 },
          { name: 'Ausente' },
        ],
      },
      {
        name: '🔒 equipe',
        staff: true,
        channels: [{ name: 'conversa-equipe' }, { name: 'registros' }],
      },
    ],
    roles: [
      { name: 'Administrador', color: 0xe74c3c, hoist: true, permissions: [PermissionFlagsBits.Administrator] },
      {
        name: 'Moderador',
        color: 0x3498db,
        hoist: true,
        permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers],
      },
      { name: 'Competitivo', color: 0xe67e22, hoist: true },
      { name: 'Casual', color: 0x95a5a6 },
    ],
  },

  estudos: {
    label: 'Estudos',
    emoji: '📚',
    short: 'Salas de foco, material, dúvidas e cronograma',
    color: 0x2ecc71,
    categories: [
      {
        name: '📌 início',
        channels: [
          { name: 'bem-vindo' },
          { name: 'regras' },
          { name: 'cronograma', topic: 'Metas e prazos do grupo.' },
        ],
      },
      {
        name: '📚 estudo',
        channels: [
          { name: 'material', topic: 'PDFs, links e resumos.' },
          { name: 'dúvidas', topic: 'Pergunte aqui.' },
          { name: 'resumos', topic: 'O que você aprendeu hoje.' },
          { name: 'exercícios', topic: 'Listas e correções.' },
          { name: 'conquistas', topic: 'Comemore o progresso.' },
        ],
      },
      {
        name: '💬 convivência',
        channels: [{ name: 'geral' }, { name: 'assuntos-diversos' }],
      },
      {
        name: '🔊 salas de foco',
        voice: true,
        channels: [
          { name: 'Foco silencioso', limit: 10 },
          { name: 'Estudo em grupo', limit: 6 },
          { name: 'Pausa' },
        ],
      },
      {
        name: '🔒 equipe',
        staff: true,
        channels: [{ name: 'conversa-equipe' }, { name: 'registros' }],
      },
    ],
    roles: [
      { name: 'Administrador', color: 0xe74c3c, hoist: true, permissions: [PermissionFlagsBits.Administrator] },
      { name: 'Monitor', color: 0x3498db, hoist: true, permissions: [PermissionFlagsBits.ManageMessages] },
      { name: 'Estudante', color: 0x2ecc71 },
    ],
  },
};

/** O modelo exclusivo do dono, para quem precisa abrir direto nele. */
export const MODELO_DO_DONO = 'completo';

/** Os modelos que qualquer administrador de servidor pode usar. */
export function templatesPublicos() {
  return Object.entries(TEMPLATES).filter(([, template]) => !template.dono);
}

/** Os modelos visíveis para quem está usando — o dono enxerga todos. */
export function templatesVisiveis(dono) {
  return dono ? Object.entries(TEMPLATES) : templatesPublicos();
}

/** Diz se o modelo é restrito ao dono do bot. */
export function exigeDono(key) {
  return TEMPLATES[key]?.dono === true;
}

/** As categorias que serão realmente criadas, dado o modelo e os extras. */
export function selectedCategories(template, extras) {
  return template.categories.filter((category) => {
    if (category.voice) return extras.includes('voz');
    if (category.staff) return extras.includes('staff');
    return true;
  });
}

/** Quantos canais e cargos um plano vai criar, para mostrar antes de confirmar. */
export function planSummary(template, extras) {
  const categories = selectedCategories(template, extras);
  return {
    categories: categories.length,
    channels: categories.reduce((sum, category) => sum + category.channels.length, 0),
    roles: extras.includes('cargos') ? template.roles.length : 0,
  };
}

/**
 * O que a limpeza consegue apagar de verdade.
 *
 * Nem tudo é apagável, e tentar mesmo assim só gera erro:
 *
 *   - @everyone não existe sem o servidor;
 *   - cargos `managed` pertencem a bots, integrações ou ao impulso do servidor
 *     — o Discord recusa e devolve 50028;
 *   - cargo acima do cargo mais alto do bot está fora do alcance dele;
 *   - em servidor de comunidade, o canal de regras e o de avisos da moderação
 *     não podem ser apagados enquanto o recurso estiver ligado.
 *
 * `ignorar` é o que acabou de ser criado: sem isso a limpeza apagaria o próprio
 * servidor recém-montado.
 */
export function alvosDaLimpeza(guild, ignorar = new Set()) {
  const me = guild.members.me;
  const protegidos = new Set(
    [guild.rulesChannel?.id, guild.publicUpdatesChannel?.id].filter(Boolean),
  );

  const canais = [...guild.channels.cache.values()].filter(
    (canal) => !ignorar.has(canal.id) && !protegidos.has(canal.id) && canal.deletable,
  );

  const cargos = [...guild.roles.cache.values()].filter(
    (cargo) =>
      !ignorar.has(cargo.id) &&
      cargo.id !== guild.id &&
      !cargo.managed &&
      cargo.position < me.roles.highest.position,
  );

  return { canais, cargos };
}

/**
 * Apaga canais e cargos. Não tem volta: o Discord não guarda histórico de canal
 * apagado em lugar nenhum, nem para o dono do servidor.
 *
 * Sequencial pelo mesmo motivo da criação — em paralelo o rate limit derruba
 * metade das chamadas. Cada falha é anotada e a varredura continua.
 */
export async function limparServidor(guild, ignorar = new Set()) {
  const { canais, cargos } = alvosDaLimpeza(guild, ignorar);
  const removed = { channels: 0, roles: 0 };
  const failures = [];

  for (const canal of canais) {
    try {
      await canal.delete('Limpeza pedida no /construir');
      removed.channels += 1;
    } catch (error) {
      failures.push(`não apaguei o canal **${canal.name}**: ${error.message}`);
    }
  }

  for (const cargo of cargos) {
    try {
      await cargo.delete('Limpeza pedida no /construir');
      removed.roles += 1;
    } catch (error) {
      failures.push(`não apaguei o cargo **${cargo.name}**: ${error.message}`);
    }
  }

  return { removed, failures };
}

/**
 * Cria tudo no servidor, na ordem em que aparece no modelo.
 *
 * Sequencial de propósito: o Discord ordena canais pela ordem de criação, e
 * disparar tudo em paralelo embaralharia o resultado além de bater no rate
 * limit. Falhas individuais são coletadas em vez de abortar — melhor um
 * servidor 90% montado com um aviso do que nada.
 *
 * Com `limpar` nos extras, o antigo cai **depois** que o novo já está de pé.
 * A ordem inversa seria mais bonita — canais nas posições certas desde o
 * começo — e catastrófica: se o rate limit ou uma queda interrompesse o meio
 * do caminho, o servidor ficaria vazio e sem nada no lugar. Assim, uma falha
 * no meio deixa canais repetidos, que dá para resolver; nunca um servidor
 * apagado, que não dá.
 */
export async function buildServer(guild, template, extras, { preservar = new Set() } = {}) {
  const me = guild.members.me;
  const created = { categories: 0, channels: 0, roles: 0 };
  const failures = [];
  // Tudo que nascer daqui para a frente fica fora da mira da limpeza.
  const novos = new Set();
  // Primeiro canal de texto criado: é para lá que vai o relatório quando o
  // canal de onde o comando saiu também está na lista para apagar.
  let primeiroCanal = null;

  if (extras.includes('cargos')) {
    for (const role of template.roles) {
      try {
        const criado = await guild.roles.create({
          name: role.name,
          color: role.color,
          hoist: role.hoist ?? false,
          // Só pedimos permissões que o próprio bot tem: pedir mais que isso faz
          // o Discord recusar a criação inteira do cargo.
          permissions: (role.permissions ?? []).filter((flag) => me.permissions.has(flag)),
          reason: 'Modelo aplicado pelo /construir',
        });
        novos.add(criado.id);
        created.roles += 1;
      } catch (error) {
        failures.push(`cargo **${role.name}**: ${error.message}`);
      }
    }
  }

  for (const category of selectedCategories(template, extras)) {
    let parent = null;

    try {
      parent = await guild.channels.create({
        name: category.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: category.staff
          ? [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
          : undefined,
        reason: 'Modelo aplicado pelo /construir',
      });
      novos.add(parent.id);
      created.categories += 1;
    } catch (error) {
      failures.push(`categoria **${category.name}**: ${error.message}`);
      continue; // sem categoria, os canais dela ficam soltos — melhor pular
    }

    for (const channel of category.channels) {
      try {
        const criado = await guild.channels.create({
          name: channel.name,
          type: channelType(category, channel, guild),
          parent: parent.id,
          topic: category.voice ? undefined : channel.topic,
          userLimit: category.voice ? channel.limit : undefined,
          reason: 'Modelo aplicado pelo /construir',
        });
        novos.add(criado.id);
        if (!primeiroCanal && !category.voice && !category.staff) primeiroCanal = criado;
        created.channels += 1;
      } catch (error) {
        failures.push(`canal **${channel.name}**: ${error.message}`);
      }
    }
  }

  if (!extras.includes('limpar')) {
    return { created, removed: { channels: 0, roles: 0 }, failures, primeiroCanal, restam: [] };
  }

  // Só agora, com o servidor novo de pé, o antigo cai. `preservar` segura o
  // canal de onde veio o comando: sem ele não há para onde responder. Quem
  // chamou apaga esses no fim, depois de entregar o relatório.
  const limpeza = await limparServidor(guild, new Set([...novos, ...preservar]));
  const restam = [...preservar]
    .map((id) => guild.channels.cache.get(id))
    .filter((canal) => canal?.deletable);

  return {
    created,
    removed: limpeza.removed,
    failures: [...failures, ...limpeza.failures],
    primeiroCanal,
    restam,
  };
}

function channelType(category, channel, guild) {
  if (category.voice) return ChannelType.GuildVoice;
  // Canais de anúncio só existem em servidores de comunidade; fora deles o
  // Discord recusa o tipo, então caímos para texto comum.
  if (channel.announcement && guild.features.includes('COMMUNITY')) {
    return ChannelType.GuildAnnouncement;
  }
  return ChannelType.GuildText;
}
