# Bot de Discord multiuso

Bot completo em **Node.js + discord.js v14**, com moderação, AutoMod, níveis, economia,
perfis sociais, tickets, sorteios, enquetes, jogos, logs, starboard, painel de cargos,
download de vídeos, construtor de servidor e um comando de IA.

Tudo em português do Brasil, com **55 slash commands**, persistência em SQLite e
carregamento automático de comandos, eventos e botões.

---

## Índice

- [O que ele faz](#o-que-ele-faz)
- [Instalação](#instalação)
- [Configuração no Discord](#configuração-no-discord)
- [Primeiros passos no servidor](#primeiros-passos-no-servidor)
- [Lista de comandos](#lista-de-comandos)
- [Servidores ilimitados](#servidores-ilimitados)
- [Sharding](#sharding)
- [Comando de IA](#comando-de-ia)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como adicionar um comando](#como-adicionar-um-comando)
- [Banco de dados](#banco-de-dados)
- [Solução de problemas](#solução-de-problemas)

---

## O que ele faz

| Módulo | Recursos |
|---|---|
| 🛡️ **Moderação** | Ban, kick, castigo (timeout), advertências com punição automática por acúmulo, limpeza de mensagens com filtros, trancar canal, modo lento, gerenciar cargos e apelidos |
| 📋 **Casos** | Toda punição vira um caso numerado, gravado no banco e enviado ao canal de logs. Consulta por usuário ou por número |
| 🤖 **AutoMod** | Anti-convite, anti-link, antispam, anti-CAPS, limite de menções e lista de palavras proibidas. Punição configurável (apagar, castigar, expulsar, banir) e isenção por cargo/canal |
| 📈 **Níveis** | XP por mensagem com cooldown, curva progressiva, ranking, cargos entregues automaticamente ao subir de nível |
| 🪙 **Economia** | Recompensa diária com sequência, trabalho, banco (cofre à prova de roubo), roubo com risco de multa, transferência, aposta, loja de distintivos e ranking de riqueza |
| 💞 **Social** | Perfil completo com nível, patrimônio, reputação e distintivos; bio, reputação diária e casamento com pedido por botão |
| 🎮 **Jogos** | Jogo da velha PvP no tabuleiro de botões e quiz de conhecimentos gerais que premia quem acerta primeiro |
| 📥 **Download de vídeo** | `/baixar` puxa o vídeo de um link e envia no canal, com opção de extrair só o áudio |
| 🎫 **Tickets** | Painel com botão, canal privado por atendimento, botões de assumir/fechar, transcrição enviada por DM e para o log |
| 🎉 **Sorteios** | Botão de participação (clicar de novo cancela), exigência de cargo, encerramento automático e resorteio |
| 📊 **Enquetes** | Até 5 opções, votação por botão, barra de resultados ao vivo, escolha única ou múltipla, encerramento automático |
| ⭐ **Starboard** | Mensagens que recebem ⭐ suficientes vão para um mural, com contador que se atualiza sozinho |
| 👋 **Boas-vindas** | Mensagens de entrada e saída com marcadores, e cargo automático para novos membros |
| 📜 **Logs** | Entradas, saídas, mensagens apagadas e editadas |
| 🎭 **Painel de cargos** | Botões para o membro pegar e remover cargos sozinho |
| 💡 **Sugestões** | Canal de sugestões com votação por botão e decisão da equipe |
| 💬 **Comandos próprios** | A equipe cria respostas automáticas do servidor, acionadas por prefixo |
| 🧠 **IA** | `/ia` responde perguntas usando a API da Anthropic (opcional) |
| 🔧 **Utilidades** | Ping, userinfo, serverinfo, avatar, cargoinfo, botinfo, lembretes, AFK, snipe e ajuda navegável |
| 🎲 **Diversão** | Bola 8, dados, escolher, pedra-papel-tesoura e ship |

---

> **Quer o bot online 24/7?** Num servidor Ubuntu novo, dois comandos resolvem:
>
> ```bash
> curl -fsSLO https://raw.githubusercontent.com/w3bray/bot/main/scripts/install.sh
> sudo bash install.sh
> ```
>
> O instalador cuida do Docker, do código e da configuração — e a imagem já traz
> `yt-dlp` e `ffmpeg` embutidos. Detalhes e alternativas no
> **[guia de hospedagem](DEPLOY.md)**.

## Instalação

Requisitos: **Node.js 20 ou superior**.

Com Docker é mais simples — não precisa nem de Node instalado:

```bash
cp .env.example .env    # preencha DISCORD_TOKEN, CLIENT_ID e GUILD_ID
docker compose up -d --build
```

Manualmente:

```bash
git clone <url-do-repositorio>
cd bot
npm install
cp .env.example .env
```

Preencha o `.env` (veja a seção seguinte), registre os comandos e inicie:

```bash
npm run deploy   # registra os slash commands
npm start        # liga o bot (com sharding automático)
```

Durante o desenvolvimento, `npm run dev` reinicia o bot a cada alteração de arquivo,
em processo único. Veja também [Sharding](#sharding).

---

## Configuração no Discord

1. Acesse o [Portal do Desenvolvedor](https://discord.com/developers/applications) e crie uma aplicação.
2. Em **Bot**, clique em *Reset Token* e copie o token para `DISCORD_TOKEN` no `.env`.
3. Em **General Information**, copie o *Application ID* para `CLIENT_ID`.
4. Ainda em **Bot**, ative as três *Privileged Gateway Intents*:
   - ✅ **Server Members Intent** — boas-vindas, autorole e informações de membros
   - ✅ **Message Content Intent** — AutoMod e sistema de níveis
   - ✅ **Presence Intent** — opcional, não é usada hoje
5. Em **OAuth2 → URL Generator**, marque os escopos `bot` e `applications.commands`,
   selecione as permissões abaixo e use o link gerado para convidar o bot.

Permissões recomendadas: Gerenciar Cargos, Gerenciar Canais, Expulsar Membros, Banir Membros,
Moderar Membros, Gerenciar Apelidos, Gerenciar Mensagens, Ler Histórico de Mensagens,
Enviar Mensagens, Inserir Links, Anexar Arquivos e Adicionar Reações.

> **Importante:** arraste o cargo do bot para **acima** dos cargos que ele vai gerenciar.
> O Discord não permite que um bot altere cargos iguais ou superiores ao dele.

### Variáveis do `.env`

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `DISCORD_TOKEN` | sim | Token do bot |
| `CLIENT_ID` | sim | ID da aplicação |
| `GUILD_ID` | não | ID do servidor de testes. Com ele, `npm run deploy` registra os comandos só nesse servidor e eles aparecem na hora. Sem ele, o registro é global e leva até 1 hora |
| `OWNER_IDS` | não | IDs dos donos, separados por vírgula. Ignoram cooldowns e acessam `/dono`. **Pode deixar vazio**: o bot descobre sozinho quem é o dono da aplicação |
| `DATABASE_PATH` | não | Caminho do arquivo SQLite (padrão `./data/bot.db`) |
| `LOG_LEVEL` | não | `debug`, `info`, `warn` ou `error` |
| `SHARDING` | não | `auto` (padrão), `off` ou um número. Veja [Sharding](#sharding) |
| `ANTHROPIC_API_KEY` | não | Ativa o comando `/ia`. Sem ela o comando avisa que está desligado |
| `ANTHROPIC_MODEL` | não | Modelo usado pelo `/ia` (padrão `claude-opus-5`) |

### Comandos de registro

```bash
npm run deploy          # registra no GUILD_ID (instantâneo) ou global se não houver GUILD_ID
npm run deploy:global   # força o registro global
npm run clear           # remove todos os comandos do escopo atual
```

---

## Primeiros passos no servidor

Depois de convidar o bot, rode estes comandos (todos exigem **Gerenciar Servidor**):

```
/config logs tipo:Moderação canal:#logs-mod
/config logs tipo:Servidor canal:#logs-servidor
/config boasvindas canal:#bem-vindos mensagem:Bem-vindo(a) ao {server}, {user}!
/config autorole cargo:@Membro
/config niveis ativar:true canal:#níveis
/config recompensa nivel:10 cargo:@Ativo
/config starboard canal:#destaques minimo:5
/config tickets categoria:Atendimento cargo:@Suporte log:#logs-tickets
/ticket painel
/automod filtros convites:true spam:true
/automod punicao acao:Apagar e castigar minutos:10
```

Confira tudo com `/config ver` e `/automod ver`.

**Marcadores** aceitos nas mensagens de boas-vindas e saída: `{user}` (menção),
`{username}`, `{tag}`, `{server}`, `{count}` (total de membros).
Na mensagem de nível: `{user}`, `{username}`, `{level}`, `{server}`.

---

## Lista de comandos

### 🛡️ Moderação

| Comando | O que faz |
|---|---|
| `/ban` | Bane um usuário, com opção de apagar as mensagens recentes dele |
| `/unban` | Remove o banimento (com autocomplete da lista de banidos) |
| `/kick` | Expulsa um membro |
| `/castigo aplicar` · `/castigo remover` | Aplica ou remove timeout (até 28 dias) |
| `/avisar` | Advertência. Aos 3, 5 e 7 avisos aplica castigo/expulsão automaticamente |
| `/avisos listar` · `remover` · `limpar` | Gerencia as advertências de um membro |
| `/limpar` | Apaga até 100 mensagens, com filtro por usuário, bots, anexos ou links |
| `/canal trancar` · `destrancar` · `lento` | Controla o canal |
| `/cargo adicionar` · `remover` | Gerencia cargos de um membro |
| `/apelido` | Altera ou remove o apelido |
| `/historico usuario` · `caso` | Consulta o histórico de punições |

### ⚙️ Configuração

| Comando | O que faz |
|---|---|
| `/config ver` | Mostra toda a configuração atual |
| `/config logs` · `boasvindas` · `saida` · `autorole` | Canais e mensagens automáticas |
| `/config niveis` · `recompensa` | Sistema de XP e cargos por nível |
| `/config starboard` · `tickets` · `moeda` | Demais módulos |
| `/automod ver` · `filtros` · `limites` · `punicao` · `palavras` · `ignorar` | Moderação automática |
| `/painelcargos` | Publica um painel de cargos com botões |

### 🔧 Utilidades

`/ajuda` · `/ping` · `/userinfo` · `/serverinfo` · `/avatar` · `/cargoinfo` · `/botinfo` ·
`/lembrete criar|listar|cancelar` · `/enquete` · `/afk` · `/snipe` ·
`/sugestao enviar|decidir` · `/baixar`

### 💞 Social

`/perfil` · `/bio` · `/rep dar|top` · `/casar` · `/divorciar`

### 📈 Níveis e 🪙 Economia

`/rank` · `/top niveis` · `/top moedas` · `/saldo` · `/daily` · `/trabalhar` · `/pagar` ·
`/apostar` · `/banco depositar|sacar` · `/roubar` · `/loja ver|comprar|inventario`

### 🎫 Tickets, 🎉 Sorteios, 🎮 Jogos e 🎲 Diversão

`/ticket abrir|fechar|adicionar|painel` · `/sorteio criar|encerrar|resortear` ·
`/velha` · `/quiz` · `/bola8` · `/dado` · `/escolher` · `/ppt` · `/ship`

### 🏗️ Servidor

| Comando | O que faz |
|---|---|
| `/construir` | Monta categorias, canais e cargos a partir de um modelo pronto |

Quatro modelos: **Hacking & Segurança**, **Comunidade**, **Gaming** e **Estudos**. O
comando abre um painel com a prévia do que será criado e um menu para incluir ou não os
cargos, os canais de voz e a área privada da staff. Nada é apagado — o construtor só
adiciona ao que já existe.

Exige **Gerenciar Servidor** de quem usa e **Gerenciar Canais** do bot (mais
**Gerenciar Cargos**, se for criar os cargos).

### 👑 Dono do bot

Só aparece e só funciona para o dono da aplicação. Não precisa configurar nada: o bot
pergunta ao Discord quem criou a aplicação. `OWNER_IDS` continua valendo para adicionar
mais gente.

São três camadas, e a do meio é a que realmente tranca:

1. O comando tem `default_member_permissions = 0`, então **some do menu** de quem não é
   administrador do servidor;
2. A cada uso, o bot compara o ID de quem chamou com a lista de donos — **é essa a
   trava**, e ela roda no seu servidor, não no Discord. Quem não passa recebe recusa e
   o comando **nunca chega a executar**;
3. O autocomplete tem a mesma checagem, porque é uma porta de entrada separada do
   `execute`.

Se a lista de donos estiver vazia (a consulta ao Discord falhou e o `OWNER_IDS` está em
branco), **ninguém** é dono — inclusive você. A falha é fechada de propósito.

Tentativas negadas aparecem nos logs com o nome e o ID de quem tentou:

```
WARN  Acesso negado: fulano (123…) tentou /dono em Servidor X (456…).
```

| Comando | O que faz |
|---|---|
| `/dono servidores` | Lista todos os servidores em que o bot está, com IDs |
| `/dono sair` | Faz o bot sair de um servidor pelo ID |
| `/dono deploy` | Registra os comandos: global, só neste servidor, ou limpa |
| `/dono convite` | Gera o link para adicionar o bot em servidores ilimitados |
| `/dono moedas` | Cria ou remove moedas de alguém |
| `/dono nivel` | Define o nível de alguém |
| `/dono stats` | Servidores, membros, memória e ping somando todos os shards |

Donos também **não pegam cooldown** em nenhum comando.

### 🧠 IA

`/ia` — pergunta e resposta pela API da Anthropic.

---

## Servidores ilimitados

O bot funciona em **quantos servidores você quiser** sem cadastrar ID nenhum. O que muda
é só onde os comandos ficam registrados:

| `GUILD_ID` no `.env` | Onde os comandos aparecem | Demora |
|---|---|---|
| preenchido | só naquele servidor | instantâneo |
| vazio | em todos os servidores | até 1 hora na primeira vez |

Para liberar em todos, faça uma vez:

1. `/dono deploy escopo:Global` — registra os comandos globalmente;
2. `/dono convite` — pega o link e adiciona o bot onde quiser.

O `GUILD_ID` pode continuar preenchido: nesse caso os comandos ficam registrados nos dois
lugares e o Discord mostra a versão do servidor. Se quiser deixar só o global, apague a
linha do `.env`, reinicie e rode `/dono deploy escopo:Limpar` no servidor antigo para
remover a duplicata.

> O ID do servidor **nunca** foi obrigatório para o bot entrar num servidor — ele serve
> apenas para o registro instantâneo dos comandos durante o desenvolvimento.

---

## Comando de IA

O `/ia` é **opcional**. Sem `ANTHROPIC_API_KEY` no `.env`, o comando continua registrado,
mas responde avisando que não está configurado — nada mais quebra.

Detalhes da implementação (`src/services/ai.js`):

- usa o modelo **`claude-opus-5`** (alterável em `ANTHROPIC_MODEL`);
- roda com `effort: "low"`, que deixa a resposta rápida e barata — adequado a um chat;
- um *system prompt* orienta o modelo a responder em português, dentro do limite de
  caracteres de um embed e sem preâmbulos;
- **fallback automático ativado**: se os classificadores de segurança recusarem o pedido,
  a própria API tenta outro modelo. Se a sua conta ainda não tiver esse recurso liberado,
  a primeira chamada devolve 400, o bot registra um aviso e segue funcionando sem ele;
- erros de chave inválida, limite de uso e sobrecarga viram mensagens claras para o usuário;
- o comando tem **20 segundos de cooldown** por pessoa, para conter gastos.

---

## Sharding

O Discord exige que um bot seja dividido em **shards** a partir de ~2.500 servidores;
cada shard é uma conexão que cuida de uma fatia dos servidores. Aqui cada shard roda em
um processo separado, supervisionado por `src/sharding.js`.

```bash
npm start              # SHARDING=auto: o Discord informa quantos shards usar
SHARDING=off npm start # processo único (o mesmo que npm run start:single)
SHARDING=4 npm start   # força 4 shards
```

A distribuição segue a fórmula oficial `(guild_id >> 22) % total_shards`, então um
servidor cai **sempre** no mesmo shard.

**O que precisou mudar no código** (sharding não é só ligar um interruptor):

| Ponto | Problema se ignorado | Solução |
|---|---|---|
| Opções do Client | O discord.js **não** lê `SHARDS`/`SHARD_COUNT` do ambiente sozinho — `shardCount` tem padrão `1`. Todo processo se conectaria como "shard 0 de 1" e receberia **todos** os servidores, duplicando XP, punições e eventos | `src/index.js` repassa as duas variáveis explicitamente |
| Agendador | Todo processo roda o laço de lembretes/sorteios/enquetes. Com 8 shards, o mesmo sorteio seria encerrado 8 vezes | Cada item é filtrado por `ownsGuild()`; lembretes de DM (sem servidor) ficam com o shard 0, para ter exatamente um dono |
| SQLite | Vários processos escrevendo no mesmo arquivo esbarram em `SQLITE_BUSY` | WAL + `busy_timeout = 5000` + `synchronous = NORMAL` |
| Contadores | `client.guilds.cache.size` é só a fatia local, então `/botinfo` e a presença mostrariam números errados | `broadcastEval` soma entre shards; se algum ainda não respondeu, cai para o número local e marca como *(parcial)* |
| Logs | Vários processos escrevendo no mesmo terminal | Prefixo `[shard N]` em cada linha |

**O que continua por processo, de propósito:** o estado das partidas, o `/snipe`, o
histórico do antispam e os cooldowns. Como um servidor mora sempre no mesmo shard, isso
funciona — a única consequência é que o cooldown de um comando é contado por shard, o
que só aparece para quem usa o bot em servidores de shards diferentes.

**Quando usar `off`:** desenvolvimento e bots pequenos. Abaixo de ~2.000 servidores o
processo supervisor só adiciona consumo de memória sem benefício.

**Aviso sobre `npm run dev`:** ele roda em processo único de propósito, porque
`--watch` reiniciando processos filhos junto com o supervisor gera reinícios em cascata.

## Download de vídeos (`/baixar`)

O comando puxa o vídeo de um link e envia como anexo no canal. Ele depende de dois
programas externos que **não** vêm com o `npm install`:

```bash
# Debian/Ubuntu
sudo apt install ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# macOS
brew install yt-dlp ffmpeg
```

Sem o `yt-dlp` no PATH o comando se desativa sozinho e avisa — nada mais quebra.
O `ffmpeg` é necessário para juntar vídeo+áudio em alta resolução e para a opção
`audio: true` (MP3).

**Limites embutidos:** 15 minutos de duração, 3 minutos de execução, 2 downloads
simultâneos, e o teto de upload do próprio servidor (10 MB, ou 50/100 MB com impulso
nível 2/3). Transmissões ao vivo são recusadas.

**Segurança:** o `yt-dlp` é chamado por `spawn` com lista de argumentos, nunca por
shell — o link do usuário não vira comando. A URL é validada antes: só `http`/`https`,
e endereços internos (`localhost`, faixas privadas, `169.254.169.254`) são bloqueados,
para o bot não virar um proxy para a rede onde está hospedado.

### Sobre marcas d'água

- **Marca d'água da plataforma:** o comando já busca a versão limpa quando a própria
  plataforma serve as duas — é o caso do TikTok, onde a variante marcada costuma vir
  sob `download_addr`. O seletor de formato pede explicitamente a versão sem marca e só
  cai para a marcada se for a única disponível. Onde a marca está queimada no vídeo pela
  plataforma, não há versão limpa para pedir.
- **Marca d'água do próprio criador:** isso **não** é removido, e foi uma decisão
  deliberada. Essa marca é a assinatura de quem fez o vídeo; apagá-la serve basicamente
  para republicar o trabalho de outra pessoa sem crédito. Por isso o embed de resposta
  mostra o autor original e um lembrete sobre direitos autorais, em vez de esconder a
  origem.

## Estrutura do projeto

```
src/
├── sharding.js           # supervisor: cria e reinicia os shards
├── index.js              # um shard: cria o client, carrega tudo e conecta
├── config.js             # lê o .env, cores e emojis padrão
├── commands/             # um arquivo por comando; a pasta define a categoria
│   ├── moderacao/  configuracao/  utilidades/
│   ├── niveis/     economia/      diversao/
│   └── sorteios/   tickets/       ia/
├── components/           # handlers de botões, agrupados por prefixo do custom_id
│   ├── ticket.js   giveaway.js   poll.js   role.js
├── events/               # um arquivo por evento do Discord
├── services/             # regras de negócio, sem depender de interações
│   ├── modcase.js  automod.js   leveling.js  economy.js
│   ├── tickets.js  giveaways.js polls.js     starboard.js
│   ├── scheduler.js  ai.js
├── handlers/loader.js    # carregamento automático dos arquivos acima
└── lib/                  # utilidades: db, logger, embeds, tempo, cooldown, permissões, shard
scripts/deploy-commands.js
```

**Como as peças conversam:** o `loader` varre as pastas e preenche `client.commands` e
`client.components`; o evento `interactionCreate` despacha slash commands, autocomplete e
botões; os **services** concentram a lógica e são os únicos que falam com o banco; o
`scheduler` roda a cada 15 segundos e processa lembretes, sorteios e enquetes vencidos.

Os `custom_id` dos botões seguem o formato `namespace:acao:arg1:arg2` — o `namespace`
escolhe o handler em `src/components/`.

---

## Como adicionar um comando

Crie um arquivo dentro da categoria desejada. Não é preciso registrar em lugar nenhum.

```js
// src/commands/utilidades/oi.js
import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { embed } from '../../lib/embeds.js';

export default {
  cooldown: 5, // segundos, opcional
  data: new SlashCommandBuilder()
    .setName('oi')
    .setDescription('Responde um olá.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, client) {
    await interaction.reply({ embeds: [embed.success('Olá!')] });
  },
};
```

Rode `npm run deploy` e reinicie o bot. Campos opcionais: `cooldown`, `ownerOnly`,
`guildOnly` (padrão `true`) e `autocomplete`.

---

## Banco de dados

SQLite via `better-sqlite3`, em modo WAL, criado automaticamente na primeira execução.
O esquema completo fica em `src/lib/db.js` e é aplicado com `CREATE TABLE IF NOT EXISTS` —
atualizar o bot não apaga dados.

Tabelas: `guilds`, `automod`, `cases`, `levels`, `level_rewards`, `economy`, `reminders`,
`giveaways`, `giveaway_entries`, `tickets`, `starboard`, `role_buttons`, `polls`,
`poll_votes`, `afk`, `profiles`, `inventory`, `custom_commands`, `suggestions`,
`suggestion_votes`.

Colunas adicionadas depois da primeira versão entram por migração automática
(`ALTER TABLE ... ADD COLUMN`, ignorando o erro de coluna já existente), então dá para
atualizar o bot sem recriar o banco.

Duas coisas ficam **só em memória**, de propósito: o estado das partidas de
`/velha` e `/quiz` (efêmero por natureza) e o `/snipe`, porque conteúdo apagado é
sensível e não deve sobreviver a um reinício nem ir para o disco — ele também expira
em 10 minutos.

**Backup:** basta copiar a pasta `data/` com o bot desligado.

---

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| Os comandos não aparecem | Faltou `npm run deploy`. Sem `GUILD_ID` o registro é global e leva até 1 hora |
| "Não tenho permissão para banir/expulsar" | O cargo do bot está abaixo do cargo do alvo. Mova o cargo do bot para cima |
| Níveis e AutoMod não funcionam | **Message Content Intent** desativado no Portal do Desenvolvedor |
| Boas-vindas e autorole não funcionam | **Server Members Intent** desativado |
| Starboard não posta | O bot precisa ver o canal de origem, ter histórico de mensagens e permissão de envio no canal do mural |
| `/ia` diz que não está configurado | Falta `ANTHROPIC_API_KEY` no `.env` |
| `/baixar` diz que não está disponível | `yt-dlp` não está no PATH do processo do bot |
| `/baixar` reclama de tamanho | O vídeo passou do teto de upload do servidor. Use `audio: true` ou aumente o nível de impulso |
| Comandos personalizados não respondem | O prefixo mudou (veja `/config ver`) ou falta a **Message Content Intent** |
| Sorteio encerrado várias vezes | Sinal de shards recebendo os mesmos servidores — confira se `SHARDS`/`SHARD_COUNT` não foram definidos à mão no `.env` (essas variáveis pertencem ao discord.js; a sua é `SHARDING`) |
| `/botinfo` mostra *(parcial)* | Algum shard ainda estava iniciando quando o comando rodou. Tente de novo em alguns segundos |
| Erro ao instalar `better-sqlite3` | Node abaixo da versão 20, ou faltam ferramentas de compilação para o *build* nativo |

---

## Licença

MIT.
