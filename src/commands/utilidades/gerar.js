import crypto from 'node:crypto';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';
import { aviso, bloco, familia, opt, privado } from '../../lib/familia.js';

const sortear = (max) => crypto.randomInt(max);
const escolher = (itens) => itens[sortear(itens.length)];

const MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz'; // sem l, que se confunde com 1
const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I e O
const DIGITOS = '23456789'; // sem 0 e 1
const SIMBOLOS = '!@#$%&*+-=?';

const LOREM = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
];

const SILABAS = ['ka', 'ro', 'mi', 'ta', 'zen', 'lu', 'vor', 'nix', 'ara', 'del', 'sha', 'kor', 'ny', 'tha'];

export default familia({
  name: 'gerar',
  // Promovidos a comando de topo: saem da família e viram /nome direto.
  atalhos: ['senha', 'uuid'],
  description: 'Gera senhas, identificadores, cores, textos e nomes.',
  cooldown: 3,
  subs: [
    {
      name: 'senha',
      description: 'Gera uma senha forte (só você vê).',
      options: [
        opt.inteiro('tamanho', 'De 8 a 128 caracteres', true, { min: 8, max: 128 }),
        opt.sim('simbolos', 'Incluir símbolos (padrão: sim)'),
      ],
      run: ({ tamanho, simbolos }) => {
        const usarSimbolos = simbolos ?? true;
        const alfabeto = MINUSCULAS + MAIUSCULAS + DIGITOS + (usarSimbolos ? SIMBOLOS : '');
        const senha = Array.from({ length: tamanho }, () => alfabeto[sortear(alfabeto.length)]).join('');
        // log2 do tamanho do alfabeto × comprimento: a medida honesta de força.
        const bits = Math.round(tamanho * Math.log2(alfabeto.length));
        const forca = bits < 60 ? '🔴 fraca' : bits < 80 ? '🟡 razoável' : bits < 110 ? '🟢 forte' : '💪 excelente';
        return privado(`\`\`\`\n${senha}\n\`\`\`\n**${bits} bits** de entropia — ${forca}`);
      },
    },
    {
      name: 'frase-senha',
      description: 'Senha em palavras, mais fácil de lembrar.',
      options: [opt.inteiro('palavras', 'De 3 a 10 palavras', true, { min: 3, max: 10 })],
      run: ({ palavras }) => {
        const dicionario = [
          'cavalo', 'bateria', 'grampo', 'correto', 'janela', 'nuvem', 'pedra', 'tigre',
          'violão', 'foguete', 'floresta', 'martelo', 'oceano', 'relógio', 'sombra',
          'trovão', 'vidro', 'zebra', 'abelha', 'cacto', 'dragão', 'espelho', 'girassol',
        ];
        const escolhidas = Array.from({ length: palavras }, () => escolher(dicionario));
        const bits = Math.round(palavras * Math.log2(dicionario.length));
        return privado(`\`\`\`\n${escolhidas.join('-')}\n\`\`\`\n**${bits} bits** de entropia`);
      },
    },
    {
      name: 'pin',
      description: 'Gera um PIN numérico.',
      options: [opt.inteiro('digitos', 'De 4 a 12 dígitos', true, { min: 4, max: 12 })],
      run: ({ digitos }) =>
        privado(`\`\`\`\n${Array.from({ length: digitos }, () => sortear(10)).join('')}\n\`\`\``),
    },
    {
      name: 'uuid',
      description: 'Gera um identificador único (UUID v4).',
      options: [opt.inteiro('quantidade', 'Quantos gerar', false, { min: 1, max: 20 })],
      run: ({ quantidade }) =>
        bloco(Array.from({ length: quantidade ?? 1 }, () => crypto.randomUUID()).join('\n')),
    },
    {
      name: 'token',
      description: 'Gera um token aleatório em hexadecimal.',
      options: [opt.inteiro('bytes', 'Tamanho em bytes (8 a 64)', true, { min: 8, max: 64 })],
      run: ({ bytes }) => privado(`\`\`\`\n${crypto.randomBytes(bytes).toString('hex')}\n\`\`\``),
    },
    {
      name: 'cor',
      description: 'Gera uma cor aleatória com os códigos.',
      run: () => {
        const valor = sortear(0xffffff + 1);
        const hex = valor.toString(16).padStart(6, '0').toUpperCase();
        const [r, g, b] = [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255];
        return {
          embeds: [
            embed
              .base(valor)
              .setTitle(`#${hex}`)
              .setDescription(`**RGB** \`${r}, ${g}, ${b}\`\n**CSS** \`rgb(${r} ${g} ${b})\``)
              .setThumbnail(`https://singlecolorimage.com/get/${hex}/120x120`),
          ],
        };
      },
    },
    {
      name: 'paleta',
      description: 'Gera uma paleta de cores combinando.',
      options: [opt.inteiro('cores', 'De 3 a 8 cores', true, { min: 3, max: 8 })],
      run: ({ cores }) => {
        // Espalha os matizes igualmente pelo círculo: é o que faz a paleta
        // parecer combinada em vez de um punhado de cores ao acaso.
        const base = sortear(360);
        const saidas = Array.from({ length: cores }, (_, i) => {
          const matiz = (base + (360 / cores) * i) % 360;
          return hslParaHex(matiz, 65, 55);
        });
        return {
          embeds: [
            embed
              .base(parseInt(saidas[0].slice(1), 16))
              .setTitle('Paleta gerada')
              .setDescription(saidas.map((h) => `\`${h}\``).join('  ')),
          ],
        };
      },
    },
    {
      name: 'gradiente',
      description: 'Gera os passos de um gradiente entre duas cores.',
      options: [
        opt.texto('de', 'Cor inicial em hex, ex.: #FF0000', true, { max: 7 }),
        opt.texto('para', 'Cor final em hex', true, { max: 7 }),
        opt.inteiro('passos', 'Quantos passos', true, { min: 3, max: 12 }),
      ],
      run: ({ de, para, passos }) => {
        const a = hexParaRgb(de);
        const b = hexParaRgb(para);
        const cores = Array.from({ length: passos }, (_, i) => {
          const t = i / (passos - 1);
          const misturado = a.map((canal, k) => Math.round(canal + (b[k] - canal) * t));
          return `#${misturado.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
        });
        return {
          embeds: [
            embed
              .base(parseInt(cores[Math.floor(passos / 2)].slice(1), 16))
              .setTitle('Gradiente')
              .setDescription(cores.map((c) => `\`${c}\``).join('  ')),
          ],
        };
      },
    },
    {
      name: 'lorem',
      description: 'Texto de preenchimento em lorem ipsum.',
      options: [opt.inteiro('palavras', 'Quantas palavras', true, { min: 5, max: 400 })],
      run: ({ palavras }) => {
        const texto = Array.from({ length: palavras }, () => escolher(LOREM)).join(' ');
        return bloco(`${texto[0].toUpperCase()}${texto.slice(1)}.`);
      },
    },
    {
      name: 'nome-fantasia',
      description: 'Inventa um nome de personagem.',
      options: [opt.inteiro('quantidade', 'Quantos nomes', false, { min: 1, max: 15 })],
      run: ({ quantidade }) =>
        Array.from({ length: quantidade ?? 5 }, () => {
          const tamanho = 2 + sortear(2);
          const nome = Array.from({ length: tamanho }, () => escolher(SILABAS)).join('');
          return `• **${nome[0].toUpperCase()}${nome.slice(1)}**`;
        }).join('\n'),
    },
    {
      name: 'nick',
      description: 'Inventa um apelido para jogo.',
      options: [opt.inteiro('quantidade', 'Quantos apelidos', false, { min: 1, max: 15 })],
      run: ({ quantidade }) => {
        const adjetivos = ['Dark', 'Neo', 'Cyber', 'Ghost', 'Toxic', 'Silent', 'Rapid', 'Zero', 'Mad', 'Iron'];
        const nomes = ['Wolf', 'Raven', 'Blade', 'Storm', 'Byte', 'Fox', 'Reaper', 'Nova', 'Viper', 'Shark'];
        return Array.from({ length: quantidade ?? 5 }, () =>
          `• \`${escolher(adjetivos)}${escolher(nomes)}${sortear(100)}\``,
        ).join('\n');
      },
    },
    {
      name: 'pergunta',
      description: 'Uma pergunta para puxar assunto no servidor.',
      run: () =>
        `💬 **${escolher([
          'Qual foi a melhor coisa que te aconteceu esse mês?',
          'Se você pudesse morar em qualquer lugar, onde seria?',
          'Qual filme você já assistiu mais vezes?',
          'Qual comida você comeria todo dia sem enjoar?',
          'Que habilidade você queria ter aprendido mais cedo?',
          'Qual foi o melhor jogo que você já jogou?',
          'Você é mais de acordar cedo ou virar a noite?',
          'Qual música não sai da sua cabeça ultimamente?',
          'Se te dessem um ano sabático, o que você faria?',
          'Qual foi a compra mais inútil que você já fez?',
          'Que lugar do Brasil você quer conhecer?',
          'Qual foi o conselho mais útil que você já recebeu?',
        ])}**`,
    },
    {
      name: 'desafio',
      description: 'Um desafio bobo para o servidor.',
      run: () =>
        `🎯 **${escolher([
          'Mande a última foto da sua galeria (se puder).',
          'Conte uma história sua em exatamente 10 palavras.',
          'Escreva sem usar a letra A por 3 mensagens.',
          'Recomende algo que ninguém aqui conhece.',
          'Mande um print da sua tela inicial.',
          'Diga uma opinião impopular que você defende.',
          'Conte a coisa mais estranha que você já comeu.',
          'Explique seu trabalho ou estúdio como se fosse para uma criança.',
        ])}**`,
    },
    {
      name: 'verdade',
      description: 'Uma pergunta de verdade ou desafio.',
      run: () =>
        `🫣 **${escolher([
          'Qual foi a maior mentira que você já contou?',
          'Qual foi o momento mais vergonhoso da sua vida?',
          'Qual talento secreto você tem?',
          'Você já fingiu gostar de um presente?',
          'Qual é o seu maior medo?',
          'Qual foi a última vez que você chorou de rir?',
        ])}**`,
    },
    {
      name: 'conselho',
      description: 'Um conselho aleatório.',
      run: () =>
        `🧠 **${escolher([
          'Se leva menos de dois minutos, faça agora.',
          'Durma antes de responder aquela mensagem irritada.',
          'Guarde o backup antes de precisar dele.',
          'Perguntar cedo custa menos que consertar tarde.',
          'O melhor momento para começar foi ontem. O segundo melhor é hoje.',
          'Escreva o que você aprendeu; você vai esquecer.',
          'Se está caro demais para testar, quebre em pedaços menores.',
        ])}**`,
    },
    {
      name: 'ideia',
      description: 'Uma ideia de projeto para tirar do papel.',
      run: () =>
        `💡 **${escolher([
          'Um bot que lembra o servidor de beber água.',
          'Um site que mostra quanto tempo falta para o fim do ano.',
          'Um script que renomeia suas fotos pela data.',
          'Um painel com as estatísticas do seu servidor.',
          'Um jogo de adivinhação com as músicas que você ouve.',
          'Um resumo automático do que você fez na semana.',
        ])}**`,
    },
    {
      name: 'numero-sorte',
      description: 'Seu número da sorte de hoje.',
      run: (_, interaction) => {
        // Determinístico por pessoa e por dia: dá para conferir com um amigo.
        const dia = Math.floor(Date.now() / 86_400_000);
        const semente = crypto
          .createHash('sha256')
          .update(`${interaction.user.id}:${dia}`)
          .digest();
        return `🍀 O seu número da sorte de hoje é **${(semente.readUInt32BE(0) % 100) + 1}**`;
      },
    },
    {
      name: 'tabela',
      description: 'Monta uma tabela de texto a partir de linhas.',
      options: [opt.texto('linhas', 'Colunas separadas por | e linhas por ;', true, { max: 1500 })],
      run: ({ linhas }) => {
        const grade = linhas.split(';').map((l) => l.split('|').map((c) => c.trim()));
        const colunas = Math.max(...grade.map((l) => l.length));
        if (colunas < 2) throw aviso('Separe as colunas com `|` e as linhas com `;`.');
        const larguras = Array.from({ length: colunas }, (_, i) =>
          Math.max(...grade.map((l) => (l[i] ?? '').length)),
        );
        const linha = (celulas) =>
          `| ${Array.from({ length: colunas }, (_, i) => (celulas[i] ?? '').padEnd(larguras[i])).join(' | ')} |`;
        const separador = `|${larguras.map((w) => '-'.repeat(w + 2)).join('|')}|`;
        return bloco([linha(grade[0]), separador, ...grade.slice(1).map(linha)].join('\n'));
      },
    },
    {
      name: 'barra',
      description: 'Desenha uma barra de progresso.',
      options: [
        opt.inteiro('atual', 'Valor atual', true, { min: 0, max: 1_000_000 }),
        opt.inteiro('total', 'Valor total', true, { min: 1, max: 1_000_000 }),
      ],
      run: ({ atual, total }) => {
        const pct = Math.min(100, (atual / total) * 100);
        const cheios = Math.round(pct / 5);
        return `\`${'█'.repeat(cheios)}${'░'.repeat(20 - cheios)}\` **${pct.toFixed(1)}%**\n${atual.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`;
      },
    },
    {
      name: 'ascii',
      description: 'Escreve um texto curto em letras grandes.',
      options: [opt.texto('texto', 'Até 10 caracteres', true, { max: 10 })],
      run: ({ texto }) => {
        const mapa = {
          a: ' ▄▀█ ', b: '█▄▄▀ ', c: '█▀▀▄ ', d: '█▄▄▀ ', e: '█▀▀ ', f: '█▀▀ ',
          g: '█▀▀ ', h: '█▄▄█', i: ' █ ', j: ' ▄█', k: '█▄▀', l: '█▄▄', m: '█▄▄█',
          n: '█▄█', o: '█▀█', p: '█▀▄', q: '█▀█', r: '█▀▄', s: '▄▀▀', t: '▀█▀',
          u: '█▄█', v: '█▄█', w: '█▄█', x: '▀▄▀', y: '▀▄▀', z: '▀▀▄', ' ': '   ',
        };
        const letras = [...texto.toLowerCase()].map((c) => mapa[c] ?? c);
        return bloco(letras.join(' '));
      },
    },
  ],
});

function hslParaHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const canal = (n) => {
    const k = (n + h / 30) % 12;
    const cor = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * cor)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${canal(0)}${canal(8)}${canal(4)}`.toUpperCase();
}

function hexParaRgb(hex) {
  const limpo = hex.trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(limpo)) throw aviso(`\`${hex}\` não é uma cor hex válida. Use #RRGGBB.`);
  const valor = parseInt(limpo, 16);
  return [(valor >> 16) & 255, (valor >> 8) & 255, valor & 255];
}
