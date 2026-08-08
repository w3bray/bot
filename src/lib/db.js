import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { logger } from './logger.js';

const file = path.resolve(config.databasePath);
fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS guilds (
  guild_id          TEXT PRIMARY KEY,
  mod_log_channel   TEXT,
  server_log_channel TEXT,
  welcome_channel   TEXT,
  welcome_message   TEXT,
  goodbye_channel   TEXT,
  goodbye_message   TEXT,
  autorole          TEXT,
  levels_enabled    INTEGER NOT NULL DEFAULT 1,
  levels_channel    TEXT,
  levels_message    TEXT,
  xp_min            INTEGER NOT NULL DEFAULT 15,
  xp_max            INTEGER NOT NULL DEFAULT 25,
  xp_cooldown       INTEGER NOT NULL DEFAULT 60000,
  starboard_channel TEXT,
  starboard_min     INTEGER NOT NULL DEFAULT 3,
  ticket_category   TEXT,
  ticket_log        TEXT,
  ticket_role       TEXT,
  ticket_counter    INTEGER NOT NULL DEFAULT 0,
  case_counter      INTEGER NOT NULL DEFAULT 0,
  economy_enabled   INTEGER NOT NULL DEFAULT 1,
  currency_name     TEXT NOT NULL DEFAULT 'moedas'
);

CREATE TABLE IF NOT EXISTS automod (
  guild_id        TEXT PRIMARY KEY,
  anti_invite     INTEGER NOT NULL DEFAULT 0,
  anti_link       INTEGER NOT NULL DEFAULT 0,
  anti_spam       INTEGER NOT NULL DEFAULT 0,
  spam_messages   INTEGER NOT NULL DEFAULT 5,
  spam_window     INTEGER NOT NULL DEFAULT 5000,
  anti_caps       INTEGER NOT NULL DEFAULT 0,
  caps_percent    INTEGER NOT NULL DEFAULT 70,
  mention_limit   INTEGER NOT NULL DEFAULT 0,
  banned_words    TEXT NOT NULL DEFAULT '[]',
  punishment      TEXT NOT NULL DEFAULT 'delete',
  timeout_minutes INTEGER NOT NULL DEFAULT 10,
  ignored_roles   TEXT NOT NULL DEFAULT '[]',
  ignored_channels TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS cases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  case_number INTEGER NOT NULL,
  type        TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason      TEXT,
  duration    INTEGER,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON cases(guild_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_number ON cases(guild_id, case_number);

CREATE TABLE IF NOT EXISTS levels (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  xp       INTEGER NOT NULL DEFAULT 0,
  level    INTEGER NOT NULL DEFAULT 0,
  messages INTEGER NOT NULL DEFAULT 0,
  last_xp  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_levels_rank ON levels(guild_id, xp DESC);

CREATE TABLE IF NOT EXISTS level_rewards (
  guild_id TEXT NOT NULL,
  level    INTEGER NOT NULL,
  role_id  TEXT NOT NULL,
  PRIMARY KEY (guild_id, level)
);

CREATE TABLE IF NOT EXISTS economy (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  balance    INTEGER NOT NULL DEFAULT 0,
  bank       INTEGER NOT NULL DEFAULT 0,
  last_daily INTEGER NOT NULL DEFAULT 0,
  last_work  INTEGER NOT NULL DEFAULT 0,
  last_rob   INTEGER NOT NULL DEFAULT 0,
  streak     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_economy_rank ON economy(guild_id, balance DESC);

CREATE TABLE IF NOT EXISTS reminders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  guild_id   TEXT,
  content    TEXT NOT NULL,
  remind_at  INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at);

CREATE TABLE IF NOT EXISTS giveaways (
  message_id    TEXT PRIMARY KEY,
  guild_id      TEXT NOT NULL,
  channel_id    TEXT NOT NULL,
  host_id       TEXT NOT NULL,
  prize         TEXT NOT NULL,
  winners       INTEGER NOT NULL DEFAULT 1,
  required_role TEXT,
  ends_at       INTEGER NOT NULL,
  ended         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_giveaways_due ON giveaways(ended, ends_at);

CREATE TABLE IF NOT EXISTS giveaway_entries (
  message_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS tickets (
  channel_id TEXT PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  number     INTEGER NOT NULL,
  claimed_by TEXT,
  open       INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS starboard (
  guild_id          TEXT NOT NULL,
  message_id        TEXT NOT NULL,
  star_message_id   TEXT NOT NULL,
  stars             INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, message_id)
);

CREATE TABLE IF NOT EXISTS role_buttons (
  message_id TEXT NOT NULL,
  guild_id   TEXT NOT NULL,
  role_id    TEXT NOT NULL,
  PRIMARY KEY (message_id, role_id)
);

CREATE TABLE IF NOT EXISTS polls (
  message_id TEXT PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author_id  TEXT NOT NULL,
  question   TEXT NOT NULL,
  options    TEXT NOT NULL,
  multi      INTEGER NOT NULL DEFAULT 0,
  ends_at    INTEGER,
  ended      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_polls_due ON polls(ended, ends_at);

CREATE TABLE IF NOT EXISTS poll_votes (
  message_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  choice     INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id, choice)
);

CREATE TABLE IF NOT EXISTS afk (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  reason   TEXT,
  since    INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);
`);

logger.info(`Banco de dados pronto em ${file}`);

const ensureGuild = db.prepare('INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)');
const selectGuild = db.prepare('SELECT * FROM guilds WHERE guild_id = ?');
const ensureAutomod = db.prepare('INSERT OR IGNORE INTO automod (guild_id) VALUES (?)');
const selectAutomod = db.prepare('SELECT * FROM automod WHERE guild_id = ?');

/** Retorna (criando se necessário) as configurações do servidor. */
export function getGuildConfig(guildId) {
  ensureGuild.run(guildId);
  return selectGuild.get(guildId);
}

/** Atualiza colunas da tabela `guilds`. Aceita um objeto {coluna: valor}. */
export function setGuildConfig(guildId, patch) {
  ensureGuild.run(guildId);
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const assignments = keys.map((key) => `${key} = @${key}`).join(', ');
  db.prepare(`UPDATE guilds SET ${assignments} WHERE guild_id = @guild_id`).run({
    ...patch,
    guild_id: guildId,
  });
}

/** Retorna (criando se necessário) as configurações de automod do servidor. */
export function getAutomod(guildId) {
  ensureAutomod.run(guildId);
  return selectAutomod.get(guildId);
}

/** Atualiza colunas da tabela `automod`. */
export function setAutomod(guildId, patch) {
  ensureAutomod.run(guildId);
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const assignments = keys.map((key) => `${key} = @${key}`).join(', ');
  db.prepare(`UPDATE automod SET ${assignments} WHERE guild_id = @guild_id`).run({
    ...patch,
    guild_id: guildId,
  });
}

/** Lê uma coluna JSON com fallback seguro. */
export function readJson(value, fallback = []) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

process.on('exit', () => db.close());
