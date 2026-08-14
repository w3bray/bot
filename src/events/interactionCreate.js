import { Events, MessageFlags } from 'discord.js';
import { logger } from '../lib/logger.js';
import { isOwner } from '../lib/owner.js';
import { embed, replyError } from '../lib/embeds.js';
import { checkCooldown } from '../lib/cooldown.js';
import { formatDuration } from '../lib/time.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) return runCommand(interaction, client);
    if (interaction.isAutocomplete()) return runAutocomplete(interaction, client);
    if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
      return runComponent(interaction, client);
    }
  },
};

async function runCommand(interaction, client) {
  const command = client.commands.get(interaction.commandName);
  if (!command) {
    return replyError(interaction, 'Esse comando mudou ou foi removido. Digite `/ajuda` para ver a lista atual.');
  }

  if (command.guildOnly !== false && !interaction.inGuild()) {
    return replyError(interaction, 'Esse comando só funciona dentro de servidores.');
  }

  const owner = isOwner(interaction.user.id);

  if (command.ownerOnly && !owner) {
    // Registrado para que o dono consiga ver, nos logs, quem andou tentando.
    logger.warn(
      `Acesso negado: ${interaction.user.tag} (${interaction.user.id}) tentou /${interaction.commandName}` +
        `${interaction.guild ? ` em ${interaction.guild.name} (${interaction.guildId})` : ' na DM'}.`,
    );
    return replyError(interaction, 'Só os donos do bot podem usar esse comando.');
  }

  // Donos não pegam cooldown: é o que o .env.example promete e o que torna os
  // comandos de administração utilizáveis em sequência.
  if (!owner) {
    const remaining = checkCooldown(command.data.name, interaction.user.id, command.cooldown);
    if (remaining > 0) {
      return replyError(
        interaction,
        `Espere **${formatDuration(remaining)}** antes de usar esse comando de novo.`,
      );
    }
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    logger.error(`Erro no comando /${interaction.commandName}:`, error);
    await replyError(
      interaction,
      'Não consegui concluir esse comando. Tente novamente; se continuar acontecendo, avise um administrador.',
    );
  }
}

async function runAutocomplete(interaction, client) {
  const command = client.commands.get(interaction.commandName);
  if (typeof command?.autocomplete !== 'function') return;

  // O autocomplete é uma porta de entrada separada do execute: sem esta
  // checagem, um comando de dono que tivesse autocomplete devolveria sugestões
  // a qualquer pessoa, vazando dados sem nunca passar pelo gate do execute.
  if (command.ownerOnly && !isOwner(interaction.user.id)) {
    return interaction.respond([]).catch(() => null);
  }

  try {
    await command.autocomplete(interaction, client);
  } catch (error) {
    logger.debug(`Erro no autocomplete de /${interaction.commandName}:`, error.message);
  }
}

async function runComponent(interaction, client) {
  // Convenção de custom_id: "namespace:acao:arg1:arg2"
  const [namespace, action, ...args] = interaction.customId.split(':');
  const handler = client.components.get(namespace);

  if (!handler) {
    return interaction
      .reply({
        embeds: [embed.error('Esse botão é antigo e já venceu. Rode o comando novamente para abrir a versão atual.')],
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => null);
  }

  try {
    await handler.execute(interaction, { action, args, client });
  } catch (error) {
    logger.error(`Erro no componente "${interaction.customId}":`, error);
    await replyError(interaction, 'Não consegui concluir essa ação. Tente novamente.');
  }
}
