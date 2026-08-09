import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * Quem manda no bot.
 *
 * OWNER_IDS no .env continua valendo, mas quase ninguém que instala por painel
 * de hospedagem preenche essa variável — e aí os comandos de dono ficariam
 * inacessíveis para a própria pessoa que criou o bot. Por isso perguntamos ao
 * Discord quem é o dono da aplicação: é exatamente a conta que criou o bot no
 * Developer Portal, então a descoberta acerta o alvo sem configuração alguma.
 *
 * Os dois conjuntos se somam; nenhum sobrescreve o outro.
 */
const discovered = new Set();

/** Pergunta ao Discord quem é o dono (ou a equipe) da aplicação. */
export async function discoverOwners(client) {
  try {
    const application = await client.application.fetch();

    if (application.owner?.members) {
      // Aplicação de equipe: todo integrante da equipe conta como dono.
      for (const member of application.owner.members.values()) {
        discovered.add(member.user?.id ?? member.id);
      }
    } else if (application.owner?.id) {
      discovered.add(application.owner.id);
    }

    if (discovered.size > 0) {
      logger.info(`Dono(s) do bot identificado(s) automaticamente: ${discovered.size}.`);
    } else {
      logger.warn(
        'Não consegui identificar o dono da aplicação. Preencha OWNER_IDS no .env para usar /dono.',
      );
    }
  } catch (error) {
    // Não é motivo para derrubar o bot: OWNER_IDS ainda resolve o problema.
    logger.warn('Não consegui consultar o dono da aplicação:', error.message);
  }
}

/** Diz se o usuário pode usar os comandos de dono. */
export function isOwner(userId) {
  return config.ownerIds.includes(userId) || discovered.has(userId);
}

/** Todos os donos conhecidos, sem repetição. */
export function ownerIds() {
  return [...new Set([...config.ownerIds, ...discovered])];
}
