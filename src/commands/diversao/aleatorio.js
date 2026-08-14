import crypto from 'node:crypto';
import { aviso, bloco, familia, opt } from '../../lib/familia.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';
import { quantidade as qtd } from '../../lib/portugues.js';

/** Sorteio criptográfico: sem viés de módulo, ao contrário de Math.random(). */
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

const itens = (texto, minimo = 2) => {
  const partes = texto.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  if (partes.length < minimo) throw aviso(`Preciso de pelo menos ${minimo} itens, separados por vírgula.`);
  if (partes.length > 100) throw aviso('São no máximo 100 itens.');
  return partes;
};

const OPCOES = opt.texto('opcoes', 'Itens separados por vírgula', true, { max: 1500 });

const NAIPES = ['♠️', '♥️', '♦️', '♣️'];
const CARTAS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export default familia({
  name: 'aleatorio',
  // Promovidos a comando de topo: saem da família e viram /nome direto.
  atalhos: ['ponderado', 'amostra', 'decimal'],
  description: 'Faz sorteios, amostragens e distribuições aleatórias.',
  cooldown: 3,
  subs: [
    {
      name: 'numero',
      description: 'Sorteia um número num intervalo.',
      options: [
        opt.inteiro('minimo', 'Menor valor', true, { min: -1_000_000, max: 1_000_000 }),
        opt.inteiro('maximo', 'Maior valor', true, { min: -1_000_000, max: 1_000_000 }),
      ],
      run: ({ minimo, maximo }) => {
        if (minimo >= maximo) throw aviso('O mínimo precisa ser menor que o máximo.');
        return `🎲 **${(minimo + sortear(maximo - minimo + 1)).toLocaleString('pt-BR')}**`;
      },
    },
    {
      name: 'chaveamento',
      description: 'Embaralha os nomes e monta confrontos em duplas.',
      options: [OPCOES],
      run: ({ opcoes }) => {
        const nomes = embaralhar(itens(opcoes));
        const confrontos = [];
        for (let i = 0; i < nomes.length; i += 2) {
          confrontos.push(
            nomes[i + 1]
              ? `**${confrontos.length + 1}.** ${nomes[i]} × ${nomes[i + 1]}`
              : `**${confrontos.length + 1}.** ${nomes[i]} avança sem adversário`,
          );
        }
        return `🏆 **Chaveamento sorteado**\n\n${confrontos.join('\n')}`;
      },
    },
    {
      name: 'escolher-varios',
      description: 'Escolhe vários itens sem repetir.',
      options: [OPCOES, opt.inteiro('quantidade', 'Quantos escolher', true, { min: 1, max: 50 })],
      run: ({ opcoes, quantidade }) => {
        const lista = itens(opcoes);
        if (quantidade > lista.length) throw aviso(`Você só me deu ${lista.length} itens.`);
        return embaralhar(lista).slice(0, quantidade).map((v, i) => `**${i + 1}.** ${v}`).join('\n');
      },
    },
    {
      name: 'ordenar',
      description: 'Embaralha a sua lista numa ordem aleatória.',
      options: [OPCOES],
      run: ({ opcoes }) => embaralhar(itens(opcoes)).map((v, i) => `**${i + 1}.** ${v}`).join('\n'),
    },
    {
      name: 'times',
      description: 'Divide os nomes em times equilibrados.',
      options: [OPCOES, opt.inteiro('times', 'Quantos times', true, { min: 2, max: 10 })],
      run: ({ opcoes, times }) => {
        const pessoas = embaralhar(itens(opcoes));
        if (times > pessoas.length) throw aviso('Tem mais times do que gente.');
        const grupos = Array.from({ length: times }, () => []);
        pessoas.forEach((pessoa, i) => grupos[i % times].push(pessoa));
        return grupos
          .map((grupo, i) => `**Time ${i + 1}** (${grupo.length})\n${grupo.join(', ')}`)
          .join('\n\n');
      },
    },
    {
      name: 'ponderado',
      description: 'Sorteia uma opção respeitando os pesos informados.',
      options: [opt.texto('opcoes', 'Use nome:peso e separe as opções por ponto e vírgula', true, { max: 1500 })],
      run: ({ opcoes }) => {
        const entradas = opcoes.split(/[;\n]+/).map((entrada) => {
          const separador = entrada.lastIndexOf(':');
          const nome = entrada.slice(0, separador).trim();
          const peso = Number(entrada.slice(separador + 1).trim().replace(',', '.'));
          if (separador < 1 || !nome || Number.isFinite(peso) === false || peso <= 0) {
            throw aviso('Use o formato `opção:peso`; exemplo: A:3; B:1.');
          }
          return { nome, peso };
        });
        if (entradas.length < 2 || entradas.length > 30) throw aviso('Informe de 2 a 30 opções.');
        const total = entradas.reduce((soma, entrada) => soma + entrada.peso, 0);
        let ponto = ((sortear(1_000_000) + 0.5) / 1_000_000) * total;
        const escolhida = entradas.find((entrada) => {
          ponto -= entrada.peso;
          return ponto <= 0;
        }) ?? entradas.at(-1);
        return `**Opção sorteada:** ${escolhida.nome}\n**Peso:** ${escolhida.peso.toLocaleString('pt-BR')}/${total.toLocaleString('pt-BR')}`;
      },
    },
    {
      name: 'moedas',
      description: 'Joga várias moedas de uma vez.',
      options: [opt.inteiro('quantidade', 'Quantas moedas', true, { min: 1, max: 100 })],
      run: ({ quantidade }) => {
        let caras = 0;
        const seq = Array.from({ length: quantidade }, () => {
          const cara = sortear(2) === 1;
          if (cara) caras += 1;
          return cara ? '🔵' : '⚪';
        });
        return `${seq.join('')}\n\n**${qtd(caras, 'cara')}** · **${qtd(quantidade - caras, 'coroa')}**`;
      },
    },
    {
      name: 'bingo',
      description: 'Sorteia números de bingo sem repetir.',
      options: [
        opt.inteiro('quantidade', 'Quantos números sortear', true, { min: 1, max: 50 }),
        opt.inteiro('maximo', 'Maior número possível', false, { min: 2, max: 1000 }),
      ],
      run: ({ quantidade, maximo }) => {
        const limite = maximo ?? 75;
        if (quantidade > limite) throw aviso(`Não dá para tirar ${quantidade} números diferentes de 1 a ${limite}.`);
        const numeros = embaralhar(Array.from({ length: limite }, (_, i) => i + 1))
          .slice(0, quantidade)
          .sort((a, b) => a - b);
        return `🎱 **Números sorteados**\n\n${numeros.map((n) => `\`${n}\``).join(' ')}`;
      },
    },
    {
      name: 'amostra',
      description: 'Sorteia uma amostra com reposição, permitindo resultados repetidos.',
      options: [
        OPCOES,
        opt.inteiro('quantidade', 'Tamanho da amostra', true, { min: 1, max: 100 }),
      ],
      run: ({ opcoes, quantidade }) => {
        const populacao = itens(opcoes);
        return Array.from({ length: quantidade }, (_, indice) =>
          `**${indice + 1}.** ${escolher(populacao)}`,
        ).join('\n');
      },
    },
    {
      name: 'maos',
      description: 'Distribui cartas para vários jogadores.',
      options: [
        opt.inteiro('jogadores', 'Quantos jogadores', true, { min: 1, max: 10 }),
        opt.inteiro('cartas', 'Cartas por jogador', true, { min: 1, max: 10 }),
      ],
      run: ({ jogadores, cartas }) => {
        if (jogadores * cartas > 52) throw aviso('O baralho tem 52 cartas — não dá para tanta gente.');
        const baralho = embaralhar(NAIPES.flatMap((naipe) => CARTAS.map((c) => `${c}${naipe}`)));
        return Array.from({ length: jogadores }, (_, i) =>
          `**Jogador ${i + 1}:** ${baralho.slice(i * cartas, (i + 1) * cartas).join('  ')}`,
        ).join('\n');
      },
    },
    {
      name: 'decimal',
      description: 'Sorteia um número decimal dentro de um intervalo.',
      options: [
        opt.numero('minimo', 'Menor valor', true, { min: -1_000_000_000, max: 1_000_000_000 }),
        opt.numero('maximo', 'Maior valor', true, { min: -1_000_000_000, max: 1_000_000_000 }),
        opt.inteiro('casas', 'Casas decimais; padrão 2', false, { min: 0, max: 8 }),
      ],
      run: ({ minimo, maximo, casas }) => {
        if (minimo >= maximo) throw aviso('O mínimo precisa ser menor que o máximo.');
        const precisao = casas ?? 2;
        const proporcao = (sortear(1_000_000_000) + 0.5) / 1_000_000_000;
        const valor = minimo + proporcao * (maximo - minimo);
        return `**${valor.toLocaleString('pt-BR', { minimumFractionDigits: precisao, maximumFractionDigits: precisao })}**`;
      },
    },
    {
      name: 'sim-ou-nao',
      description: 'Uma resposta direta para uma pergunta difícil.',
      options: [opt.texto('pergunta', 'A pergunta', false, { max: 300 })],
      run: ({ pergunta }) =>
        `${pergunta ? `**${pergunta}**\n\n` : ''}${escolher(['✅ **Sim.**', '❌ **Não.**', '🤷 **Talvez.**'])}`,
    },
    {
      name: 'porcentagem',
      description: 'Sorteia uma porcentagem para qualquer coisa.',
      options: [opt.texto('coisa', 'Sobre o quê', true, { max: 200 })],
      run: ({ coisa }) => {
        const valor = sortear(101);
        const barra = '█'.repeat(Math.round(valor / 5)).padEnd(20, '░');
        return `**${coisa}**\n\`${barra}\` **${valor}%**`;
      },
    },
    {
      name: 'letra',
      description: 'Sorteia uma letra do alfabeto.',
      run: () => `🔤 **${String.fromCharCode(65 + sortear(26))}**`,
    },
    {
      name: 'palavra',
      description: 'Sorteia uma palavra em português.',
      run: () =>
        `📖 **${escolher([
          'abacaxi', 'bicicleta', 'cachoeira', 'dinossauro', 'elefante', 'formiga',
          'girassol', 'harmonia', 'igreja', 'janela', 'kiwi', 'lagarto', 'montanha',
          'navio', 'oceano', 'pirâmide', 'quilombo', 'relâmpago', 'saudade', 'tartaruga',
          'universo', 'violão', 'xadrez', 'zebra', 'caneca', 'foguete', 'muralha',
        ])}**`,
    },
    {
      name: 'data',
      description: 'Sorteia uma data entre dois anos.',
      options: [
        opt.inteiro('de', 'Ano inicial', true, { min: 1, max: 3000 }),
        opt.inteiro('ate', 'Ano final', true, { min: 1, max: 3000 }),
      ],
      run: ({ de, ate }) => {
        if (de > ate) throw aviso('O ano inicial precisa vir antes do final.');
        const ano = de + sortear(ate - de + 1);
        const mes = sortear(12);
        const dia = 1 + sortear(new Date(ano, mes + 1, 0).getDate());
        return `📅 **${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano}**`;
      },
    },
    {
      name: 'hora',
      description: 'Sorteia um horário.',
      run: () => `🕐 **${String(sortear(24)).padStart(2, '0')}:${String(sortear(60)).padStart(2, '0')}**`,
    },
    {
      name: 'duelo',
      description: 'Coloca dois nomes para duelar.',
      options: [
        opt.texto('a', 'Primeiro nome', true, { max: 100 }),
        opt.texto('b', 'Segundo nome', true, { max: 100 }),
      ],
      run: ({ a, b }) => {
        const vencedor = sortear(2) ? a : b;
        return `⚔️ **${a}** vs **${b}**\n\n🏆 Venceu: **${vencedor}**`;
      },
    },
    {
      name: 'placar',
      description: 'Sorteia um placar entre dois times.',
      options: [
        opt.texto('mandante', 'Nome do primeiro time', true, { max: 80 }),
        opt.texto('visitante', 'Nome do segundo time', true, { max: 80 }),
        opt.inteiro('maximo', 'Máximo de pontos por time', false, { min: 1, max: 20 }),
      ],
      run: ({ mandante, visitante, maximo }) => {
        const teto = maximo ?? 5;
        return `🏟️ **${mandante} ${sortear(teto + 1)} × ${sortear(teto + 1)} ${visitante}**`;
      },
    },
    {
      name: 'distribuicao-normal',
      description: 'Gera valores aproximados de uma distribuição normal.',
      options: [
        opt.numero('media', 'Média desejada', true, { min: -1_000_000, max: 1_000_000 }),
        opt.numero('desvio', 'Desvio padrão, maior que zero', true, { min: 0.0001, max: 1_000_000 }),
        opt.inteiro('quantidade', 'Quantidade de valores', true, { min: 1, max: 50 }),
        opt.inteiro('casas', 'Casas decimais; padrão 2', false, { min: 0, max: 6 }),
      ],
      run: ({ media, desvio, quantidade, casas }) => {
        const precisao = casas ?? 2;
        const valores = Array.from({ length: quantidade }, () => {
          const u1 = (sortear(1_000_000) + 1) / 1_000_001;
          const u2 = (sortear(1_000_000) + 1) / 1_000_001;
          const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          return media + normal * desvio;
        });
        return bloco(valores.map((valor) => valor.toFixed(precisao)).join('\n'));
      },
    },
    {
      name: 'par-ou-impar',
      description: 'Joga par ou ímpar contra o bot.',
      options: [
        { kind: 'string', name: 'escolha', description: 'Sua escolha', required: true,
          choices: [{ name: 'Par', value: 'par' }, { name: 'Ímpar', value: 'impar' }] },
        opt.inteiro('numero', 'Seu número (0 a 10)', true, { min: 0, max: 10 }),
      ],
      run: ({ escolha, numero }) => {
        const bot = sortear(11);
        const soma = numero + bot;
        const resultado = soma % 2 === 0 ? 'par' : 'impar';
        const ganhou = resultado === escolha;
        return `Você: **${numero}** · Bot: **${bot}**\nSoma: **${soma}** (${resultado === 'par' ? 'par' : 'ímpar'})\n\n${ganhou ? '🎉 **Você ganhou!**' : '😔 **O bot ganhou.**'}`;
      },
    },
    {
      name: 'senha-sorteio',
      description: 'Sorteia um número secreto e mostra só para você.',
      options: [opt.inteiro('maximo', 'Maior valor possível', true, { min: 2, max: 1_000_000 })],
      run: ({ maximo }) => ({
        embeds: [embed.base(colors.primary).setDescription(`🤫 Seu número: **${1 + sortear(maximo)}**`)],
        flags: 64,
      }),
    },
    {
      name: 'distribuicao',
      description: 'Gera parcelas aleatórias que somam exatamente 100%.',
      options: [opt.inteiro('partes', 'Quantidade de parcelas', true, { min: 2, max: 20 })],
      run: ({ partes }) => {
        const pesos = Array.from({ length: partes }, () => {
          const uniforme = (sortear(1_000_000) + 1) / 1_000_001;
          return -Math.log(uniforme);
        });
        const total = pesos.reduce((soma, peso) => soma + peso, 0);
        const centesimos = pesos.map((peso) => Math.floor(peso / total * 10_000));
        centesimos[centesimos.length - 1] += 10_000 - centesimos.reduce((soma, valor) => soma + valor, 0);
        return centesimos
          .map((valor, indice) => `**Parte ${indice + 1}:** ${(valor / 100).toFixed(2).replace('.', ',')}%`)
          .join('\n');
      },
    },
    {
      name: 'coordenada',
      description: 'Gera uma coordenada geográfica aleatória dentro de limites.',
      options: [
        opt.numero('latitude-minima', 'Latitude mínima', true, { min: -90, max: 90 }),
        opt.numero('latitude-maxima', 'Latitude máxima', true, { min: -90, max: 90 }),
        opt.numero('longitude-minima', 'Longitude mínima', true, { min: -180, max: 180 }),
        opt.numero('longitude-maxima', 'Longitude máxima', true, { min: -180, max: 180 }),
        opt.inteiro('casas', 'Casas decimais; padrão 6', false, { min: 0, max: 8 }),
      ],
      run: ({
        'latitude-minima': latitudeMinima,
        'latitude-maxima': latitudeMaxima,
        'longitude-minima': longitudeMinima,
        'longitude-maxima': longitudeMaxima,
        casas,
      }) => {
        if (latitudeMinima >= latitudeMaxima || longitudeMinima >= longitudeMaxima) {
          throw aviso('Cada limite mínimo precisa ser menor que o máximo correspondente.');
        }
        const unidade = () => (sortear(1_000_000_000) + 0.5) / 1_000_000_000;
        const latitude = latitudeMinima + unidade() * (latitudeMaxima - latitudeMinima);
        const longitude = longitudeMinima + unidade() * (longitudeMaxima - longitudeMinima);
        const precisao = casas ?? 6;
        return bloco(`${latitude.toFixed(precisao)}, ${longitude.toFixed(precisao)}`);
      },
    },
    {
      name: 'reprodutivel',
      description: 'Escolhe uma opção de forma estável a partir de uma semente.',
      options: [
        OPCOES,
        opt.texto('semente', 'Texto que determina o resultado', true, { max: 500 }),
      ],
      run: ({ opcoes, semente }) => {
        const lista = itens(opcoes);
        const hash = crypto.createHash('sha256').update(semente).digest();
        const indice = hash.readUInt32BE(0) % lista.length;
        return `**Opção escolhida:** ${lista[indice]}\n**Semente:** \`${semente.replaceAll('`', '´')}\``;
      },
    },
  ],
});
