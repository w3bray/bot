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

const NOMES_TESTE = ['Ana Lima', 'Bruno Rocha', 'Carla Nunes', 'Diego Alves', 'Elisa Martins'];
const STATUS_TESTE = ['ativo', 'pendente', 'inativo'];

function slug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function citarShell(texto) {
  return `'${String(texto).replaceAll("'", `'\"'\"'`)}'`;
}

function registroTeste(indice) {
  const nome = NOMES_TESTE[indice % NOMES_TESTE.length];
  return {
    id: indice + 1,
    nome,
    email: `${slug(nome).replaceAll('-', '.')}+${indice + 1}@example.com`,
    status: STATUS_TESTE[indice % STATUS_TESTE.length],
  };
}

export default familia({
  name: 'gerar',
  // Promovidos a comando de topo: saem da família e viram /nome direto.
  atalhos: ['senha', 'uuid'],
  description: 'Gera senhas, identificadores e arquivos auxiliares para projetos.',
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
      name: 'nome-branch',
      description: 'Gera um nome padronizado para uma branch do Git.',
      options: [
        { kind: 'string', name: 'tipo', description: 'Tipo da mudança', required: true,
          choices: [
            { name: 'Funcionalidade', value: 'feat' },
            { name: 'Correção', value: 'fix' },
            { name: 'Documentação', value: 'docs' },
            { name: 'Refatoração', value: 'refactor' },
            { name: 'Manutenção', value: 'chore' },
          ] },
        opt.texto('descricao', 'Resumo curto da mudança', true, { max: 200 }),
      ],
      run: ({ tipo, descricao }) => {
        const nome = slug(descricao);
        if (!nome) throw aviso('A descrição precisa ter letras ou números.');
        return bloco(`${tipo}/${nome}`);
      },
    },
    {
      name: 'nome-arquivo',
      description: 'Limpa um nome de arquivo e acrescenta extensão e data opcionais.',
      options: [
        opt.texto('nome', 'Nome que será normalizado', true, { max: 200 }),
        opt.texto('extensao', 'Extensão sem ponto, ex.: pdf', false, { max: 15 }),
        opt.sim('data', 'Acrescentar a data atual no início'),
      ],
      run: ({ nome, extensao, data }) => {
        const base = slug(nome);
        if (!base) throw aviso('O nome precisa ter letras ou números.');
        const prefixo = data ? `${new Date().toISOString().slice(0, 10)}-` : '';
        const ext = extensao?.replace(/[^a-z0-9]/gi, '').toLowerCase();
        return bloco(`${prefixo}${base}${ext ? `.${ext}` : ''}`);
      },
    },
    {
      name: 'commit',
      description: 'Monta uma mensagem no padrão Conventional Commits.',
      options: [
        { kind: 'string', name: 'tipo', description: 'Tipo da mudança', required: true,
          choices: [
            { name: 'feat — funcionalidade', value: 'feat' },
            { name: 'fix — correção', value: 'fix' },
            { name: 'docs — documentação', value: 'docs' },
            { name: 'refactor — refatoração', value: 'refactor' },
            { name: 'test — testes', value: 'test' },
            { name: 'chore — manutenção', value: 'chore' },
          ] },
        opt.texto('mensagem', 'Descrição curta no imperativo', true, { max: 200 }),
        opt.texto('escopo', 'Área afetada, ex.: pagamentos', false, { max: 50 }),
        opt.sim('quebra', 'Marcar como mudança incompatível'),
      ],
      run: ({ tipo, mensagem, escopo, quebra }) => {
        const cabecalho = `${tipo}${escopo ? `(${slug(escopo)})` : ''}${quebra ? '!' : ''}: ${mensagem.trim()}`;
        return bloco(cabecalho);
      },
    },
    {
      name: 'changelog',
      description: 'Gera uma entrada de changelog em Markdown.',
      options: [
        opt.texto('versao', 'Versão ou rótulo da entrega', true, { max: 50 }),
        opt.texto('itens', 'Mudanças separadas por ponto e vírgula', true, { max: 1800 }),
        opt.texto('data', 'Data exibida; o padrão é hoje', false, { max: 30 }),
      ],
      run: ({ versao, itens, data }) => {
        const linhas = itens.split(/[;\n]+/).map((item) => item.trim()).filter(Boolean);
        if (linhas.length === 0) throw aviso('Informe pelo menos uma mudança.');
        const hoje = data || new Date().toLocaleDateString('pt-BR');
        return bloco(`## ${versao} — ${hoje}\n\n${linhas.map((item) => `- ${item}`).join('\n')}`, 'md');
      },
    },
    {
      name: 'readme',
      description: 'Gera a estrutura inicial de um README em Markdown.',
      options: [
        opt.texto('projeto', 'Nome do projeto', true, { max: 100 }),
        opt.texto('resumo', 'Descrição curta do projeto', true, { max: 700 }),
        opt.texto('instalacao', 'Comando ou instrução de instalação', false, { max: 700 }),
        opt.texto('uso', 'Exemplo ou instrução de uso', false, { max: 700 }),
      ],
      run: ({ projeto, resumo, instalacao, uso }) => bloco([
        `# ${projeto}`,
        '',
        resumo,
        '',
        '## Instalação',
        '',
        instalacao || 'Descreva aqui os requisitos e as etapas de instalação.',
        '',
        '## Uso',
        '',
        uso || 'Inclua aqui um exemplo de uso.',
        '',
        '## Licença',
        '',
        'Informe a licença adotada pelo projeto.',
      ].join('\n'), 'md'),
    },
    {
      name: 'gitignore',
      description: 'Gera um arquivo .gitignore básico para a tecnologia escolhida.',
      options: [
        { kind: 'string', name: 'tecnologia', description: 'Tecnologia principal', required: true,
          choices: [
            { name: 'Node.js', value: 'node' },
            { name: 'Python', value: 'python' },
            { name: 'Java', value: 'java' },
            { name: 'Go', value: 'go' },
            { name: 'Docker', value: 'docker' },
          ] },
      ],
      run: ({ tecnologia }) => {
        const modelos = {
          node: ['node_modules/', 'dist/', 'coverage/', '.env', '*.log'],
          python: ['__pycache__/', '*.py[cod]', '.venv/', 'dist/', '.env', '.pytest_cache/'],
          java: ['target/', '*.class', '*.jar', '.gradle/', '.idea/', '*.iml'],
          go: ['bin/', 'vendor/', '*.test', '*.out', '.env'],
          docker: ['.env', '*.log', 'tmp/', '.git/', '.DS_Store'],
        };
        return bloco(modelos[tecnologia].join('\n'));
      },
    },
    {
      name: 'curl',
      description: 'Monta um comando curl com método, cabeçalhos e corpo opcionais.',
      options: [
        opt.texto('url', 'URL completa da requisição', true, { max: 1000 }),
        { kind: 'string', name: 'metodo', description: 'Método HTTP', required: true,
          choices: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((metodo) => ({ name: metodo, value: metodo })) },
        opt.texto('cabecalhos', 'Um cabeçalho por linha, no formato Nome: valor', false, { max: 1200 }),
        opt.texto('corpo', 'Corpo JSON ou texto', false, { max: 1500 }),
      ],
      run: ({ url, metodo, cabecalhos, corpo }) => {
        if (!/^https?:\/\//i.test(url)) throw aviso('A URL precisa começar com http:// ou https://.');
        const partes = ['curl', '-X', metodo, citarShell(url)];
        for (const cabecalho of cabecalhos?.split('\n').map((item) => item.trim()).filter(Boolean) ?? []) {
          partes.push('-H', citarShell(cabecalho));
        }
        if (corpo) partes.push('--data-raw', citarShell(corpo));
        return bloco(partes.join(' \\\n  '), 'bash');
      },
    },
    {
      name: 'csv-teste',
      description: 'Gera registros fictícios em CSV para testes.',
      options: [
        opt.inteiro('linhas', 'Quantidade de registros', true, { min: 1, max: 100 }),
        { kind: 'string', name: 'separador', description: 'Separador de colunas', required: false,
          choices: [{ name: 'Ponto e vírgula', value: ';' }, { name: 'Vírgula', value: ',' }] },
      ],
      run: ({ linhas, separador }) => {
        const sep = separador ?? ';';
        const registros = Array.from({ length: linhas }, (_, indice) => registroTeste(indice));
        return bloco([
          ['id', 'nome', 'email', 'status'].join(sep),
          ...registros.map((item) => [item.id, item.nome, item.email, item.status].join(sep)),
        ].join('\n'), 'csv');
      },
    },
    {
      name: 'json-teste',
      description: 'Gera registros fictícios em JSON para testes.',
      options: [
        opt.inteiro('registros', 'Quantidade de registros', true, { min: 1, max: 50 }),
        opt.sim('compacto', 'Retornar JSON sem indentação'),
      ],
      run: ({ registros, compacto }) => {
        const dados = Array.from({ length: registros }, (_, indice) => registroTeste(indice));
        return bloco(JSON.stringify(dados, null, compacto ? 0 : 2), 'json');
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
