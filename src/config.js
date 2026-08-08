import 'dotenv/config';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(
      `\n[config] Variável de ambiente obrigatória ausente: ${name}\n` +
        `Copie .env.example para .env e preencha os valores.\n`,
    );
    process.exit(1);
  }
  return value;
}

function list(name) {
  return (process.env[name] ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  guildId: process.env.GUILD_ID?.trim() || null,
  ownerIds: list('OWNER_IDS'),
  databasePath: process.env.DATABASE_PATH?.trim() || './data/bot.db',
  logLevel: process.env.LOG_LEVEL?.trim() || 'info',
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
    model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-opus-5',
  },
};

/** Cores padrão usadas em todos os embeds. */
export const colors = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  neutral: 0x2b2d31,
  economy: 0xf1c40f,
  level: 0x9b59b6,
};

/** Emojis usados nas respostas. Troque por emojis do seu servidor se quiser. */
export const emojis = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  loading: '⏳',
  coin: '🪙',
  star: '⭐',
  ticket: '🎫',
  gift: '🎉',
};
