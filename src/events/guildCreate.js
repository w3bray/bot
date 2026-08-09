import { Events, PermissionFlagsBits, REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { contarRotas } from '../lib/rotas.js';
import { registrar } from '../services/autodeploy.js';

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
    const rest = new REST().setToken(config.token);

    const ok = await registrar(
      rest,
      Routes.applicationGuildCommands(config.clientId, guild.id),
      body,
      `servidor "${guild.name}"`,
      'GUILD_CREATE',
    );

    if (!ok) {
      // A causa mais provável é o convite ter sido feito só com a scope `bot`.
      // Não é fatal: os comandos globais aparecem quando o Discord propagar.
      logger.warn(
        `Se o erro acima for 403, o convite para "${guild.name}" foi feito sem a scope ` +
          'applications.commands. Os comandos globais ainda vão aparecer em até 1 hora.',
      );
    }

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
        '_Se algum comando de moderação falhar, arraste meu cargo para o topo em_',
        '_Configurações do servidor → Cargos._',
      ].join('\n'),
    )
    .catch(() => null);
}
