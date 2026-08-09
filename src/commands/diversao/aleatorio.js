import crypto from 'node:crypto';
import { aviso, bloco, familia, opt } from '../../lib/familia.js';
import { colors } from '../../config.js';
import { embed } from '../../lib/embeds.js';

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
  atalhos: ['moeda', 'roleta', 'carta'],
  description: 'Sorteios, dados, cartas e escolhas ao acaso.',
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
      name: 'escolher',
      description: 'Escolhe um item da sua lista.',
      options: [OPCOES],
      run: ({ opcoes }) => `Escolhi: **${escolher(itens(opcoes))}**`,
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
      name: 'moeda',
      description: 'Cara ou coroa.',
      run: () => (sortear(2) ? '🪙 **Cara!**' : '🪙 **Coroa!**'),
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
        return `${seq.join('')}\n\n**${caras}** cara(s) · **${quantidade - caras}** coroa(s)`;
      },
    },
    {
      name: 'dado',
      description: 'Rola dados no formato 2d6, 1d20…',
      options: [opt.texto('formato', 'Ex.: 2d6, 1d20, 4d10', true, { max: 20 })],
      run: ({ formato }) => {
        const partida = /^(\d{1,2})?d(\d{1,3})$/i.exec(formato.trim());
        if (!partida) throw aviso('Use o formato `NdL`, como `2d6` ou `1d20`.');
        const quantos = Number(partida[1] ?? 1);
        const lados = Number(partida[2]);
        if (quantos < 1 || quantos > 50) throw aviso('De 1 a 50 dados.');
        if (lados < 2 || lados > 1000) throw aviso('O dado precisa ter de 2 a 1000 lados.');
        const rolagens = Array.from({ length: quantos }, () => sortear(lados) + 1);
        const soma = rolagens.reduce((a, b) => a + b, 0);
        return `🎲 \`${formato.trim()}\`\n${rolagens.join(' + ')}${quantos > 1 ? `\n\n**Total: ${soma}**` : `\n\n**${soma}**`}`;
      },
    },
    {
      name: 'carta',
      description: 'Tira uma carta do baralho.',
      run: () => `🃏 **${escolher(CARTAS)}${escolher(NAIPES)}**`,
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
      name: 'roleta',
      description: 'Gira a roleta e sorteia um número de 0 a 36.',
      run: () => {
        const numero = sortear(37);
        const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        const cor = numero === 0 ? '🟢 verde' : vermelhos.includes(numero) ? '🔴 vermelho' : '⚫ preto';
        return `🎡 Caiu no **${numero}** — ${cor}${numero === 0 ? '' : `, ${numero % 2 ? 'ímpar' : 'par'}`}`;
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
      name: 'ppt',
      description: 'Pedra, papel ou tesoura sozinho.',
      run: () => `✊✋✌️ Saiu **${escolher(['pedra ✊', 'papel ✋', 'tesoura ✌️'])}**`,
    },
    {
      name: 'ordem-fila',
      description: 'Sorteia a ordem de uma fila de nomes.',
      options: [OPCOES],
      run: ({ opcoes }) =>
        embaralhar(itens(opcoes))
          .map((nome, i) => `${['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`} ${nome}`)
          .join('\n'),
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
      name: 'cor',
      description: 'Sorteia uma cor e mostra o código dela.',
      run: () => {
        const valor = sortear(0xffffff + 1);
        const hex = `#${valor.toString(16).padStart(6, '0').toUpperCase()}`;
        return {
          embeds: [
            embed
              .base(valor)
              .setTitle(hex)
              .setDescription(`RGB: \`${(valor >> 16) & 255}, ${(valor >> 8) & 255}, ${valor & 255}\``)
              .setThumbnail(`https://singlecolorimage.com/get/${hex.slice(1)}/120x120`),
          ],
        };
      },
    },
    {
      name: 'emoji',
      description: 'Sorteia um emoji.',
      run: () =>
        `${escolher([
          '😀','😂','🥰','😎','🤔','😭','🥳','😴','🤯','🫠','👽','🤖','🎃','👻','🐶','🐱',
          '🦊','🐼','🦄','🐙','🍕','🍔','🌮','🍩','⚽','🎮','🎸','🚀','🌈','⭐','🔥','💎',
        ])}`,
    },
    {
      name: 'bits',
      description: 'Gera bytes aleatórios em hexadecimal.',
      options: [opt.inteiro('bytes', 'Quantos bytes (1 a 64)', true, { min: 1, max: 64 })],
      run: ({ bytes }) => bloco(crypto.randomBytes(bytes).toString('hex')),
    },
  ],
});
