import { Events, PermissionFlagsBits, REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * O bot entrou num servidor novo.
 *
 * Registramos os comandos naquele servidor na hora. Os comandos globais já
 * cobrem todos os servidores, mas o Discord leva até uma hora para propagá-los
 * num servidor recém-adicionado — e nesse intervalo o bot parece quebrado, sem
 * nenhum comando disponível. O registro por servidor vale na mesma hora.
 */
export default {
  name: Events.GuildCreate,

  async execute(guild, client) {
    logger.info(
      `Entrei em "${guild.name}" (${guild.id}) — ${guild.memberCount} membros. ` +
        `Agora em ${client.guilds.cache.size} servidor(es) neste processo.`,
    );

    const body = client.commands.map((command) => command.data.toJSON());

    try {
      const rest = new REST().setToken(config.token);
      const result = await rest.put(
        Routes.applicationGuildCommands(config.clientId, guild.id),
        { body },
      );
      logger.info(`${result.length} comando(s) disponíveis imediatamente em "${guild.name}".`);
    } catch (error) {
      // Sem a scope applications.commands no convite, o Discord recusa com 403.
      // Os comandos globais ainda vão aparecer quando propagarem, então isto
      // não é motivo para nada além de um aviso.
      logger.warn(
        `Não consegui registrar comandos em "${guild.name}": ${error.message}. ` +
          'Se for 403, o convite foi feito sem a permissão applications.commands.',
      );
    }

    await avisarDono(guild);
  },
};

/** Manda um oi no primeiro canal onde o bot consegue falar. */
async function avisarDono(guild) {
  const canal = guild.channels.cache.find(
    (c) =>
      c.isTextBased?.() &&
      c.permissionsFor(guild.members.me)?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
      ]),
  );
  if (!canal) return;

  await canal
    .send(
      [
        `Olá! Sou o **${guild.client.user.username}**, e tenho **400 comandos**.`,
        '',
        'Comece por `/ajuda` para ver a lista completa.',
        '',
        '_Se algum comando de moderação falhar, arraste meu cargo para o topo em_',
        '_Configurações do servidor → Cargos._',
      ].join('\n'),
    )
    .catch(() => null);
}
