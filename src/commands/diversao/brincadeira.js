import crypto from 'node:crypto';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';
import { aviso, familia, opt } from '../../lib/familia.js';

const sortear = (max) => crypto.randomInt(max);
const escolher = (itens) => itens[sortear(itens.length)];

/**
 * Valor estável para um par de pessoas.
 *
 * Um hash do par (ordenado, para dar igual nos dois sentidos) faz o resultado
 * ser sempre o mesmo — o que é a graça da brincadeira. Sortear de novo a cada
 * uso tiraria qualquer sentido de "compatibilidade".
 */
function pontoDoPar(a, b, tempero = '') {
  const [x, y] = [a, b].sort();
  return crypto.createHash('sha256').update(`${x}:${y}:${tempero}`).digest()[0];
}

const barra = (pct) => `\`${'█'.repeat(Math.round(pct / 5)).padEnd(20, '░')}\` **${pct}%**`;

const ALVO = opt.usuario('membro', 'A pessoa', true);
const OUTRO = opt.usuario('outro', 'A outra pessoa (padrão: você)', false);

/** Brincadeira de porcentagem entre duas pessoas, com o mesmo formato. */
const medidor = (name, description, titulo, tempero, frases) => ({
  name,
  description,
  options: [ALVO, OUTRO],
  run: ({ membro, outro }, interaction) => {
    const a = membro.id;
    const b = (outro ?? interaction.user).id;
    if (a === b) throw aviso('Escolha duas pessoas diferentes.');
    const pct = Math.round((pontoDoPar(a, b, tempero) / 255) * 100);
    return {
      embeds: [
        embed.base(colors.primary)
          .setTitle(titulo)
          .setDescription(`${membro} × ${outro ?? interaction.user}\n\n${barra(pct)}\n\n${frases[Math.floor((pct / 101) * frases.length)]}`),
      ],
    };
  },
});

/** Ação social simples: alguém faz algo com outra pessoa. */
const acao = (name, description, emoji, texto) => ({
  name,
  description,
  options: [ALVO],
  run: ({ membro }, interaction) => {
    if (membro.id === interaction.user.id) throw aviso('Escolha outra pessoa. 😅');
    return `${emoji} ${texto(interaction.user, membro)}`;
  },
});

export default familia({
  name: 'brincadeira',
  description: 'Medidores, respostas bobas e interações entre membros.',
  cooldown: 3,
  subs: [
    medidor('amor', 'Mede a compatibilidade amorosa.', '💘 Medidor de amor', 'amor', [
      'Melhor ficarem amigos.',
      'Tem uma faísca ali.',
      'Isso pode dar certo…',
      'Combinam bastante!',
      'É namoro na certa. 💍',
    ]),
    medidor('amizade', 'Mede o nível de amizade.', '🤝 Medidor de amizade', 'amizade', [
      'Vocês mal se conhecem.',
      'Colegas de servidor.',
      'Amizade sólida.',
      'Melhores amigos!',
      'Irmandade eterna. 🫂',
    ]),
    medidor('rivalidade', 'Mede a rivalidade entre dois.', '⚔️ Medidor de rivalidade', 'rival', [
      'Paz total.',
      'Umas alfinetadas.',
      'Rivalidade saudável.',
      'A tensão é real.',
      'Inimigos mortais. 🔥',
    ]),
    medidor('vibe', 'Mede se a vibe combina.', '🌈 Medidor de vibe', 'vibe', [
      'Vibes opostas.',
      'Dá para conviver.',
      'Boa sintonia.',
      'Vibes iguais!',
      'Mesma alma. ✨',
    ]),
    {
      name: 'porcentagem',
      description: 'Mede qualquer coisa sobre você.',
      options: [opt.texto('coisa', 'O que medir', true, { max: 200 })],
      run: ({ coisa }, interaction) => {
        const pct = Math.round((pontoDoPar(interaction.user.id, coisa.toLowerCase()) / 255) * 100);
        return `**Quão ${coisa} você é?**\n\n${barra(pct)}`;
      },
    },
    {
      name: 'quando',
      description: 'Diz quando algo vai acontecer.',
      options: [opt.texto('coisa', 'O que vai acontecer', true, { max: 200 })],
      run: ({ coisa }) =>
        `**${coisa}**\n\n${escolher([
          'Hoje ainda.', 'Amanhã.', 'Semana que vem.', 'No mês que vem.',
          'Ano que vem.', 'Em 2050.', 'Nunca. 💀', 'Quando você menos esperar.',
          'Assim que você parar de perguntar.',
        ])}`,
    },
    {
      name: 'quem',
      description: 'Sorteia alguém do canal para uma pergunta.',
      options: [opt.texto('pergunta', 'Ex.: quem vai pagar o lanche?', true, { max: 200 })],
      run: async ({ pergunta }, interaction) => {
        const membros = await interaction.guild.members.fetch();
        const humanos = [...membros.filter((m) => !m.user.bot).values()];
        if (humanos.length === 0) throw aviso('Não achei ninguém no servidor.');
        return `**${pergunta}**\n\n👉 ${escolher(humanos)}`;
      },
    },
    {
      name: 'ranking',
      description: 'Monta um ranking bobo entre os membros citados.',
      options: [
        opt.texto('criterio', 'O critério do ranking', true, { max: 100 }),
        opt.texto('pessoas', 'Nomes separados por vírgula', true, { max: 500 }),
      ],
      run: ({ criterio, pessoas }) => {
        const lista = pessoas.split(',').map((p) => p.trim()).filter(Boolean);
        if (lista.length < 2) throw aviso('Preciso de pelo menos 2 pessoas.');
        const comNota = lista
          .map((nome) => ({ nome, nota: pontoDoPar(nome.toLowerCase(), criterio.toLowerCase()) }))
          .sort((a, b) => b.nota - a.nota);
        return `**Ranking: ${criterio}**\n\n${comNota
          .map((p, i) => `${['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`} ${p.nome} — ${Math.round((p.nota / 255) * 100)}%`)
          .join('\n')}`;
      },
    },
    {
      name: 'culpado',
      description: 'Aponta o culpado entre as opções.',
      options: [opt.texto('suspeitos', 'Nomes separados por vírgula', true, { max: 500 })],
      run: ({ suspeitos }) => {
        const lista = suspeitos.split(',').map((s) => s.trim()).filter(Boolean);
        if (lista.length < 2) throw aviso('Preciso de pelo menos 2 suspeitos.');
        return `🕵️ Depois de muita investigação… o culpado é **${escolher(lista)}**.`;
      },
    },
    {
      name: 'previsao',
      description: 'A previsão do seu dia.',
      run: (_, interaction) => {
        const dia = Math.floor(Date.now() / 86_400_000);
        const semente = crypto.createHash('sha256').update(`${interaction.user.id}:${dia}:previsao`).digest();
        const humor = ['☀️ ótimo', '🌤️ bom', '⛅ normal', '🌧️ meio chato', '⛈️ evite decisões'][semente[0] % 5];
        const sorte = (semente[1] % 100) + 1;
        return [
          `**Previsão para hoje**`,
          `Humor do dia: ${humor}`,
          `Sorte: **${sorte}%**`,
          `Cor da sorte: **${['vermelho', 'azul', 'verde', 'amarelo', 'roxo', 'preto'][semente[2] % 6]}**`,
          `Número: **${(semente[3] % 60) + 1}**`,
        ].join('\n');
      },
    },
    {
      name: 'biscoito',
      description: 'Abre um biscoito da sorte.',
      run: () =>
        `🥠 **${escolher([
          'Quem espera sempre alcança — mas quem corre alcança antes.',
          'Você vai receber uma notícia boa esta semana.',
          'A resposta que você procura já está com você.',
          'Não confie em quem promete atalho.',
          'Algo que você perdeu vai reaparecer.',
          'Diga sim para o convite que você ia recusar.',
          'O silêncio às vezes é a melhor resposta.',
          'Descanse. Você produziu mais do que acha.',
        ])}**`,
    },
    {
      name: 'bola8',
      description: 'Faz uma pergunta à bola mágica.',
      options: [opt.texto('pergunta', 'Sua pergunta', true, { max: 300 })],
      run: ({ pergunta }) =>
        `🎱 **${pergunta}**\n\n${escolher([
          'Com certeza.', 'É decididamente assim.', 'Sem dúvida.', 'Sim, definitivamente.',
          'Pode contar com isso.', 'Provavelmente.', 'Perspectiva boa.', 'Sim.',
          'Sinais apontam que sim.', 'Resposta nebulosa, tente de novo.',
          'Pergunte mais tarde.', 'Melhor não te contar agora.',
          'Não conte com isso.', 'Minha resposta é não.', 'Muito duvidoso.',
        ])}`,
    },
    {
      name: 'inverso',
      description: 'Diz o contrário do que você mandar.',
      options: [opt.texto('frase', 'A frase', true, { max: 300 })],
      run: ({ frase }) => `🙃 ${[...frase].reverse().join('')}`,
    },
    {
      name: 'aplausos',
      description: 'Aplaude alguém.',
      options: [ALVO],
      run: ({ membro }) => `👏 👏 👏\n**${membro}** merece! 👏 👏 👏`,
    },
    acao('abracar', 'Abraça alguém.', '🤗', (a, b) => `**${a.username}** abraçou **${b.username}**!`),
    acao('cumprimentar', 'Cumprimenta alguém.', '🤝', (a, b) => `**${a.username}** cumprimentou **${b.username}**.`),
    acao('cutucar', 'Cutuca alguém.', '👉', (a, b) => `**${a.username}** cutucou **${b.username}**.`),
    acao('elogiar', 'Elogia alguém.', '🌟', (a, b) => `**${a.username}** disse que **${b.username}** ${escolher(['é gente boa demais', 'tem o melhor gosto musical daqui', 'salva o servidor todo dia', 'é mais inteligente do que aparenta', 'merece um aumento'])}.`),
    acao('agradecer', 'Agradece alguém.', '🙏', (a, b) => `**${a.username}** agradeceu **${b.username}**.`),
    acao('parabenizar', 'Dá os parabéns.', '🎉', (a, b) => `**${a.username}** deu os parabéns para **${b.username}**!`),
    acao('cafe', 'Oferece um café.', '☕', (a, b) => `**${a.username}** trouxe um café para **${b.username}**.`),
    acao('pastel', 'Oferece um pastel.', '🥟', (a, b) => `**${a.username}** dividiu um pastel com **${b.username}**.`),
    {
      name: 'sortear-premio',
      description: 'Sorteia um prêmio bobo para você.',
      run: () =>
        `🎁 Você ganhou: **${escolher([
          'um abraço virtual', 'meio pastel', 'um dia de sorte', '3 segundos de fama',
          'a chave de um carro que não existe', 'um elogio sincero', 'nada, mas com carinho',
          'o direito de escolher o próximo assunto', 'um cupom sem validade',
        ])}**`,
    },
    {
      name: 'contador',
      description: 'Conta de trás para frente com suspense.',
      options: [opt.inteiro('de', 'Começar de (1 a 10)', true, { min: 1, max: 10 })],
      run: ({ de }) => {
        const contagem = Array.from({ length: de }, (_, i) => `**${de - i}**…`).join(' ');
        return `${contagem} **JÁ!** 🚀`;
      },
    },
    {
      name: 'idade-mental',
      description: 'Descobre a sua idade mental.',
      run: (_, interaction) => {
        const dia = Math.floor(Date.now() / 86_400_000);
        const semente = crypto.createHash('sha256').update(`${interaction.user.id}:${dia}:mental`).digest();
        return `🧠 Sua idade mental hoje é **${(semente[0] % 80) + 3} anos**.`;
      },
    },
  ],
});
