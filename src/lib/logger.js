import { config } from '../config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

function stamp() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Com sharding, cada shard é um processo separado escrevendo no mesmo terminal;
 * o prefixo identifica de quem é cada linha.
 *
 * Calculado a cada escrita (e não na carga do módulo) porque o próprio
 * ShardingManager só define `SHARDING_MANAGER` no processo supervisor depois
 * que este arquivo já foi importado.
 */
function shardTag() {
  if (process.env.SHARDS !== undefined) return `[shard ${process.env.SHARDS}] `;
  return process.env.SHARDING_MANAGER ? '[manager] ' : '';
}

function write(level, args) {
  if (LEVELS[level] < threshold) return;
  const prefix =
    `${COLORS[level]}[${stamp()}] ${level.toUpperCase().padEnd(5)}${RESET} ${shardTag()}`.trimEnd();
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  sink(prefix, ...args);
}

export const logger = {
  debug: (...args) => write('debug', args),
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
};
