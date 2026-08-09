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
 * SOMENTE global, e por um motivo aprendido errando: comandos de servidor e
 * comandos globais são dois registros independentes, e o Discord mostra OS
 * DOIS na lista. Registrar o mesmo conjunto nos dois escopos faz cada comando
 * aparecer duplicado quando a pessoa digita "/".
 *
 * O global cobre todos os servidores, inclusive os que o bot entrar depois —
 * ele pertence à aplicação, não ao servidor. A espera de até uma hora vale
 * para a propagação de mudanças no conjunto, não para servidores novos.
 *
 * Para desenvolver com registro instantâneo, use `npm run deploy` com GUILD_ID
 * preenchido e AUTO_DEPLOY desligado — aí o escopo de servidor é intencional e
 * o global não existe para duplicar.
 */
export async function maybeDeployCommands(client) {
  if (!config.autoDeploy) return;

  const isPrimary = client.shard ? client.shard.ids.includes(0) : true;
  if (!isPrimary) return;

  const body = client.commands.map((command) => command.data.toJSON());
  const rest = new REST().setToken(config.token);

  const ok = await registrar(rest, Routes.applicationCommands(config.clientId), body, 'global');

  if (ok) {
    logger.info(
      'AUTO_DEPLOY: os comandos globais valem em todos os servidores, inclusive nos que o bot entrar depois.',
    );
  }

  await limparDuplicatas(client, rest);
}

/**
 * Apaga registros de servidor deixados por versões anteriores.
 *
 * Até a correção, o bot registrava o mesmo conjunto no global E no servidor, o
 * que duplicava tudo na lista. Quem já rodou aquela versão tem os registros de
 * servidor gravados no Discord, e eles não somem sozinhos: precisam ser
 * apagados uma vez. Depois disso o laço não encontra mais nada para fazer.
 */
async function limparDuplicatas(client, rest) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const existentes = await rest.get(
        Routes.applicationGuildCommands(config.clientId, guild.id),
      );
      if (existentes.length === 0) continue;

      await rest.put(Routes.applicationGuildCommands(config.clientId, guild.id), { body: [] });
      logger.info(
        `AUTO_DEPLOY: removi ${existentes.length} registro(s) de servidor em "${guild.name}" ` +
          'que estavam duplicando a lista de comandos.',
      );
    } catch (error) {
      logger.warn(`AUTO_DEPLOY: não consegui limpar os comandos de "${guild.name}":`, error.message);
    }
  }
}

/**
 * Registra um corpo de comandos numa rota. Reaproveitado pelo guildCreate, que
 * faz o mesmo trabalho quando o bot entra num servidor novo.
 */
export async function registrar(rest, rota, body, escopo, prefixo = 'AUTO_DEPLOY') {
  try {
    const result = await rest.put(rota, { body });
    logger.info(`${prefixo}: ${result.length} comando(s) registrado(s) — escopo: ${escopo}.`);
    return true;
  } catch (error) {
    // Falhar aqui não pode derrubar o bot: os comandos antigos continuam
    // valendo, e o outro escopo ainda pode ter dado certo.
    // O erro inteiro, não só a mensagem: o código HTTP e o corpo da resposta
    // do Discord são o que dizem se foi permissão, rate limit ou payload.
    logger.error(`${prefixo}: falhou no escopo ${escopo}:`, error);
    return false;
  }
}
