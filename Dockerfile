# Imagem pronta do bot, com yt-dlp e ffmpeg já embutidos.
# Quem usa esta imagem não precisa instalar nada além do Docker.

# --- etapa 1: dependências -------------------------------------------------
# O better-sqlite3 é um módulo nativo. Quase sempre existe binário pronto para
# baixar, mas as ferramentas de compilação ficam aqui como rede de segurança —
# e não vão para a imagem final, que continua enxuta.
FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- etapa 2: imagem final -------------------------------------------------
FROM node:22-bookworm-slim

WORKDIR /app

# ffmpeg junta vídeo+áudio e gera o MP3; python3 é exigido pelo yt-dlp.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
    && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
         -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts

# O banco fica num volume: sem isso, todo restart apagaria níveis, economia e
# configurações do servidor.
ENV NODE_ENV=production \
    DATABASE_PATH=/data/bot.db

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]

CMD ["node", "src/sharding.js"]
