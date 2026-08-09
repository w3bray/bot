#!/usr/bin/env bash
#
# Instalador do bot para um servidor Ubuntu/Debian novo.
#
# Instala o Docker, baixa o código, pergunta as três informações necessárias
# e deixa o bot rodando 24/7.
#
#   curl -fsSLO https://raw.githubusercontent.com/w3bray/bot/main/scripts/install.sh
#   sudo bash install.sh
#
# Rode sempre em duas etapas (baixar, depois executar) para poder ler o script
# antes. Ele precisa de terminal interativo para perguntar o token, então
# `curl | bash` não funciona aqui — o que é bom.

set -euo pipefail

REPO="${BOT_REPO:-https://github.com/w3bray/bot.git}"
BRANCH="${BOT_BRANCH:-main}"
DESTINO="${BOT_DIR:-/opt/discord-bot}"

verde() { printf '\033[32m%s\033[0m\n' "$1"; }
amarelo() { printf '\033[33m%s\033[0m\n' "$1"; }
vermelho() { printf '\033[31m%s\033[0m\n' "$1" >&2; }

erro() {
  vermelho "ERRO: $1"
  exit 1
}

# --- verificações iniciais -------------------------------------------------

[[ $EUID -eq 0 ]] || erro "Rode com sudo: sudo bash install.sh"
[[ -t 0 ]] || erro "Preciso de um terminal interativo. Baixe o script e rode: sudo bash install.sh"
command -v apt-get >/dev/null || erro "Este instalador é para Ubuntu ou Debian."

echo
verde "=== Instalador do bot de Discord ==="
echo

# --- 1. dependências do sistema --------------------------------------------

amarelo "[1/4] Conferindo Docker e Git…"
export DEBIAN_FRONTEND=noninteractive

# Vários provedores (Hostinger, DigitalOcean, Contabo…) já entregam a imagem com
# o Docker oficial do docker.com. Instalar o docker.io do Ubuntu por cima quebra
# o apt, porque containerd.io e containerd se excluem mutuamente:
#
#   containerd.io : Conflicts: containerd
#   E: Error, pkgProblemResolver::Resolve generated breaks
#
# Então instalamos só o que estiver faltando de verdade.
faltando=()
command -v git >/dev/null 2>&1 || faltando+=(git)

if docker compose version >/dev/null 2>&1; then
  echo "      Docker e Compose já instalados — aproveitando os que já estão aqui."
elif command -v docker >/dev/null 2>&1; then
  # Docker existe, mas sem o plugin do compose. O nome do pacote muda conforme a
  # origem do Docker: docker-compose-plugin no repositório do docker.com,
  # docker-compose-v2 no do Ubuntu. Tentamos os dois antes de desistir.
  echo "      Docker encontrado, mas sem o plugin do Compose. Instalando…"
  apt-get update -qq
  apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1 ||
    apt-get install -y -qq docker-compose-v2 >/dev/null 2>&1 ||
    erro "Não consegui instalar o plugin do Docker Compose."
else
  faltando+=(docker.io docker-compose-v2)
fi

if ((${#faltando[@]} > 0)); then
  echo "      Instalando: ${faltando[*]} (pode levar alguns minutos)…"
  apt-get update -qq
  # Se a instalação silenciosa falhar, repetimos sem -qq para que o erro do apt
  # apareça na tela: uma linha "E: ..." sozinha não diz o que conflitou.
  apt-get install -y -qq "${faltando[@]}" >/dev/null 2>&1 || {
    vermelho "A instalação falhou. Saída completa do apt:"
    apt-get install -y "${faltando[@]}" || erro "Não consegui instalar: ${faltando[*]}"
  }
fi

systemctl enable --now docker >/dev/null 2>&1 || true

docker compose version >/dev/null 2>&1 ||
  erro "O Docker Compose não ficou disponível. Rode 'docker compose version' para ver o motivo."

# --- 2. código -------------------------------------------------------------

amarelo "[2/4] Baixando o bot para $DESTINO…"
if [[ -d "$DESTINO/.git" ]]; then
  git -C "$DESTINO" fetch --quiet origin "$BRANCH"
  git -C "$DESTINO" reset --hard --quiet "origin/$BRANCH"
  echo "      (já existia; atualizado para a versão mais recente)"
else
  rm -rf "$DESTINO"
  git clone --quiet --branch "$BRANCH" --depth 1 "$REPO" "$DESTINO"
fi
cd "$DESTINO"

# --- 3. configuração -------------------------------------------------------

if [[ -f .env ]]; then
  amarelo "[3/4] Já existe um .env — mantendo a configuração atual."
else
  amarelo "[3/4] Configuração"
  echo
  echo "  Pegue os dois primeiros valores em https://discord.com/developers/applications"
  echo "  O token NÃO aparece na tela enquanto você cola. Isso é proposital."
  echo

  # -s esconde o token: ele não fica visível nem no histórico da tela.
  read -rsp "  Token do bot (aba Bot > Reset Token): " TOKEN
  echo
  [[ -n "${TOKEN// /}" ]] || erro "O token não pode ficar vazio."

  read -rp "  Application ID (aba General Information): " CLIENT_ID
  [[ "$CLIENT_ID" =~ ^[0-9]{17,20}$ ]] || erro "O Application ID deve ter de 17 a 20 dígitos."

  echo
  echo "  ID do seu servidor (opcional, mas os comandos aparecem na hora)."
  echo "  Para pegar: Discord > Configurações > Avançado > Modo desenvolvedor,"
  echo "  depois botão direito no servidor > Copiar ID do servidor."
  read -rp "  ID do servidor (Enter para pular): " GUILD_ID

  if [[ -n "$GUILD_ID" && ! "$GUILD_ID" =~ ^[0-9]{17,20}$ ]]; then
    erro "O ID do servidor deve ter de 17 a 20 dígitos (ou ficar vazio)."
  fi

  umask 077 # o .env nasce legível só pelo dono
  cat > .env <<ENV
DISCORD_TOKEN=$TOKEN
CLIENT_ID=$CLIENT_ID
GUILD_ID=$GUILD_ID
AUTO_DEPLOY=true
SHARDING=off
LOG_LEVEL=info
ENV
  chmod 600 .env
  unset TOKEN
fi

# --- 4. subir --------------------------------------------------------------

amarelo "[4/4] Construindo a imagem e ligando o bot (a primeira vez demora)…"
docker compose up -d --build

echo
verde "=== Pronto! O bot está no ar. ==="
echo
echo "  Ver o que está acontecendo:  cd $DESTINO && docker compose logs -f"
echo "  Reiniciar:                   cd $DESTINO && docker compose restart"
echo "  Atualizar:                   sudo bash $DESTINO/scripts/install.sh"
echo
echo "  Ele religa sozinho se cair ou se o servidor reiniciar."
echo
amarelo "  Falta fazer no Discord (uma vez só):"
echo "   1. Developer Portal > aba Bot > ligue Server Members Intent e Message Content Intent"
echo "   2. Convide o bot e arraste o cargo dele para o topo em Configurações > Cargos"
echo
echo "  Acompanhando os primeiros segundos do bot (Ctrl+C sai sem desligar nada):"
echo
sleep 2
docker compose logs -f --tail 20 &
LOGS=$!
sleep 25
kill $LOGS 2>/dev/null || true
echo
verde "Tudo certo. O bot continua rodando."
