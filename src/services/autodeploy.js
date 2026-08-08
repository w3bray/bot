import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * Registra os slash commands ao iniciar, quando AUTO_DEPLOY=true.
 *
 * Existe para quem hospeda em serviços onde não dá para abrir um terminal e
 * rodar `npm run deploy` à mão. Com sharding, apenas o shard 0 registra: os
 * comandos são globais para a aplicação, então registrar uma vez por shard só
 * gastaria requisições e arriscaria rate limit.
 */
export async function maybeDeployCommands(client) {
  if (!config.autoDeploy) return;

  const isPrimary = client.shard ? client.shard.ids.includes(0) : true;
  if (!isPrimary) return;

  const body = client.commands.map((command) => command.data.toJSON());
  const scope = config.guildId ? `servidor ${config.guildId}` : 'global';
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  try {
    const rest = new REST().setToken(config.token);
    const result = await rest.put(route, { body });
    logger.info(`AUTO_DEPLOY: ${result.length} comando(s) registrado(s) — escopo: ${scope}.`);

    if (!config.guildId) {
      logger.warn('AUTO_DEPLOY: comandos globais podem levar até 1 hora para aparecer.');
    }
  } catch (error) {
    // Falhar aqui não pode derrubar o bot: os comandos antigos continuam valendo.
    logger.error('AUTO_DEPLOY: não consegui registrar os comandos:', error.message);
  }
}
