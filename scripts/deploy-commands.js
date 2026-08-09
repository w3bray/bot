import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Collection, REST, Routes } from 'discord.js';
import { config } from '../src/config.js';
import { logger } from '../src/lib/logger.js';
import { loadCommands } from '../src/handlers/loader.js';
import { corpoDosComandos } from '../src/services/autodeploy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const commandsPath = path.join(here, '..', 'src', 'commands');

const global = process.argv.includes('--global');
const clear = process.argv.includes('--clear');

// O loader espera um objeto parecido com o client; só precisa da Collection.
const fake = { commands: new Collection() };
await loadCommands(fake, commandsPath);

const body = clear ? [] : corpoDosComandos(fake.commands);
const rest = new REST().setToken(config.token);

const scope = global || !config.guildId ? 'global' : `servidor ${config.guildId}`;
const route =
  global || !config.guildId
    ? Routes.applicationCommands(config.clientId)
    : Routes.applicationGuildCommands(config.clientId, config.guildId);

try {
  logger.info(`${clear ? 'Removendo' : 'Registrando'} ${body.length} comando(s) — escopo: ${scope}…`);
  const result = await rest.put(route, { body });
  logger.info(`Pronto! ${result.length} comando(s) ativo(s) em ${scope}.`);

  if (scope === 'global' && !clear) {
    logger.warn('Comandos globais podem levar até 1 hora para aparecer em todos os servidores.');
  }
} catch (error) {
  logger.error('Falha ao registrar comandos:', error);
  process.exitCode = 1;
}
