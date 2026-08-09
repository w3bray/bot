import crypto from 'node:crypto';
import { aviso, bloco, familia, opt } from '../../lib/familia.js';

const T = (descricao = 'O texto', max = 1500) => opt.texto('texto', descricao, true, { max });

const MORSE = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
  i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.',
  q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
  y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-',
  ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '@': '.--.-.',
};
const MORSE_INVERSO = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

const semAcento = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const hash = (algoritmo, texto) => crypto.createHash(algoritmo).update(texto, 'utf8').digest('hex');

const rot = (texto, n) =>
  texto.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + n + 26) % 26) + base);
  });

export default familia({
  name: 'codigo',
  description: 'Codificar, decodificar, gerar hash e inspecionar texto.',
  cooldown: 3,
  subs: [
    {
      name: 'base64-codificar',
      description: 'Codifica o texto em Base64.',
      options: [T()],
      run: ({ texto }) => bloco(Buffer.from(texto, 'utf8').toString('base64')),
    },
    {
      name: 'base64-decodificar',
      description: 'Volta um Base64 para texto.',
      options: [T('O Base64')],
      run: ({ texto }) => {
        const limpo = texto.trim().replace(/\s/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(limpo)) throw aviso('Isso não parece um Base64 válido.');
        const saida = Buffer.from(limpo, 'base64').toString('utf8');
        if (!saida) throw aviso('Não consegui decodificar — confira se o texto está completo.');
        return bloco(saida);
      },
    },
    {
      name: 'hex-codificar',
      description: 'Codifica o texto em hexadecimal.',
      options: [T()],
      run: ({ texto }) => bloco(Buffer.from(texto, 'utf8').toString('hex')),
    },
    {
      name: 'hex-decodificar',
      description: 'Volta um hexadecimal para texto.',
      options: [T('O hexadecimal')],
      run: ({ texto }) => {
        const limpo = texto.trim().replace(/[\s:]/g, '');
        if (!/^[0-9a-f]*$/i.test(limpo) || limpo.length % 2) throw aviso('Hexadecimal inválido.');
        return bloco(Buffer.from(limpo, 'hex').toString('utf8'));
      },
    },
    {
      name: 'binario-codificar',
      description: 'Escreve o texto em binário.',
      options: [T('O texto', 400)],
      run: ({ texto }) =>
        bloco(
          [...Buffer.from(texto, 'utf8')].map((b) => b.toString(2).padStart(8, '0')).join(' '),
        ),
    },
    {
      name: 'binario-decodificar',
      description: 'Volta um binário para texto.',
      options: [T('O binário')],
      run: ({ texto }) => {
        const bytes = texto.trim().split(/\s+/);
        if (!bytes.every((b) => /^[01]{1,8}$/.test(b))) throw aviso('Isso não é um binário válido.');
        return bloco(Buffer.from(bytes.map((b) => parseInt(b, 2))).toString('utf8'));
      },
    },
    {
      name: 'morse-codificar',
      description: 'Traduz o texto para código Morse.',
      options: [T('O texto', 300)],
      run: ({ texto }) =>
        bloco(
          semAcento(texto)
            .toLowerCase()
            .split('')
            .map((c) => (c === ' ' ? '/' : (MORSE[c] ?? '')))
            .filter(Boolean)
            .join(' '),
        ),
    },
    {
      name: 'morse-decodificar',
      description: 'Traduz código Morse de volta para texto.',
      options: [T('O Morse (separe com espaço, / para espaço)')],
      run: ({ texto }) =>
        bloco(
          texto
            .trim()
            .split(/\s+/)
            .map((s) => (s === '/' ? ' ' : (MORSE_INVERSO[s] ?? '?')))
            .join(''),
        ),
    },
    {
      name: 'url-codificar',
      description: 'Escapa o texto para uso em URL.',
      options: [T()],
      run: ({ texto }) => bloco(encodeURIComponent(texto)),
    },
    {
      name: 'url-decodificar',
      description: 'Desfaz o escape de URL.',
      options: [T('O texto codificado')],
      run: ({ texto }) => {
        try {
          return bloco(decodeURIComponent(texto));
        } catch {
          throw aviso('Esse texto tem um escape de URL inválido.');
        }
      },
    },
    {
      name: 'rot13',
      description: 'Aplica a cifra ROT13 (aplicar de novo desfaz).',
      options: [T()],
      run: ({ texto }) => bloco(rot(texto, 13)),
    },
    {
      name: 'cesar',
      description: 'Cifra de César com deslocamento à sua escolha.',
      options: [T(), opt.inteiro('deslocamento', 'De -25 a 25', true, { min: -25, max: 25 })],
      run: ({ texto, deslocamento }) => bloco(rot(texto, deslocamento)),
    },
    {
      name: 'md5',
      description: 'Hash MD5 do texto.',
      options: [T()],
      run: ({ texto }) => bloco(hash('md5', texto)),
    },
    {
      name: 'sha1',
      description: 'Hash SHA-1 do texto.',
      options: [T()],
      run: ({ texto }) => bloco(hash('sha1', texto)),
    },
    {
      name: 'sha256',
      description: 'Hash SHA-256 do texto.',
      options: [T()],
      run: ({ texto }) => bloco(hash('sha256', texto)),
    },
    {
      name: 'sha512',
      description: 'Hash SHA-512 do texto.',
      options: [T()],
      run: ({ texto }) => bloco(hash('sha512', texto)),
    },
    {
      name: 'unicode',
      description: 'Mostra o código Unicode de cada caractere.',
      options: [opt.texto('texto', 'Até 60 caracteres', true, { max: 60 })],
      run: ({ texto }) =>
        bloco(
          [...texto]
            .map((c) => `${c}  U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
            .join('\n'),
        ),
    },
    {
      name: 'json-formatar',
      description: 'Formata (ou valida) um JSON.',
      options: [T('O JSON', 1500)],
      run: ({ texto }) => {
        try {
          return bloco(JSON.stringify(JSON.parse(texto), null, 2), 'json');
        } catch (error) {
          throw aviso(`JSON inválido: ${error.message}`);
        }
      },
    },
    {
      name: 'json-compactar',
      description: 'Tira os espaços de um JSON.',
      options: [T('O JSON', 1500)],
      run: ({ texto }) => {
        try {
          return bloco(JSON.stringify(JSON.parse(texto)), 'json');
        } catch (error) {
          throw aviso(`JSON inválido: ${error.message}`);
        }
      },
    },
    {
      name: 'timestamp',
      description: 'Cria um horário dinâmico do Discord a partir de uma data.',
      options: [
        opt.texto('data', 'Ex.: 2026-12-25 20:00', true, { max: 40 }),
        {
          kind: 'string',
          name: 'formato',
          description: 'Como mostrar',
          required: false,
          choices: [
            { name: 'Relativo (em 3 dias)', value: 'R' },
            { name: 'Data curta (25/12/2026)', value: 'd' },
            { name: 'Data longa (25 de dezembro de 2026)', value: 'D' },
            { name: 'Data e hora', value: 'f' },
            { name: 'Completo com dia da semana', value: 'F' },
            { name: 'Só a hora', value: 't' },
          ],
        },
      ],
      run: ({ data, formato }) => {
        const quando = new Date(data.replace(' ', 'T'));
        if (Number.isNaN(quando.getTime())) {
          throw aviso('Não entendi essa data. Use o formato `2026-12-25 20:00`.');
        }
        const segundos = Math.floor(quando.getTime() / 1000);
        const f = formato ?? 'F';
        return `<t:${segundos}:${f}>\n\nPara copiar:\n\`<t:${segundos}:${f}>\``;
      },
    },
  ],
});
