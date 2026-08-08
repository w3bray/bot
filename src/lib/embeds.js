import { EmbedBuilder, MessageFlags } from 'discord.js';
import { colors, emojis } from '../config.js';

function build(color, description, title) {
  const embed = new EmbedBuilder().setColor(color).setDescription(description);
  if (title) embed.setTitle(title);
  return embed;
}

export const embed = {
  success: (description, title) => build(colors.success, `${emojis.success} ${description}`, title),
  error: (description, title) => build(colors.danger, `${emojis.error} ${description}`, title),
  warning: (description, title) => build(colors.warning, `${emojis.warning} ${description}`, title),
  info: (description, title) => build(colors.primary, `${emojis.info} ${description}`, title),
  plain: (description, title) => build(colors.neutral, description, title),
  base: (color = colors.primary) => new EmbedBuilder().setColor(color),
};

/** Responde (ou edita, se já respondido) com uma mensagem efêmera de erro. */
export async function replyError(interaction, description) {
  const payload = { embeds: [embed.error(description)], flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload).catch(() => null);
  }
  return interaction.reply(payload).catch(() => null);
}

/** Responde com sucesso, efêmero por padrão. */
export async function replySuccess(interaction, description, { ephemeral = true } = {}) {
  const payload = {
    embeds: [embed.success(description)],
    ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
  };
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ embeds: payload.embeds }).catch(() => null);
  }
  return interaction.reply(payload).catch(() => null);
}

/** Corta um texto para caber num campo de embed. */
export function truncate(text, max = 1024) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
