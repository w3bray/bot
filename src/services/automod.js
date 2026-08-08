import { PermissionFlagsBits } from 'discord.js';
import { getAutomod, readJson } from '../lib/db.js';
import { createCase } from './modcase.js';
import { embed } from '../lib/embeds.js';
import { logger } from '../lib/logger.js';

const INVITE_PATTERN = /(discord\.(gg|io|me|li)|discord(app)?\.com\/invite)\/[a-z0-9-_]+/i;
const LINK_PATTERN = /https?:\/\/[^\s]+/i;

// Histórico curto por usuário para detecção de flood: userId -> timestamps.
const recentMessages = new Map();

setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, stamps] of recentMessages) {
    const kept = stamps.filter((stamp) => stamp > cutoff);
    if (kept.length === 0) recentMessages.delete(key);
    else recentMessages.set(key, kept);
  }
}, 60_000).unref();

/**
 * Analisa uma mensagem e aplica a punição configurada.
 * Retorna true quando a mensagem foi tratada (e provavelmente apagada).
 */
export async function inspect(message) {
  const settings = getAutomod(message.guild.id);
  if (isExempt(message, settings)) return false;

  const violation = detect(message, settings);
  if (!violation) return false;

  await punish(message, settings, violation);
  return true;
}

function isExempt(message, settings) {
  // Quem pode gerenciar mensagens está sempre isento do automod.
  if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return true;

  const ignoredChannels = readJson(settings.ignored_channels);
  if (ignoredChannels.includes(message.channel.id)) return true;
  if (message.channel.parentId && ignoredChannels.includes(message.channel.parentId)) return true;

  const ignoredRoles = readJson(settings.ignored_roles);
  return ignoredRoles.some((roleId) => message.member?.roles.cache.has(roleId));
}

function detect(message, settings) {
  const content = message.content ?? '';

  if (settings.anti_invite && INVITE_PATTERN.test(content)) {
    return 'convite de servidor';
  }

  if (settings.anti_link && LINK_PATTERN.test(content) && !INVITE_PATTERN.test(content)) {
    return 'link não permitido';
  }

  if (settings.mention_limit > 0) {
    const mentions = message.mentions.users.size + message.mentions.roles.size;
    if (mentions > settings.mention_limit) return `excesso de menções (${mentions})`;
  }

  if (settings.anti_caps && content.length >= 10) {
    const letters = content.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (letters.length >= 10) {
      const uppercase = letters.replace(/[^A-ZÀ-Þ]/g, '').length;
      const percent = Math.round((uppercase / letters.length) * 100);
      if (percent >= settings.caps_percent) return `excesso de letras maiúsculas (${percent}%)`;
    }
  }

  const bannedWords = readJson(settings.banned_words);
  if (bannedWords.length > 0) {
    const normalized = content
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const hit = bannedWords.find((word) => normalized.includes(String(word).toLowerCase()));
    if (hit) return 'palavra proibida';
  }

  if (settings.anti_spam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const stamps = (recentMessages.get(key) ?? []).filter(
      (stamp) => now - stamp < settings.spam_window,
    );
    stamps.push(now);
    recentMessages.set(key, stamps);
    if (stamps.length > settings.spam_messages) {
      recentMessages.set(key, []);
      return `flood (${stamps.length} mensagens em ${settings.spam_window / 1000}s)`;
    }
  }

  return null;
}

async function punish(message, settings, reason) {
  await message.delete().catch(() => null);

  const notice = await message.channel
    .send({
      embeds: [
        embed.warning(`${message.author}, sua mensagem foi removida — motivo: **${reason}**.`),
      ],
    })
    .catch(() => null);

  // Autolimpeza do aviso para não poluir o canal.
  if (notice) setTimeout(() => notice.delete().catch(() => null), 8000);

  if (settings.punishment === 'delete') return;

  const member = message.member;
  const me = message.guild.members.me;

  try {
    if (settings.punishment === 'timeout' && member?.moderatable) {
      await member.timeout(settings.timeout_minutes * 60_000, `AutoMod: ${reason}`);
    } else if (settings.punishment === 'kick' && member?.kickable) {
      await member.kick(`AutoMod: ${reason}`);
    } else if (settings.punishment === 'ban' && member?.bannable) {
      await member.ban({ reason: `AutoMod: ${reason}` });
    }
  } catch (error) {
    logger.debug('AutoMod não conseguiu punir:', error.message);
  }

  await createCase(message.guild, {
    type: 'automod',
    user: message.author,
    moderator: me.user,
    reason: `${reason} · ação: ${settings.punishment}`,
    duration: settings.punishment === 'timeout' ? settings.timeout_minutes * 60_000 : null,
  });
}
