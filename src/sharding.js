import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ShardingManager } from 'discord.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { quantidade } from './lib/portugues.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const botFile = path.join(here, 'index.js');

// SHARDING=off roda tudo em um processo só — mais simples para desenvolver e
// suficiente para bots pequenos, sem o custo de um processo supervisor.
if (config.sharding === 'off') {
  logger.info('Sharding desativado (SHARDING=off): iniciando em processo único.');
  await import('./index.js');
} else {
  await spawnShards();
}

async function spawnShards() {
  const manager = new ShardingManager(botFile, {
    token: config.token,
    // 'auto' pergunta ao Discord quantos shards a conta precisa.
    totalShards: config.sharding === 'auto' ? 'auto' : Number(config.sharding),
    respawn: true,
  });

  manager.on('shardCreate', (shard) => {
    logger.info(`Shard ${shard.id} iniciado.`);

    shard.on('ready', () => logger.info(`Shard ${shard.id} conectado ao Discord.`));
    shard.on('disconnect', () => logger.warn(`Shard ${shard.id} desconectou.`));
    shard.on('reconnecting', () => logger.warn(`Shard ${shard.id} reconectando…`));
    shard.on('death', (process) =>
      logger.error(`Shard ${shard.id} morreu (código ${process.exitCode}); será reiniciado.`),
    );
    shard.on('error', (error) => logger.error(`Erro no shard ${shard.id}:`, error));
  });

  try {
    const shards = await manager.spawn();
    logger.info(`${quantidade(shards.size, 'processo')} no ar.`);
  } catch (error) {
    logger.error('Falha ao iniciar os shards:', error);
    process.exit(1);
  }

  // O supervisor não fala com o Discord: só precisa derrubar os filhos com ele.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      logger.info(`Recebido ${signal}, encerrando os shards…`);
      for (const shard of manager.shards.values()) shard.kill();
      process.exit(0);
    });
  }
}
