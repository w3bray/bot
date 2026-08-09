import crypto from 'node:crypto';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';
import { aviso, bloco, familia, opt } from '../../lib/familia.js';

const sortear = (max) => crypto.randomInt(max);
const escolher = (itens) => itens[sortear(itens.length)];

const embaralhar = (itens) => {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = sortear(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

/**
 * A resposta vai escondida num spoiler do Discord.
 *
 * Assim cada jogo cabe numa única mensagem, sem guardar estado nenhum: quem
 * quiser conferir clica; quem não quiser, continua tentando. Um jogo com
 * estado exigiria tabela, expiração e limpeza — para um passatempo, não paga.
 */
const comResposta = (titulo, desafio, resposta, dica = null) => ({
  embeds: [
    embed.base(colors.primary)
      .setTitle(titulo)
      .setDescription([desafio, dica ? `\n_Dica: ${dica}_` : '', `\n**Resposta:** ||${resposta}||`].join('\n')),
  ],
});

const PALAVRAS = [
  'abacaxi', 'bicicleta', 'cachoeira', 'dinossauro', 'elefante', 'formiga', 'girassol',
  'harmonia', 'inverno', 'janela', 'lagarto', 'montanha', 'navio', 'oceano', 'pirâmide',
  'relâmpago', 'saudade', 'tartaruga', 'universo', 'violão', 'xadrez', 'zebra',
  'computador', 'geladeira', 'travesseiro', 'borboleta', 'foguete', 'muralha', 'caderno',
];

const CAPITAIS = [
  ['Brasil', 'Brasília'], ['Argentina', 'Buenos Aires'], ['Portugal', 'Lisboa'],
  ['Japão', 'Tóquio'], ['Canadá', 'Ottawa'], ['Austrália', 'Camberra'],
  ['Egito', 'Cairo'], ['Peru', 'Lima'], ['Noruega', 'Oslo'], ['Índia', 'Nova Déli'],
  ['Turquia', 'Ancara'], ['Marrocos', 'Rabat'], ['Vietnã', 'Hanói'],
];

const ENIGMAS = [
  ['O que é, o que é: quanto mais se tira, maior fica?', 'um buraco'],
  ['Tenho cidades, mas não casas. Tenho montanhas, mas não árvores. O que sou?', 'um mapa'],
  ['O que sobe e nunca desce?', 'a idade'],
  ['Quanto mais você me tem, menos você vê. O que sou?', 'a escuridão'],
  ['Estou sempre à sua frente, mas você nunca me vê. O que sou?', 'o futuro'],
  ['O que tem pescoço mas não tem cabeça?', 'a garrafa'],
  ['Quebro sem nunca ter sido tocado. O que sou?', 'uma promessa'],
  ['Tenho dentes mas não mordo. O que sou?', 'o pente'],
];

const EMOJI_FILME = [
  ['🦁👑', 'O Rei Leão'], ['🚢🧊💔', 'Titanic'], ['🕷️🕸️👦', 'Homem-Aranha'],
  ['🐠🔍', 'Procurando Nemo'], ['🧙‍♂️💍🌋', 'O Senhor dos Anéis'],
  ['🦖🏝️', 'Jurassic Park'], ['👻🚫', 'Os Caça-Fantasmas'], ['🤖❤️🌱', 'WALL·E'],
  ['🚗⚡🏁', 'Carros'], ['❄️👭⛄', 'Frozen'],
];

const CURIOSIDADES = [
  'O mel não estraga: já acharam potes comestíveis em tumbas egípcias.',
  'Polvos têm três corações e sangue azul.',
  'Um dia em Vênus é mais longo que um ano em Vênus.',
  'Bananas são levemente radioativas por causa do potássio.',
  'O Brasil faz fronteira com todos os países da América do Sul, menos Chile e Equador.',
  'Existem mais árvores na Terra do que estrelas na Via Láctea.',
  'O coração de uma baleia-azul pesa quase o mesmo que um carro pequeno.',
  'A torre Eiffel fica até 15 cm mais alta no verão, por dilatação do metal.',
];

const PREFERE = [
  ['nunca mais usar internet', 'nunca mais sair de casa'],
  ['ter dinheiro infinito', 'ter tempo infinito'],
  ['saber a hora da sua morte', 'saber a causa'],
  ['poder voar', 'poder ficar invisível'],
  ['viver 100 anos no passado', 'viver 100 anos no futuro'],
  ['comer só doce para sempre', 'comer só salgado para sempre'],
  ['ler pensamentos', 'ver o futuro'],
];

const FORCA = [
  '```\n  +---+\n      |\n      |\n      |\n =====\n```',
  '```\n  +---+\n  O   |\n      |\n      |\n =====\n```',
  '```\n  +---+\n  O   |\n  |   |\n      |\n =====\n```',
  '```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n =====\n```',
];

export default familia({
  name: 'jogo',
  // Promovidos a comando de topo: saem da família e viram /nome direto.
  atalhos: ['enigma', 'anagrama', 'curiosidade'],
  description: 'Passatempos: enigmas, anagramas, quiz, desafios e curiosidades.',
  cooldown: 3,
  subs: [
    {
      name: 'anagrama',
      description: 'Descubra a palavra com as letras embaralhadas.',
      run: () => {
        const palavra = escolher(PALAVRAS);
        return comResposta('🔤 Anagrama', `\`${embaralhar([...palavra]).join(' ').toUpperCase()}\``, palavra, `${palavra.length} letras`);
      },
    },
    {
      name: 'palavra-oculta',
      description: 'Adivinhe a palavra com letras escondidas.',
      run: () => {
        const palavra = escolher(PALAVRAS);
        const revelada = [...palavra].map((c, i) => (i === 0 || i === palavra.length - 1 || sortear(3) === 0 ? c : '_'));
        return comResposta('🕵️ Palavra oculta', `\`${revelada.join(' ').toUpperCase()}\``, palavra);
      },
    },
    {
      name: 'enigma',
      description: 'Um enigma para quebrar a cabeça.',
      run: () => {
        const [pergunta, resposta] = escolher(ENIGMAS);
        return comResposta('🧩 Enigma', `**${pergunta}**`, resposta);
      },
    },
    {
      name: 'capital',
      description: 'Qual é a capital deste país?',
      run: () => {
        const [pais, capital] = escolher(CAPITAIS);
        return comResposta('🌍 Capitais', `Qual é a capital de **${pais}**?`, capital);
      },
    },
    {
      name: 'pais-da-capital',
      description: 'De qual país é esta capital?',
      run: () => {
        const [pais, capital] = escolher(CAPITAIS);
        return comResposta('🌍 Capitais', `**${capital}** é a capital de qual país?`, pais);
      },
    },
    {
      name: 'emoji-filme',
      description: 'Adivinhe o filme pelos emojis.',
      run: () => {
        const [emojis, filme] = escolher(EMOJI_FILME);
        return comResposta('🎬 Filme por emoji', `# ${emojis}`, filme);
      },
    },
    {
      name: 'sequencia',
      description: 'Qual é o próximo número da sequência?',
      run: () => {
        const tipo = sortear(4);
        const inicio = 1 + sortear(9);
        const passo = 2 + sortear(8);
        let serie;
        let proximo;
        if (tipo === 0) {
          serie = Array.from({ length: 5 }, (_, i) => inicio + passo * i);
          proximo = inicio + passo * 5;
        } else if (tipo === 1) {
          serie = Array.from({ length: 5 }, (_, i) => inicio * 2 ** i);
          proximo = inicio * 2 ** 5;
        } else if (tipo === 2) {
          serie = Array.from({ length: 5 }, (_, i) => (inicio + i) ** 2);
          proximo = (inicio + 5) ** 2;
        } else {
          const fib = [inicio, inicio + passo];
          while (fib.length < 5) fib.push(fib.at(-1) + fib.at(-2));
          serie = fib;
          proximo = fib.at(-1) + fib.at(-2);
        }
        return comResposta('🔢 Sequência', `\`${serie.join(', ')}, ?\``, proximo);
      },
    },
    {
      name: 'conta-rapida',
      description: 'Uma conta de cabeça para resolver.',
      options: [
        { kind: 'string', name: 'nivel', description: 'Dificuldade', required: false,
          choices: [{ name: 'Fácil', value: 'f' }, { name: 'Médio', value: 'm' }, { name: 'Difícil', value: 'd' }] },
      ],
      run: ({ nivel }) => {
        const faixa = { f: 12, m: 40, d: 120 }[nivel ?? 'm'];
        const a = 2 + sortear(faixa);
        const b = 2 + sortear(faixa);
        const operador = escolher(['+', '−', '×']);
        const resultado = operador === '+' ? a + b : operador === '−' ? a - b : a * b;
        return comResposta('🧮 Conta rápida', `# ${a} ${operador} ${b} = ?`, resultado);
      },
    },
    {
      name: 'memoria',
      description: 'Memorize a sequência de emojis.',
      options: [opt.inteiro('tamanho', 'Quantos itens (3 a 10)', false, { min: 3, max: 10 })],
      run: ({ tamanho }) => {
        const bichos = ['🐶', '🐱', '🦊', '🐼', '🦁', '🐸', '🐵', '🐧', '🦄', '🐙'];
        const seq = Array.from({ length: tamanho ?? 5 }, () => escolher(bichos));
        return comResposta('🧠 Memória', 'Memorize a sequência e depois confira:', seq.join(' '), 'não vale espiar antes');
      },
    },
    {
      name: 'forca',
      description: 'Mostra uma palavra da forca com o desenho.',
      run: () => {
        const palavra = escolher(PALAVRAS);
        const erros = sortear(FORCA.length);
        const revelada = [...palavra].map((c) => (sortear(4) === 0 ? c : '_')).join(' ');
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle('🎯 Forca')
              .setDescription(`${FORCA[erros]}\n\`${revelada.toUpperCase()}\`\n\n**Resposta:** ||${palavra}||`),
          ],
        };
      },
    },
    {
      name: 'voce-prefere',
      description: 'Escolha entre duas opções difíceis.',
      run: () => {
        const [a, b] = escolher(PREFERE);
        return `🤔 **Você prefere…**\n\n🅰️ ${a}\n\n**ou**\n\n🅱️ ${b}`;
      },
    },
    {
      name: 'curiosidade',
      description: 'Uma curiosidade para o servidor.',
      run: () => `💡 **${escolher(CURIOSIDADES)}**`,
    },
    {
      name: 'verdade-ou-mentira',
      description: 'Uma afirmação: verdadeira ou falsa?',
      run: () => {
        const afirmacoes = [
          ['Morcegos são cegos.', 'MENTIRA — eles enxergam, só usam eco para se orientar no escuro.'],
          ['A Muralha da China é visível da Lua a olho nu.', 'MENTIRA — não é.'],
          ['O Sol é branco, não amarelo.', 'VERDADE — a atmosfera é que o deixa amarelado daqui.'],
          ['Peixes-dourados têm memória de 3 segundos.', 'MENTIRA — eles lembram por meses.'],
          ['Existe mais água doce congelada que líquida na Terra.', 'VERDADE — a maior parte está nas calotas.'],
          ['O Brasil já teve mais de uma capital.', 'VERDADE — Salvador, Rio de Janeiro e Brasília.'],
        ];
        const [frase, resposta] = escolher(afirmacoes);
        return comResposta('❓ Verdade ou mentira', `**${frase}**`, resposta);
      },
    },
    {
      name: 'odd-one-out',
      description: 'Descubra qual item não pertence ao grupo.',
      run: () => {
        const grupos = [
          [['cachorro', 'gato', 'cavalo', 'tubarão'], 'tubarão — os outros vivem em terra'],
          [['azul', 'verde', 'quadrado', 'vermelho'], 'quadrado — os outros são cores'],
          [['violão', 'piano', 'bateria', 'microfone'], 'microfone — os outros são instrumentos'],
          [['Marte', 'Vênus', 'Lua', 'Júpiter'], 'Lua — os outros são planetas'],
          [['2', '3', '5', '9'], '9 — os outros são primos'],
        ];
        const [itens, resposta] = escolher(grupos);
        return comResposta('🔍 Qual não pertence?', embaralhar(itens).map((i) => `• ${i}`).join('\n'), resposta);
      },
    },
    {
      name: 'criptograma',
      description: 'Decifre a frase cifrada.',
      run: () => {
        const frases = ['bom dia', 'boa sorte', 'ate mais', 'muito obrigado', 'tudo certo'];
        const frase = escolher(frases);
        const deslocamento = 1 + sortear(20);
        const cifrada = frase.replace(/[a-z]/g, (c) =>
          String.fromCharCode(((c.charCodeAt(0) - 97 + deslocamento) % 26) + 97),
        );
        return comResposta('🔐 Criptograma', `\`${cifrada.toUpperCase()}\``, frase, `cifra de César, deslocamento ${deslocamento}`);
      },
    },
    {
      name: 'soletrar',
      description: 'Soletre a palavra pelo alfabeto fonético.',
      run: () => {
        const alfabeto = {
          a: 'Alfa', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot',
          g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima',
          m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo',
          s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey',
          x: 'X-ray', y: 'Yankee', z: 'Zulu',
        };
        const palavra = escolher(PALAVRAS).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return comResposta(
          '📻 Alfabeto fonético',
          [...palavra].map((c) => alfabeto[c] ?? c).join(' — '),
          palavra,
        );
      },
    },
    {
      name: 'rima',
      description: 'Ache uma palavra que rime.',
      run: () => {
        const finais = ['ação', 'ente', 'inho', 'ada', 'oso', 'ura', 'eiro'];
        const final = escolher(finais);
        return `🎤 Mande uma palavra que termine em **-${final}**.\n\nQuem repetir uma já dita, perde!`;
      },
    },
    {
      name: 'acrostico',
      description: 'Monte uma frase com estas iniciais.',
      options: [opt.texto('palavra', 'A palavra base', true, { max: 12 })],
      run: ({ palavra }) => {
        const letras = [...palavra.toUpperCase()].filter((c) => /[A-ZÀ-Ú]/.test(c));
        if (letras.length < 2) throw aviso('Mande uma palavra com pelo menos 2 letras.');
        return `✍️ **Acróstico de ${palavra.toUpperCase()}**\n\n${letras.map((c) => `**${c}** — `).join('\n')}`;
      },
    },
    {
      name: 'digitacao',
      description: 'Uma frase para testar sua velocidade de digitação.',
      run: () =>
        `⌨️ **Copie e digite o mais rápido que conseguir:**\n\n${bloco(escolher([
          'o rato roeu a roupa do rei de roma',
          'a chuva caiu forte sobre o telhado antigo da casa',
          'programar e a arte de transformar cafe em codigo funcional',
          'nunca subestime o poder de um bom backup feito na hora certa',
        ]))}`,
    },
    {
      name: 'quantos',
      description: 'Chute quantos itens tem na imagem mental.',
      run: () => {
        const coisas = ['jujubas no pote', 'estrelas no céu daqui', 'grãos de arroz na tigela', 'folhas na árvore'];
        const total = 20 + sortear(480);
        return comResposta('🔢 Quantos?', `Quantos(as) **${escolher(coisas)}**?`, total);
      },
    },
    {
      name: 'dois-verdades',
      description: 'Duas verdades e uma mentira, para o servidor adivinhar.',
      run: () => '🎭 **Duas verdades e uma mentira**\n\nMande três frases sobre você — duas verdadeiras e uma falsa.\nO pessoal tenta adivinhar qual é a mentira!',
    },
    {
      name: 'historia',
      description: 'Começa uma história para o servidor continuar.',
      run: () =>
        `📖 **Continue a história:**\n\n_${escolher([
          'Era uma vez um servidor de Discord onde todo mundo dormia às 3 da manhã, até que um dia…',
          'O cachorro entrou na sala carregando algo que ninguém esperava:',
          'A energia caiu na cidade inteira. Só uma luz continuou acesa, e era da…',
          'Quando abri o pacote que chegou sem remetente, encontrei…',
        ])}_`,
    },
    {
      name: 'contagem',
      description: 'Explica o jogo de contagem do servidor.',
      run: () => '🔢 **Jogo da contagem**\n\nUma pessoa manda `1`, a próxima manda `2`, e assim por diante.\n\n**Regras:** ninguém manda dois números seguidos, e se alguém errar, volta para o `1`.',
    },
    {
      name: 'nunca-fiz',
      description: 'Um "eu nunca" para o servidor.',
      run: () =>
        `🙋 **Eu nunca…**\n\n${escolher([
          'perdi um voo.', 'menti a idade.', 'quebrei um osso.',
          'dormi numa aula ou reunião.', 'cantei no chuveiro achando que estava sozinho.',
          'mandei mensagem para a pessoa errada.', 'fingi que já tinha visto um filme.',
        ])}\n\nQuem já fez, reage com ✋`,
    },
    {
      name: 'sorteio-rapido',
      description: 'Sorteia um vencedor entre quem reagir.',
      options: [opt.texto('premio', 'O que está em jogo', true, { max: 200 })],
      run: async ({ premio }, interaction) => {
        await interaction.reply({
          embeds: [
            embed.base(colors.primary)
              .setTitle('🎉 Sorteio relâmpago')
              .setDescription(`**Prêmio:** ${premio}\n\nReaja com 🎉 para participar!\n\n_Depois use \`/sorteio\` para sorteios com prazo e ganhadores automáticos._`),
          ],
        });
        const mensagem = await interaction.fetchReply();
        await mensagem.react('🎉').catch(() => null);
        return null;
      },
    },
  ],
});
