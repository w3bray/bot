import { Events, PermissionFlagsBits } from 'discord.js';
import { logger } from '../lib/logger.js';
import { contarRotas } from '../lib/rotas.js';

/**
 * O bot entrou num servidor novo.
 *
 * Aqui NÃO registramos comandos. Os comandos globais pertencem à aplicação,
 * não ao servidor, então já valem no momento em que o bot entra. Registrar de
 * novo no escopo do servidor criaria um segundo conjunto, e o Discord mostra
 * os dois — cada comando apareceria duplicado na lista.
 */
export default {
  name: Events.GuildCreate,

  async execute(guild, client) {
    logger.info(
      `Entrei em "${guild.name}" (${guild.id}) — ${guild.memberCount} membros. ` +
        `Agora em ${client.guilds.cache.size} servidor(es) neste processo.`,
    );

    await apresentar(guild, client);
  },
};

/** Manda um oi no primeiro canal onde o bot consegue falar. */
async function apresentar(guild, client) {
  const canal = guild.channels.cache.find(
    (c) =>
      c.isTextBased?.() &&
      c.permissionsFor(guild.members.me)?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
      ]),
  );
  if (!canal) return;

  // Contado na hora: um número fixo aqui envelheceria a cada comando novo, e
  // `commands.size` diria só os de topo, não as rotas que dá para executar.
  const rotas = contarRotas(client.commands);

  await canal
    .send(
      [
        `Olá! Sou o **${client.user.username}**, e tenho **${rotas} comandos**.`,
        '',
        'Comece por `/ajuda` para ver a lista completa.',
        '',
        '_Se os comandos ainda não aparecerem ao digitar `/`, aguarde alguns instantes_',
        '_e recarregue o Discord._',
        '',
        '_Se algum comando de moderação falhar, arraste meu cargo para o topo em_',
        '_Configurações do servidor → Cargos._',
      ].join('\n'),
    )
    .catch(() => null);
}
