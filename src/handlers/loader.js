import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger } from '../lib/logger.js';
import { localizarNomesPtBr } from '../lib/localizacao.js';

/** Lista recursivamente todos os arquivos .js de um diretório. */
export function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.name.endsWith('.js')) results.push(full);
  }
  return results;
}

/** Importa o export default de cada módulo encontrado. */
export async function importAll(directory) {
  const modules = [];
  for (const file of walk(directory)) {
    const imported = await import(pathToFileURL(file).href);
    if (!imported.default) {
      logger.warn(`Arquivo sem export default, ignorado: ${file}`);
      continue;
    }
    modules.push({ file, module: imported.default });
  }
  return modules;
}

/** Carrega os slash commands em client.commands. */
export async function loadCommands(client, directory) {
  for (const { file, module } of await importAll(directory)) {
    if (!module.data || typeof module.execute !== 'function') {
      logger.warn(`Comando inválido (precisa de "data" e "execute"): ${file}`);
      continue;
    }
    localizarNomesPtBr(module.data);
    for (const atalho of module.atalhos ?? []) localizarNomesPtBr(atalho.data);

    // A categoria vem do nome da pasta que contém o arquivo.
    module.category = path.basename(path.dirname(file));
    client.commands.set(module.data.name, module);

    // Uma família pode promover alguns subcomandos a comandos de topo. Eles
    // saem da família e viram entradas próprias, herdando a categoria.
    for (const atalho of module.atalhos ?? []) {
      if (client.commands.has(atalho.data.name)) {
        logger.warn(`Atalho /${atalho.data.name} colide com um comando existente — ignorado.`);
        continue;
      }
      atalho.category = module.category;
      client.commands.set(atalho.data.name, atalho);
    }
  }
  logger.info(`${client.commands.size} comandos carregados.`);
}

/** Registra os listeners de eventos do Discord. */
export async function loadEvents(client, directory) {
  let count = 0;
  for (const { file, module } of await importAll(directory)) {
    if (!module.name || typeof module.execute !== 'function') {
      logger.warn(`Evento inválido (precisa de "name" e "execute"): ${file}`);
      continue;
    }
    const handler = (...args) =>
      Promise.resolve(module.execute(...args, client)).catch((error) =>
        logger.error(`Erro no evento ${module.name}:`, error),
      );

    if (module.once) client.once(module.name, handler);
    else client.on(module.name, handler);
    count += 1;
  }
  logger.info(`${count} eventos registrados.`);
}

/** Carrega os handlers de botões/menus/modais em client.components. */
export async function loadComponents(client, directory) {
  for (const { file, module } of await importAll(directory)) {
    if (!module.id || typeof module.execute !== 'function') {
      logger.warn(`Componente inválido (precisa de "id" e "execute"): ${file}`);
      continue;
    }
    client.components.set(module.id, module);
  }
  logger.info(`${client.components.size} handlers de componentes carregados.`);
}
