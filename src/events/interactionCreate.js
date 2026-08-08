import { Events, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
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
    return replyError(interaction, 'Esse comando não existe mais. Tente novamente em instantes.');
  }

  if (command.guildOnly !== false && !interaction.inGuild()) {
    return replyError(interaction, 'Este comando só funciona dentro de um servidor.');
  }

  if (command.ownerOnly && !config.ownerIds.includes(interaction.user.id)) {
    return replyError(interaction, 'Apenas os donos do bot podem usar este comando.');
  }

  const remaining = checkCooldown(command.data.name, interaction.user.id, command.cooldown);
  if (remaining > 0) {
    return replyError(
      interaction,
      `Calma lá! Tente novamente em **${formatDuration(remaining)}**.`,
    );
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    logger.error(`Erro no comando /${interaction.commandName}:`, error);
    await replyError(
      interaction,
      'Algo deu errado ao executar este comando. A equipe do bot foi notificada.',
    );
  }
}

async function runAutocomplete(interaction, client) {
  const command = client.commands.get(interaction.commandName);
  if (typeof command?.autocomplete !== 'function') return;

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
        embeds: [embed.error('Este botão pertence a uma versão antiga do bot e não funciona mais.')],
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => null);
  }

  try {
    await handler.execute(interaction, { action, args, client });
  } catch (error) {
    logger.error(`Erro no componente "${interaction.customId}":`, error);
    await replyError(interaction, 'Não consegui processar essa ação.');
  }
}
