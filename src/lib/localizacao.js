/**
 * Nomes internos continuam estáveis e sem acento para não quebrar handlers,
 * banco de dados ou integrações. No Discord, a localização pt-BR exibe a
 * grafia correta: /matemática, /moderação, opção:usuário etc.
 */
const ACENTOS = new Map(Object.entries({
  acao: 'ação',
  acoes: 'ações',
  acrostico: 'acróstico',
  adversario: 'adversário',
  aleatorio: 'aleatório',
  ameacas: 'ameaças',
  angulo: 'ângulo',
  aniversario: 'aniversário',
  aniversarios: 'aniversários',
  area: 'área',
  ate: 'até',
  automatico: 'automático',
  binario: 'binário',
  cabecalhos: 'cabeçalhos',
  caca: 'caça',
  centimetro: 'centímetro',
  cesar: 'césar',
  cha: 'chá',
  cientifica: 'científica',
  codigo: 'código',
  combinacao: 'combinação',
  combustivel: 'combustível',
  comissao: 'comissão',
  comunicacao: 'comunicação',
  confianca: 'confiança',
  criterios: 'critérios',
  cronometro: 'cronômetro',
  cubico: 'cúbico',
  decisao: 'decisão',
  decisoes: 'decisões',
  descricao: 'descrição',
  diario: 'diário',
  diferenca: 'diferença',
  digitacao: 'digitação',
  digitos: 'dígitos',
  distancia: 'distância',
  distribuicao: 'distribuição',
  duracao: 'duração',
  duracoes: 'durações',
  equacao: 'equação',
  equilibrio: 'equilíbrio',
  esforco: 'esforço',
  espacado: 'espaçado',
  estatisticas: 'estatísticas',
  expressao: 'expressão',
  extensao: 'extensão',
  forca: 'força',
  forcas: 'forças',
  fracao: 'fração',
  frequencia: 'frequência',
  galao: 'galão',
  historia: 'história',
  historico: 'histórico',
  icone: 'ícone',
  impar: 'ímpar',
  importancia: 'importância',
  indice: 'índice',
  inicio: 'início',
  instalacao: 'instalação',
  inventario: 'inventário',
  jokenpo: 'jokenpô',
  logica: 'lógica',
  maiusculas: 'maiúsculas',
  maos: 'mãos',
  matematica: 'matemática',
  maxima: 'máxima',
  maximo: 'máximo',
  media: 'média',
  memoria: 'memória',
  mencoes: 'menções',
  mes: 'mês',
  metodo: 'método',
  metrica: 'métrica',
  minima: 'mínima',
  minimo: 'mínimo',
  milimetro: 'milímetro',
  minusculas: 'minúsculas',
  mitigacao: 'mitigação',
  moderacao: 'moderação',
  multipla: 'múltipla',
  nao: 'não',
  nautica: 'náutica',
  niqueis: 'níqueis',
  niveis: 'níveis',
  nivel: 'nível',
  notacao: 'notação',
  numero: 'número',
  numeros: 'números',
  no: 'nó',
  observacoes: 'observações',
  opcao1: 'opção1',
  opcao2: 'opção2',
  opcao3: 'opção3',
  opcao4: 'opção4',
  opcao5: 'opção5',
  opcoes: 'opções',
  onca: 'onça',
  orcamento: 'orçamento',
  pagina: 'página',
  pais: 'país',
  patrimonio: 'patrimônio',
  periodos: 'períodos',
  permissoes: 'permissões',
  pe: 'pé',
  potencia: 'potência',
  poupanca: 'poupança',
  preco: 'preço',
  pre: 'pré',
  premio: 'prêmio',
  pressao: 'pressão',
  proprietario: 'proprietário',
  pros: 'prós',
  provavel: 'provável',
  proximo: 'próximo',
  proximos: 'próximos',
  publico: 'público',
  punicao: 'punição',
  quilometro: 'quilômetro',
  quorum: 'quórum',
  rapida: 'rápida',
  rapido: 'rápido',
  reacoes: 'reações',
  relampago: 'relâmpago',
  reprodutivel: 'reprodutível',
  reputacao: 'reputação',
  responsavel: 'responsável',
  saida: 'saída',
  sequencia: 'sequência',
  simbolo: 'símbolo',
  simbolos: 'símbolos',
  situacao: 'situação',
  sugestao: 'sugestão',
  sugestoes: 'sugestões',
  titulo: 'título',
  tres: 'três',
  unicos: 'únicos',
  urgencia: 'urgência',
  usuario: 'usuário',
  uteis: 'úteis',
  variacao: 'variação',
  variavel: 'variável',
  varios: 'vários',
  versao: 'versão',
  voce: 'você',
  xicara: 'xícara',
}));

const ROTULOS_COMPLETOS = new Map([
  ['colher sopa', 'colher de sopa'],
  ['mmhg', 'mmHg'],
  ['quilowatt hora', 'quilowatt-hora'],
  ['watt hora', 'watt-hora'],
]);

/** Converte um identificador interno para a grafia exibida em pt-BR. */
export function nomePtBr(nome) {
  return String(nome)
    .split('-')
    .map((parte) => ACENTOS.get(parte) ?? parte)
    .join('-');
}

/** Corrige rótulos livres, como nomes de unidades exibidos em menus. */
export function rotuloPtBr(rotulo) {
  const partes = String(rotulo)
    .replaceAll('_', ' ')
    .split(/([ -])/)
    .map((parte) => ACENTOS.get(parte) ?? parte)
    .join('');
  return ROTULOS_COMPLETOS.get(partes) ?? partes;
}

/** Aplica localização pt-BR ao comando, subcomandos, grupos e opções. */
export function localizarNomesPtBr(builder) {
  visitar(builder);
  return builder;
}

/** Nome localizado de um objeto já serializado pelo discord.js. */
export function nomeLocalizado(item, localidade = 'pt-BR') {
  return item?.name_localizations?.[localidade] ?? nomePtBr(item?.name ?? '');
}

/** Forma comparável usada em buscas e autocomplete. */
export function semAcentos(texto) {
  return String(texto).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
}

function visitar(item) {
  if (!item) return;
  const localizado = nomePtBr(item.name);
  if (localizado !== item.name && typeof item.setNameLocalization === 'function') {
    item.setNameLocalization('pt-BR', localizado);
  }
  for (const escolha of item.choices ?? []) escolha.name = rotuloPtBr(escolha.name);
  for (const opcao of item.options ?? []) visitar(opcao);
}
