import { aviso, bloco, familia, opt } from '../../lib/familia.js';

const T = (max = 1000) => opt.texto('texto', 'O texto', true, { max });

const semAcento = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const embaralhar = (itens) => {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

const LEET = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', b: '8', g: '9' };

// Letras de largura total (U+FF01–U+FF5E) ficam 65248 posições acima do ASCII.
const larguraTotal = (texto) =>
  [...texto]
    .map((c) => {
      const codigo = c.charCodeAt(0);
      if (codigo === 32) return '　';
      return codigo > 32 && codigo < 127 ? String.fromCharCode(codigo + 65248) : c;
    })
    .join('');

const linhas = (texto) => texto.split(/\r?\n/);

export default familia({
  name: 'texto',
  description: 'Transformações de texto: caixa, ordem, limpeza, contagem e efeitos.',
  cooldown: 3,
  subs: [
    {
      name: 'maiusculas',
      description: 'Deixa tudo em MAIÚSCULAS.',
      options: [T()],
      run: ({ texto }) => bloco(texto.toUpperCase()),
    },
    {
      name: 'minusculas',
      description: 'Deixa tudo em minúsculas.',
      options: [T()],
      run: ({ texto }) => bloco(texto.toLowerCase()),
    },
    {
      name: 'titulo',
      description: 'Deixa A Primeira Letra De Cada Palavra Maiúscula.',
      options: [T()],
      run: ({ texto }) =>
        bloco(texto.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, antes, letra) => antes + letra.toUpperCase())),
    },
    {
      name: 'frase',
      description: 'Deixa só a primeira letra de cada frase maiúscula.',
      options: [T()],
      run: ({ texto }) =>
        bloco(
          texto
            .toLowerCase()
            .replace(/(^|[.!?]\s+)(\p{L})/gu, (_, antes, letra) => antes + letra.toUpperCase()),
        ),
    },
    {
      name: 'alternado',
      description: 'DeIxA o TeXtO aSsIm.',
      options: [T()],
      run: ({ texto }) =>
        bloco([...texto].map((c, i) => (i % 2 ? c.toLowerCase() : c.toUpperCase())).join('')),
    },
    {
      name: 'inverter',
      description: 'Inverte a ordem dos caracteres.',
      options: [T()],
      run: ({ texto }) => bloco([...texto].reverse().join('')),
    },
    {
      name: 'inverter-palavras',
      description: 'Inverte a ordem das palavras, mantendo cada uma legível.',
      options: [T()],
      run: ({ texto }) => bloco(texto.split(/\s+/).reverse().join(' ')),
    },
    {
      name: 'embaralhar',
      description: 'Embaralha as letras do texto.',
      options: [T()],
      run: ({ texto }) => bloco(embaralhar([...texto]).join('')),
    },
    {
      name: 'espacado',
      description: 'S e p a r a   c a d a   l e t r a.',
      options: [T(500)],
      run: ({ texto }) => bloco([...texto].join(' ')),
    },
    {
      name: 'largura-total',
      description: 'Ｅｓｃｒｉｔａ ｌａｒｇａ, estilo vaporwave.',
      options: [T(300)],
      run: ({ texto }) => bloco(larguraTotal(texto)),
    },
    {
      name: 'leet',
      description: 'Troca letras por números: l33t sp34k.',
      options: [T()],
      run: ({ texto }) => bloco(texto.replace(/[aeiostbg]/gi, (c) => LEET[c.toLowerCase()] ?? c)),
    },
    {
      name: 'emoji',
      description: 'Escreve com os emojis de letra do Discord.',
      options: [opt.texto('texto', 'Até 60 caracteres', true, { max: 60 })],
      run: ({ texto }) =>
        semAcento(texto)
          .toLowerCase()
          .split('')
          .map((c) => {
            if (c >= 'a' && c <= 'z') return `:regional_indicator_${c}:`;
            if (c >= '0' && c <= '9') {
              const nomes = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
              return `:${nomes[Number(c)]}:`;
            }
            return c === ' ' ? '   ' : c;
          })
          .join(' '),
    },
    {
      name: 'sem-acento',
      description: 'Remove todos os acentos.',
      options: [T()],
      run: ({ texto }) => bloco(semAcento(texto)),
    },
    {
      name: 'slug',
      description: 'Transforma em endereço-amigavel-assim.',
      options: [T()],
      run: ({ texto }) =>
        bloco(
          semAcento(texto)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || '(vazio)',
        ),
    },
    {
      name: 'limpar',
      description: 'Tira espaços repetidos e linhas em branco sobrando.',
      options: [T(1500)],
      run: ({ texto }) =>
        bloco(
          texto
            .split(/\r?\n/)
            .map((linha) => linha.replace(/\s+/g, ' ').trim())
            .filter((linha, i, todas) => linha !== '' || todas[i - 1] !== '')
            .join('\n')
            .trim() || '(vazio)',
        ),
    },
    {
      name: 'contar',
      description: 'Conta caracteres, palavras, linhas e frases.',
      options: [T(1500)],
      run: ({ texto }) => {
        const palavras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
        const frases = texto.split(/[.!?]+\s|[.!?]+$/).filter((f) => f.trim()).length;
        return [
          `**${texto.length}** caracteres`,
          `**${texto.replace(/\s/g, '').length}** sem espaços`,
          `**${palavras}** palavras`,
          `**${linhas(texto).length}** linhas`,
          `**${frases}** frases`,
        ].join('\n');
      },
    },
    {
      name: 'frequencia',
      description: 'Mostra as letras mais usadas no texto.',
      options: [T(1500)],
      run: ({ texto }) => {
        const contagem = new Map();
        for (const c of semAcento(texto).toLowerCase()) {
          if (/[a-z]/.test(c)) contagem.set(c, (contagem.get(c) ?? 0) + 1);
        }
        if (contagem.size === 0) throw aviso('Não achei nenhuma letra nesse texto.');
        const total = [...contagem.values()].reduce((a, b) => a + b, 0);
        return [...contagem.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([letra, n]) => {
            const pct = (n / total) * 100;
            return `\`${letra}\` ${'█'.repeat(Math.max(1, Math.round(pct / 2)))} ${n} (${pct.toFixed(1)}%)`;
          })
          .join('\n');
      },
    },
    {
      name: 'repetir',
      description: 'Repete o texto N vezes.',
      options: [
        opt.texto('texto', 'O texto', true, { max: 200 }),
        opt.inteiro('vezes', 'Quantas vezes (1 a 50)', true, { min: 1, max: 50 }),
      ],
      run: ({ texto, vezes }) => bloco(Array(vezes).fill(texto).join(' ')),
    },
    {
      name: 'substituir',
      description: 'Troca todas as ocorrências de um trecho por outro.',
      options: [
        T(1500),
        opt.texto('procurar', 'O que procurar', true, { max: 100 }),
        opt.texto('trocar', 'O que colocar no lugar', false, { max: 100 }),
      ],
      run: ({ texto, procurar, trocar }) => {
        const resultado = texto.replaceAll(procurar, trocar ?? '');
        const trocas = texto.split(procurar).length - 1;
        return `${trocas} troca(s).\n${bloco(resultado)}`;
      },
    },
    {
      name: 'cortar',
      description: 'Corta o texto num tamanho máximo.',
      options: [T(1500), opt.inteiro('tamanho', 'Quantos caracteres manter', true, { min: 1, max: 1500 })],
      run: ({ texto, tamanho }) =>
        bloco(texto.length > tamanho ? `${texto.slice(0, tamanho)}…` : texto),
    },
    {
      name: 'numerar',
      description: 'Numera as linhas do texto.',
      options: [T(1500)],
      run: ({ texto }) => {
        const todas = linhas(texto);
        const largura = String(todas.length).length;
        return bloco(todas.map((l, i) => `${String(i + 1).padStart(largura)} | ${l}`).join('\n'));
      },
    },
    {
      name: 'ordenar',
      description: 'Ordena as linhas em ordem alfabética.',
      options: [T(1500), opt.sim('invertido', 'Ordenar de trás para frente')],
      run: ({ texto, invertido }) => {
        const ordenadas = linhas(texto).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        return bloco((invertido ? ordenadas.reverse() : ordenadas).join('\n'));
      },
    },
    {
      name: 'unicos',
      description: 'Remove linhas repetidas.',
      options: [T(1500)],
      run: ({ texto }) => {
        const todas = linhas(texto);
        const unicas = [...new Set(todas)];
        return `Removi **${todas.length - unicas.length}** repetida(s).\n${bloco(unicas.join('\n'))}`;
      },
    },
    {
      name: 'censurar',
      description: 'Esconde uma palavra atrás de asteriscos.',
      options: [T(1500), opt.texto('palavra', 'A palavra a esconder', true, { max: 50 })],
      run: ({ texto, palavra }) => {
        const escapada = palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return bloco(texto.replace(new RegExp(escapada, 'gi'), (m) => '*'.repeat(m.length)));
      },
    },
    {
      name: 'escapar',
      description: 'Neutraliza a formatação do Discord no texto.',
      options: [T()],
      run: ({ texto }) => texto.replace(/([*_`~|\\>])/g, '\\$1'),
    },
  ],
});
