# Deixar o bot online 24/7

Guia para quem está no celular e nunca hospedou nada.

---

## Primeiro, a verdade sobre o celular

**Um Android não segura um bot 24/7.** Dá para rodar, mas:

- o Android mata programas em segundo plano quando a tela apaga;
- reiniciou o aparelho, o bot cai;
- acabou a bateria ou saiu do Wi-Fi, o bot cai;
- o celular esquenta e gasta bateria à toa.

Serve para **testar**. Não serve para deixar no ar.

Para 24/7 de verdade o bot precisa morar num computador que nunca desliga — um
**VPS**, que é um computador alugado na internet. Custa poucos dólares por mês e
você controla tudo **pelo próprio celular**.

---

## Opção A — VPS com o instalador automático (recomendada)

**Dois comandos.** O instalador cuida do Docker, do código e da configuração; a
imagem já traz `yt-dlp` e `ffmpeg` embutidos.

### 1. Alugue um VPS

Qualquer provedor serve (Hetzner, DigitalOcean, Contabo, Vultr, Oracle Cloud…).
Peça a máquina mais barata com **Ubuntu 24.04** — 1 GB de RAM sobra para este bot.
Compare os preços atuais no site de cada um; eles mudam com frequência.

Ao final você recebe: um **IP**, um **usuário** (normalmente `root`) e uma **senha**.

### 2. Conecte pelo celular

Instale um app de SSH — **Termius** (mais fácil) ou **Termux** (mais cru), os dois
gratuitos na Play Store. Conecte usando o IP, o usuário e a senha.

### 3. Rode o instalador

```bash
curl -fsSLO https://raw.githubusercontent.com/w3bray/bot/main/scripts/install.sh
sudo bash install.sh
```

São dois comandos de propósito: o primeiro baixa, o segundo executa. Assim você
pode ler o arquivo antes de rodar — nunca execute um script da internet direto no
seu servidor sem essa chance.

> **Enquanto o pull request não estiver mesclado**, o código ainda não está na
> `main`. Use esta variação, que aponta para o branch:
>
> ```bash
> BRANCH=claude/discord-bot-utility-mnjsa9
> curl -fsSLO "https://raw.githubusercontent.com/w3bray/bot/$BRANCH/scripts/install.sh"
> sudo BOT_BRANCH="$BRANCH" bash install.sh
> ```
>
> Depois de mesclar, os dois comandos de cima passam a funcionar.

Ele pergunta três coisas:

| Pergunta | Onde achar |
|---|---|
| **Token do bot** | Developer Portal → aba **Bot** → *Reset Token* |
| **Application ID** | Developer Portal → **General Information** |
| **ID do servidor** | Discord → Configurações → Avançado → Modo desenvolvedor, depois botão direito no servidor → *Copiar ID*. Pode pular com Enter |

O token **não aparece na tela** enquanto você cola — proposital, para não ficar
visível nem no histórico do terminal. O `.env` nasce legível só pelo dono (`600`).

Quando terminar, o bot está no ar. Pode fechar o app e desligar o celular: ele
religa sozinho se cair ou se o VPS reiniciar.

Para atualizar depois, rode o mesmo instalador — ele detecta a instalação
existente, atualiza o código e mantém seu `.env` e seus dados.

### Se preferir fazer na mão

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
git clone https://github.com/w3bray/bot.git && cd bot
cat > .env << 'FIM'
DISCORD_TOKEN=cole_seu_token_aqui
CLIENT_ID=cole_seu_application_id_aqui
GUILD_ID=cole_o_id_do_seu_servidor
AUTO_DEPLOY=true
SHARDING=off
FIM
sudo docker compose up -d --build
```

`AUTO_DEPLOY=true` faz o bot registrar os comandos sozinho ao ligar, dispensando
o `npm run deploy`.

## Opção B — hospedagem pronta para bots

Serviços como Railway, Fly.io, Sparked Host ou Bot-Hosting.net conectam direto ao
GitHub e sobem o bot sem terminal. É mais fácil, mas tem duas armadilhas:

**1. Disco efêmero — a mais perigosa.** Muitos planos apagam os arquivos a cada
restart. Como este bot guarda tudo num arquivo SQLite, isso significa **perder
níveis, economia e configurações toda vez que reiniciar**. Antes de escolher,
confirme que o plano oferece **disco persistente** (às vezes chamado de *volume*
ou *persistent storage*) e aponte a variável `DATABASE_PATH` para dentro dele.

**2. `yt-dlp` e `ffmpeg`.** Só funcionam se o serviço aceitar o `Dockerfile` deste
repositório. Se ele usar detecção automática de linguagem, o `/baixar` fica
desativado — o resto do bot funciona normalmente.

Planos gratuitos costumam ter as duas limitações, além de hibernar por
inatividade. Para um bot que precisa ficar conectado, um VPS barato sai melhor.

---

## Opção C — Termux, só para testar

Roda no próprio celular. **Não é 24/7**, mas serve para ver o bot funcionando
antes de gastar dinheiro.

```bash
pkg update && pkg install -y nodejs git python ffmpeg
pip install -U yt-dlp
git clone https://github.com/w3bray/bot.git
cd bot
npm install
```

Crie o `.env` com o mesmo bloco `cat > .env << 'FIM'` da Opção A e rode:

```bash
npm start
```

Para o bot não morrer quando a tela apagar, rode `termux-wake-lock` antes. Ainda
assim ele cai ao reiniciar o aparelho.

---

## Problemas comuns

| O que aconteceu | O que fazer |
|---|---|
| `permission denied` no docker | Faltou o `sudo` na frente do comando |
| Bot conecta mas os comandos não aparecem | Confirme `AUTO_DEPLOY=true` no `.env` e reinicie. Sem `GUILD_ID`, comandos globais levam até 1 hora |
| Níveis e economia zeram sozinhos | Disco efêmero (veja a Opção B). No Docker isso não acontece por causa do volume |
| `/baixar` diz que está desativado | Você não está usando o Dockerfile. No VPS com Docker ele já vem pronto |
| Bot fica offline sozinho | Sinal de pouca memória. Veja `sudo docker compose logs --tail 50` |
| Ban, kick ou autorole falham | O cargo do bot está abaixo do cargo do alvo. Arraste o cargo do bot para o topo |

---

## Segurança

- **Nunca** mande seu token para ninguém, nem cole em chat, print ou repositório.
  Se vazar, use *Reset Token* no Developer Portal — o antigo morre na hora.
- O `.env` já está no `.gitignore` e no `.dockerignore`: ele não vai para o GitHub
  nem para dentro da imagem.
- No VPS, prefira entrar com chave SSH em vez de senha assim que se sentir à
  vontade — é mais seguro e você para de digitar senha no celular.
