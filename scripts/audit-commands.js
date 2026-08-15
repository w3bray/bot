import fs from 'node:fs';
import path from 'node:path';

const raiz = process.cwd();
const temporario = fs.mkdtempSync(path.join(raiz, '.auditoria-comandos-'));

process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'auditoria-local';
process.env.CLIENT_ID = process.env.CLIENT_ID || '123456789012345678';
process.env.DATABASE_PATH = path.join(temporario, 'auditoria.db');
process.env.LOG_LEVEL = 'error';
process.env.SHARDING = 'off';
process.env.AUTO_DEPLOY = 'false';

const NOMES_ANTIGOS = [
  'afk',
  'automod',
  'ban',
  'bio',
  'bola8',
  'botinfo',
  'brincadeira',
  'cacar',
  'carta',
  'cargoinfo',
  'combinar',
  'config',
  'crime',
  'daily',
  'kick',
  'mendigar',
  'meta-economia',
  'minerar',
  'mod',
  'moeda',
  'oraculo',
  'painelcargos',
  'pescar',
  'plantar',
  'ppt',
  'programar',
  'rank',
  'reciclar',
  'rep',
  'roleta',
  'serverinfo',
  'ship',
  'snipe',
  'ticket',
  'top',
  'transmitir',
  'unban',
  'userinfo',
];

const ROTAS_REMOVIDAS = [
  '/aleatorio escolher',
  '/aleatorio dado',
  '/aleatorio ppt',
  '/aleatorio ordem-fila',
  '/aleatorio cor',
  '/aleatorio emoji',
  '/aleatorio bits',
  '/moeda',
  '/carta',
  '/roleta',
  '/brincadeira amor',
  '/brincadeira bola8',
  '/brincadeira dupla',
  '/brincadeira desculpa',
  '/bolso apostar-moeda',
  '/bolso ranking',
  '/bolso comparar',
  '/bolso entregar',
  '/bolso doar',
  '/bolso investir',
  '/bolso esperas',
  '/servidor resumo',
  '/servidor cargo-info',
  '/moderacao trancar',
  '/moderacao destrancar',
  '/moderacao lento',
  '/moderacao limpar-de',
  '/moderacao cargo-dar',
  '/moderacao cargo-tirar',
  '/moderacao apelido-limpar',
  '/moderacao silenciar',
  '/moderacao dessilenciar',
  '/gerar nome-fantasia',
  '/gerar apelido-jogo',
  '/gerar pergunta',
  '/gerar desafio',
  '/gerar verdade',
  '/gerar conselho',
  '/gerar ideia',
  '/gerar numero-sorte',
  '/gerar ascii',
  '/jogo palavra-oculta',
  '/jogo quantos',
  '/jogo contagem',
  '/jogo nunca-fiz',
  '/jogo sorteio-rapido',
  '/meta-economia',
];

const ROTAS_NOVAS = [
  '/aleatorio chaveamento',
  '/aleatorio bingo',
  '/aleatorio placar',
  '/ponderado',
  '/amostra',
  '/decimal',
  '/aleatorio distribuicao-normal',
  '/aleatorio distribuicao',
  '/aleatorio coordenada',
  '/aleatorio reprodutivel',
  '/estimativa',
  '/avaliar-opcoes',
  '/planejar pauta',
  '/planejar feedback',
  '/planejar matriz-risco',
  '/planejar plano-5w2h',
  '/planejar cronograma',
  '/planejar plano-comunicacao',
  '/bolso comparar-patrimonio',
  '/bolso distribuicao',
  '/bolso mediana-servidor',
  '/bolso mercado',
  '/bolso preco-venda',
  '/bolso comissao',
  '/bolso rateio',
  '/orcamento',
  '/parcelar',
  '/meta-financeira',
  '/reserva',
  '/custo-hora',
  '/taxa-poupanca',
  '/ponto-equilibrio',
  '/margem',
  '/extrato',
  '/servidor proprietario',
  '/servidor hierarquia-cargos',
  '/moderacao limpar-reacoes',
  '/moderacao fixar-mensagem',
  '/moderacao renomear-canal',
  '/moderacao limpar-repetidas',
  '/moderacao cargo-contar',
  '/moderacao cargo-sem',
  '/moderacao apelidos-listar',
  '/moderacao voz-desconectar',
  '/moderacao voz-mover',
  '/gerar nome-branch',
  '/gerar nome-arquivo',
  '/gerar commit',
  '/gerar changelog',
  '/gerar readme',
  '/gerar gitignore',
  '/gerar curl',
  '/gerar csv-teste',
  '/gerar json-teste',
  '/jogo codigo-secreto',
  '/jogo logica',
  '/jogo sudoku',
  '/jogo categoria-relampago',
  '/jogo palavra-proibida',
];

const falhas = [];
const conferir = (condicao, mensagem) => {
  if (condicao === false) falhas.push(mensagem);
};

let banco;

try {
  const [{ Collection }, { loadCommands }, rotas, bancoModulo, portugues] = await Promise.all([
    import('discord.js'),
    import('../src/handlers/loader.js'),
    import('../src/lib/rotas.js'),
    import('../src/lib/db.js'),
    import('../src/lib/portugues.js'),
  ]);
  banco = bancoModulo.db;

  conferir(portugues.quantidade(1, 'servidor') === '1 servidor', 'O singular de servidor está incorreto.');
  conferir(portugues.quantidade(2, 'servidor') === '2 servidores', 'O plural de servidor está incorreto.');

  const client = { commands: new Collection() };
  await loadCommands(client, path.join(raiz, 'src', 'commands'));

  conferir(client.commands.size === 100, `Esperava 100 comandos principais; encontrei ${client.commands.size}.`);
  conferir(rotas.contarRotas(client.commands) === 400, `Esperava 400 rotas; encontrei ${rotas.contarRotas(client.commands)}.`);

  const todasAsRotas = [...client.commands.values()].flatMap((command) => rotas.rotasDoComando(command));
  const conjuntoDeRotas = new Set(todasAsRotas);
  conferir(conjuntoDeRotas.size === todasAsRotas.length, 'Há duas rotas com o mesmo nome.');

  for (const nome of NOMES_ANTIGOS) {
    conferir(client.commands.has(nome) === false, `O nome antigo /${nome} ainda está registrado.`);
  }
  for (const rota of ROTAS_REMOVIDAS) {
    conferir(conjuntoDeRotas.has(rota) === false, `A rota removida ${rota} ainda existe.`);
  }
  for (const rota of ROTAS_NOVAS) {
    conferir(conjuntoDeRotas.has(rota), `A rota substituta ${rota} não foi encontrada.`);
  }

  const validarDescricao = (descricao, rota, fraseCompleta = false) => {
    conferir(typeof descricao === 'string' && descricao.length >= 1, `${rota} está sem descrição.`);
    conferir(descricao.length <= 100, `${rota} tem descrição com mais de 100 caracteres.`);
    if (fraseCompleta) {
      conferir(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9`/]/.test(descricao), `${rota} começa com letra minúscula: "${descricao}".`);
      conferir(/[.!?…)]$/.test(descricao), `${rota} termina sem pontuação: "${descricao}".`);
    }
  };

  const validarNome = (nome, rota) => {
    conferir(/^[a-z0-9-]{1,32}$/.test(nome), `${rota} usa um nome fora do padrão: "${nome}".`);
  };

  for (const command of client.commands.values()) {
    const json = command.data.toJSON();
    validarNome(json.name, `/${json.name}`);
    validarDescricao(json.description, `/${json.name}`, true);
    const tamanho = tamanhoDefinicao(json);
    conferir(tamanho <= 8_000, `/${json.name} usa ${tamanho} caracteres na definição; o limite é 8.000.`);

    for (const option of json.options ?? []) {
      validarNome(option.name, `/${json.name} ${option.name}`);
      validarDescricao(option.description, `/${json.name} ${option.name}`, option.type <= 2);
      for (const sub of option.options ?? []) {
        validarNome(sub.name, `/${json.name} ${option.name} ${sub.name}`);
        validarDescricao(sub.description, `/${json.name} ${option.name} ${sub.name}`, sub.type === 1);
      }
    }
  }

  const arquivosDeTexto = [
    ...listarArquivos(path.join(raiz, 'src')).filter((arquivo) => arquivo.endsWith('.js')),
    path.join(raiz, 'README.md'),
  ];
  const nomesEscapados = NOMES_ANTIGOS.join('|');
  const referenciaAntiga = new RegExp(`(?<![.])/(?:${nomesEscapados})(?=[\\s\u0060"'.,:)}]|$)`, 'g');
  const pluralArtificial = /\b[\p{L}]+\((?:s|ns|es)\)/giu;
  const linguagemInfantil = /\b(?:bobo|boba|bobos|bobas|joguinho)\b|idade mental|biscoito da sorte|bola mágica|medidor de compatibilidade|amor-próprio/giu;

  for (const arquivo of arquivosDeTexto) {
    const conteudo = fs.readFileSync(arquivo, 'utf8');
    const conteudoSemImports = conteudo
      .split('\n')
      .filter((linha) => linha.trimStart().startsWith('import ') === false)
      .join('\n');
    const antigas = conteudoSemImports.match(referenciaAntiga) ?? [];
    conferir(antigas.length === 0, `${path.relative(raiz, arquivo)} cita nomes antigos: ${[...new Set(antigas)].join(', ')}.`);
    const plurais = conteudo.match(pluralArtificial) ?? [];
    conferir(plurais.length === 0, `${path.relative(raiz, arquivo)} usa plural artificial: ${[...new Set(plurais)].join(', ')}.`);
    const termosInfantis = conteudo.match(linguagemInfantil) ?? [];
    conferir(termosInfantis.length === 0, `${path.relative(raiz, arquivo)} ainda usa linguagem infantil: ${[...new Set(termosInfantis)].join(', ')}.`);
  }

  if (falhas.length > 0) {
    console.error(`❌ Auditoria reprovada com ${falhas.length} problema(s):`);
    for (const falha of falhas) console.error(`- ${falha}`);
    process.exitCode = 1;
  } else {
    console.log('✅ 100 comandos principais, 400 rotas, nomes atuais e descrições revisadas.');
    console.log(`✅ ${ROTAS_REMOVIDAS.length} rotas duplicadas ou pouco úteis foram removidas.`);
    console.log(`✅ ${ROTAS_NOVAS.length} rotas substitutas foram conferidas.`);
  }
} finally {
  banco?.close();
  fs.rmSync(temporario, { recursive: true, force: true });
}

function listarArquivos(diretorio) {
  const encontrados = [];
  for (const item of fs.readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = path.join(diretorio, item.name);
    if (item.isDirectory()) encontrados.push(...listarArquivos(caminho));
    else encontrados.push(caminho);
  }
  return encontrados;
}

/** Soma nomes, descrições e valores conforme o limite de definição do Discord. */
function tamanhoDefinicao(valor) {
  if (Array.isArray(valor)) return valor.reduce((soma, item) => soma + tamanhoDefinicao(item), 0);
  if (!valor || typeof valor !== 'object') return 0;

  return Object.entries(valor).reduce((soma, [chave, item]) => {
    if (['name', 'description', 'value'].includes(chave) && typeof item === 'string') {
      return soma + item.length;
    }
    if (chave.endsWith('_localizations') && item && typeof item === 'object') {
      return soma + Math.max(0, ...Object.values(item).map((texto) => String(texto).length));
    }
    return soma + tamanhoDefinicao(item);
  }, 0);
}
