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
 *
 * O registro GLOBAL é sempre feito. Antes, ter GUILD_ID preenchido trocava o
 * global pelo do servidor — e o bot ficava sem nenhum comando em todos os
 * outros servidores em que entrasse, o que parecia "o bot não funciona lá".
 *
 * Quando GUILD_ID existe, o registro do servidor é feito TAMBÉM, porque ele é
 * instantâneo: o global leva até uma hora para aparecer na primeira vez. Onde
 * os dois existem, o Discord mostra o do servidor.
 */
export async function maybeDeployCommands(client) {
  if (!config.autoDeploy) return;

  const isPrimary = client.shard ? client.shard.ids.includes(0) : true;
  if (!isPrimary) return;

  const body = client.commands.map((command) => command.data.toJSON());
  const rest = new REST().setToken(config.token);

  const global = await registrar(rest, Routes.applicationCommands(config.clientId), body, 'global');

  if (config.guildId) {
    await registrar(
      rest,
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      body,
      `servidor ${config.guildId}`,
    );
  }

  if (global) {
    logger.info(
      'AUTO_DEPLOY: os comandos globais valem em todos os servidores. ' +
        'Na primeira vez podem levar até 1 hora para aparecer nos servidores novos.',
    );
  }
}

async function registrar(rest, rota, body, escopo) {
  try {
    const result = await rest.put(rota, { body });
    logger.info(`AUTO_DEPLOY: ${result.length} comando(s) registrado(s) — escopo: ${escopo}.`);
    return true;
  } catch (error) {
    // Falhar aqui não pode derrubar o bot: os comandos antigos continuam
    // valendo, e o outro escopo ainda pode ter dado certo.
    logger.error(`AUTO_DEPLOY: falhou no escopo ${escopo}: ${error.message}`);
    return false;
  }
}
