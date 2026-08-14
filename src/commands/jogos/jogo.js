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

const LOGICA = [
  [
    'Ana chegou antes de Bruno. Bruno chegou antes de Carla. Quem chegou por último?',
    'Carla',
  ],
  [
    'Todos os relatórios aprovados foram revisados. Este relatório não foi revisado. Ele pode ter sido aprovado?',
    'Não. Se tivesse sido aprovado, teria sido revisado.',
  ],
  [
    'Há três caixas: uma só com maçãs, uma só com laranjas e uma mista. Todos os rótulos estão errados. De qual caixa você tira uma fruta primeiro?',
    'Da caixa rotulada como “mista”, porque ela não pode ser mista.',
  ],
  [
    'Uma tarefa leva 6 horas para uma pessoa. Duas pessoas igualmente produtivas dividem o trabalho sem perda. Quanto tempo levam?',
    '3 horas',
  ],
];

const SUDOKUS = [
  [
    '1 . | . 4\n. 4 | 1 .\n----+----\n. 1 | 4 .\n4 . | . 1',
    '1 2 | 3 4\n3 4 | 1 2\n----+----\n2 1 | 4 3\n4 3 | 2 1',
  ],
  [
    '. 3 | 4 .\n4 . | . 2\n----+----\n1 . | . 3\n. 4 | 1 .',
    '2 3 | 4 1\n4 1 | 3 2\n----+----\n1 2 | 4 3\n3 4 | 1 2',
  ],
];

const PALAVRAS_PROIBIDAS = [
  ['backup', ['cópia', 'arquivo', 'segurança']],
  ['servidor', ['Discord', 'canal', 'membro']],
  ['prazo', ['data', 'entrega', 'tempo']],
  ['reunião', ['pauta', 'equipe', 'chamada']],
  ['senha', ['acesso', 'caractere', 'conta']],
  ['projeto', ['tarefa', 'equipe', 'entrega']],
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
  description: 'Reúne enigmas, lógica, memória, palavras e conhecimentos gerais.',
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
      name: 'codigo-secreto',
      description: 'Tente descobrir um código de quatro algarismos sem repetição.',
      run: () => {
        const codigo = embaralhar([...Array(10).keys()]).slice(0, 4).join('');
        return comResposta(
          'Código secreto',
          'O código tem **4 algarismos diferentes**. Cada pessoa pode mandar um palpite antes de revelar.',
          codigo,
        );
      },
    },
    {
      name: 'enigma',
      description: 'Apresenta um enigma com a resposta escondida.',
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
      description: 'Mostra uma curiosidade para compartilhar no servidor.',
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
      name: 'intruso',
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
      name: 'logica',
      description: 'Apresenta um problema curto de raciocínio lógico.',
      run: () => {
        const [problema, resposta] = escolher(LOGICA);
        return comResposta('Raciocínio lógico', problema, resposta);
      },
    },
    {
      name: 'duas-verdades',
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
      name: 'sudoku',
      description: 'Apresenta um sudoku 4×4 com a solução escondida.',
      run: () => {
        const [tabuleiro, solucao] = escolher(SUDOKUS);
        return comResposta('Sudoku 4×4', bloco(tabuleiro), bloco(solucao), 'use os números de 1 a 4');
      },
    },
    {
      name: 'categoria-relampago',
      description: 'Sorteia uma categoria e uma letra para uma rodada rápida.',
      run: () => {
        const categoria = escolher([
          'profissão', 'cidade', 'filme', 'objeto de escritório', 'tecnologia',
          'comida', 'marca', 'animal', 'música', 'livro',
        ]);
        const letra = escolher('ABCDEFGHILMNOPRSTUV'.split(''));
        return `## Categoria relâmpago\nEscreva um exemplo de **${categoria}** que comece com **${letra}**.\n\nA primeira resposta válida vence a rodada.`;
      },
    },
    {
      name: 'palavra-proibida',
      description: 'Sorteia uma palavra para explicar sem usar os termos proibidos.',
      run: () => {
        const [palavra, proibidas] = escolher(PALAVRAS_PROIBIDAS);
        return `## Palavra proibida\nFaça o grupo descobrir **${palavra}** sem dizer:\n${proibidas.map((item) => `• ${item}`).join('\n')}`;
      },
    },
  ],
});
