import { ChannelType, PermissionFlagsBits } from 'discord.js';

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
 */

export const EXTRAS = {
  cargos: { label: 'Criar os cargos do modelo', emoji: '🎭' },
  voz: { label: 'Criar os canais de voz', emoji: '🔊' },
  staff: { label: 'Criar a área privada da equipe', emoji: '🔒' },
};

export const TEMPLATES = {
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
 * Cria tudo no servidor, na ordem em que aparece no modelo.
 *
 * Sequencial de propósito: o Discord ordena canais pela ordem de criação, e
 * disparar tudo em paralelo embaralharia o resultado além de bater no rate
 * limit. Falhas individuais são coletadas em vez de abortar — melhor um
 * servidor 90% montado com um aviso do que nada.
 */
export async function buildServer(guild, template, extras) {
  const me = guild.members.me;
  const created = { categories: 0, channels: 0, roles: 0 };
  const failures = [];

  if (extras.includes('cargos')) {
    for (const role of template.roles) {
      try {
        await guild.roles.create({
          name: role.name,
          color: role.color,
          hoist: role.hoist ?? false,
          // Só pedimos permissões que o próprio bot tem: pedir mais que isso faz
          // o Discord recusar a criação inteira do cargo.
          permissions: (role.permissions ?? []).filter((flag) => me.permissions.has(flag)),
          reason: 'Modelo aplicado pelo /construir',
        });
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
      created.categories += 1;
    } catch (error) {
      failures.push(`categoria **${category.name}**: ${error.message}`);
      continue; // sem categoria, os canais dela ficam soltos — melhor pular
    }

    for (const channel of category.channels) {
      try {
        await guild.channels.create({
          name: channel.name,
          type: channelType(category, channel, guild),
          parent: parent.id,
          topic: category.voice ? undefined : channel.topic,
          userLimit: category.voice ? channel.limit : undefined,
          reason: 'Modelo aplicado pelo /construir',
        });
        created.channels += 1;
      } catch (error) {
        failures.push(`canal **${channel.name}**: ${error.message}`);
      }
    }
  }

  return { created, failures };
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
