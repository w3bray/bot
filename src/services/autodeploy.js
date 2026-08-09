import { ApplicationIntegrationType, REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const jaVarrido = db.prepare('SELECT 1 FROM limpezas WHERE guild_id = ?');
const marcarVarrido = db.prepare(
  'INSERT OR REPLACE INTO limpezas (guild_id, quando) VALUES (?, ?)',
);

/**
 * O corpo enviado ao Discord, com o contexto de instalação fixado.
 *
 * Sem `integration_types` explícito, o comando herda os contextos configurados
 * na aplicação. Com "User Install" ligado no portal, ele é registrado no
 * contexto de servidor E no de usuário — e quem tiver o app instalado na
 * própria conta vê cada comando DUAS VEZES na lista, mesmo sem existir nenhum
 * registro em escopo de servidor.
 *
 * Este bot é de servidor. Fixar GuildInstall aqui elimina essa origem de
 * duplicata na origem, e o próximo PUT substitui os registros antigos que
 * tinham os dois contextos.
 */
export function corpoDosComandos(commands) {
  return commands.map((command) => ({
    ...command.data.toJSON(),
    integration_types: [ApplicationIntegrationType.GuildInstall],
  }));
}

/**
 * Registra os slash commands ao iniciar, quando AUTO_DEPLOY=true.
 *
 * SOMENTE no escopo global, e por um motivo aprendido errando: comandos de
 * servidor e comandos globais são dois registros independentes, e o Discord
 * mostra OS DOIS na lista. O mesmo conjunto nos dois escopos faz cada comando
 * aparecer duplicado quando a pessoa digita "/".
 *
 * O global pertence à aplicação, não ao servidor, então vale em todo servidor
 * onde o bot está e nos que ele entrar depois. A espera de até uma hora é para
 * a propagação de MUDANÇAS no conjunto, não para servidores novos.
 *
 * Com sharding, apenas o shard 0 registra: o conjunto é da aplicação inteira,
 * então repetir por shard só gastaria requisições e arriscaria rate limit.
 */
export async function maybeDeployCommands(client) {
  if (!config.autoDeploy) return;

  const isPrimary = client.shard ? client.shard.ids.includes(0) : true;
  if (!isPrimary) return;

  const body = corpoDosComandos(client.commands);
  const rest = new REST().setToken(config.token);

  const ok = await registrar(rest, Routes.applicationCommands(config.clientId), body, 'global');

  if (ok) {
    logger.info(
      'AUTO_DEPLOY: os comandos globais valem em todos os servidores, inclusive nos que o bot entrar depois.',
    );
  }

  await limparEscopoDeServidor(client, rest);
}

/**
 * Apaga registros no escopo de servidor, que é o que produz a duplicata.
 *
 * Versões anteriores gravavam o conjunto no global E no servidor. Esses
 * registros ficam guardados no Discord e não somem sozinhos: precisam ser
 * apagados uma vez, por servidor.
 *
 * O resultado de cada servidor é gravado em `limpezas`, então a varredura só
 * acontece uma vez na vida de cada um. Sem isso seria uma requisição por
 * servidor a cada inicialização — aceitável com dois servidores, inviável com
 * muitos, que é justamente o cenário para o qual o bot foi feito.
 */
export async function limparEscopoDeServidor(client, rest, { forcar = false } = {}) {
  const resumo = { verificados: 0, limpos: 0, falhas: 0 };

  for (const guild of client.guilds.cache.values()) {
    if (!forcar && jaVarrido.get(guild.id)) continue;
    resumo.verificados += 1;

    try {
      const existentes = await rest.get(
        Routes.applicationGuildCommands(config.clientId, guild.id),
      );

      if (existentes.length > 0) {
        await rest.put(Routes.applicationGuildCommands(config.clientId, guild.id), { body: [] });
        resumo.limpos += 1;
        logger.info(
          `AUTO_DEPLOY: removi ${existentes.length} comando(s) do escopo de "${guild.name}" — ` +
            'eram eles que apareciam duplicados.',
        );
      }

      // Marcado mesmo quando não havia nada: o que importa é não varrer de novo.
      marcarVarrido.run(guild.id, Date.now());
    } catch (error) {
      // Sem marca, este servidor é tentado na próxima inicialização.
      resumo.falhas += 1;
      logger.warn(`AUTO_DEPLOY: não consegui varrer "${guild.name}":`, error.message);
    }
  }

  if (resumo.verificados > 0) {
    logger.info(
      `AUTO_DEPLOY: varredura de duplicatas — ${resumo.verificados} servidor(es) verificado(s), ` +
        `${resumo.limpos} limpo(s), ${resumo.falhas} falha(s).`,
    );
  }

  return resumo;
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
