import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { loadCommands, loadComponents, loadEvents } from './handlers/loader.js';
import { startSchedulers } from './services/scheduler.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Quando o ShardingManager cria o processo, ele passa SHARDS (id deste shard) e
// SHARD_COUNT (total) por variável de ambiente — mas o discord.js NÃO lê essas
// variáveis sozinho: o padrão de `shardCount` é 1. Sem repassar explicitamente,
// todo processo se conectaria como "shard 0 de 1" e receberia todos os
// servidores, duplicando eventos, XP e punições.
const managed = Boolean(process.env.SHARDING_MANAGER);
const shardOptions = managed
  ? { shards: [Number(process.env.SHARDS)], shardCount: Number(process.env.SHARD_COUNT) }
  : {};

const client = new Client({
  ...shardOptions,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
  ],
  // Partials permitem reagir a mensagens antigas (fora do cache), essencial
  // para o starboard e para os logs de mensagem apagada.
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
  allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
});

client.commands = new Collection();
client.components = new Collection();

await loadCommands(client, path.join(here, 'commands'));
await loadComponents(client, path.join(here, 'components'));
await loadEvents(client, path.join(here, 'events'));

client.once('clientReady', () => startSchedulers(client));

process.on('unhandledRejection', (reason) => logger.error('Promise rejeitada sem tratamento:', reason));
process.on('uncaughtException', (error) => logger.error('Exceção não capturada:', error));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    logger.info(`Recebido ${signal}, desligando…`);
    client.destroy();
    process.exit(0);
  });
}

await client.login(config.token);
