# Bot de Discord multiuso

Bot completo em **Node.js + discord.js v14**, com moderação, AutoMod, níveis, economia,
tickets, sorteios, enquetes, logs, starboard, painel de cargos e um comando de IA.

Tudo em português do Brasil, com **39 slash commands**, persistência em SQLite e
carregamento automático de comandos, eventos e botões.

---

## Índice

- [O que ele faz](#o-que-ele-faz)
- [Instalação](#instalação)
- [Configuração no Discord](#configuração-no-discord)
- [Primeiros passos no servidor](#primeiros-passos-no-servidor)
- [Lista de comandos](#lista-de-comandos)
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
| 🪙 **Economia** | Recompensa diária com sequência, trabalho, transferência entre membros, aposta e ranking de riqueza |
| 🎫 **Tickets** | Painel com botão, canal privado por atendimento, botões de assumir/fechar, transcrição enviada por DM e para o log |
| 🎉 **Sorteios** | Botão de participação (clicar de novo cancela), exigência de cargo, encerramento automático e resorteio |
| 📊 **Enquetes** | Até 5 opções, votação por botão, barra de resultados ao vivo, escolha única ou múltipla, encerramento automático |
| ⭐ **Starboard** | Mensagens que recebem ⭐ suficientes vão para um mural, com contador que se atualiza sozinho |
| 👋 **Boas-vindas** | Mensagens de entrada e saída com marcadores, e cargo automático para novos membros |
| 📜 **Logs** | Entradas, saídas, mensagens apagadas e editadas |
| 🎭 **Painel de cargos** | Botões para o membro pegar e remover cargos sozinho |
| 🧠 **IA** | `/ia` responde perguntas usando a API da Anthropic (opcional) |
| 🔧 **Utilidades** | Ping, userinfo, serverinfo, avatar, cargoinfo, botinfo, lembretes, AFK e ajuda navegável |
| 🎲 **Diversão** | Bola 8, dados, escolher, pedra-papel-tesoura e ship |

---

## Instalação

Requisitos: **Node.js 20 ou superior**.

```bash
git clone <url-do-repositorio>
cd bot
npm install
cp .env.example .env
```

Preencha o `.env` (veja a seção seguinte), registre os comandos e inicie:

```bash
npm run deploy   # registra os slash commands
npm start        # liga o bot
```

Durante o desenvolvimento, `npm run dev` reinicia o bot a cada alteração de arquivo.

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
| `OWNER_IDS` | não | IDs dos donos, separados por vírgula. Ignoram os cooldowns |
| `DATABASE_PATH` | não | Caminho do arquivo SQLite (padrão `./data/bot.db`) |
| `LOG_LEVEL` | não | `debug`, `info`, `warn` ou `error` |
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
`/lembrete criar|listar|cancelar` · `/enquete` · `/afk`

### 📈 Níveis e 🪙 Economia

`/rank` · `/top niveis` · `/top moedas` · `/saldo` · `/daily` · `/trabalhar` · `/pagar` · `/apostar`

### 🎫 Tickets, 🎉 Sorteios e 🎲 Diversão

`/ticket abrir|fechar|adicionar|painel` · `/sorteio criar|encerrar|resortear` ·
`/bola8` · `/dado` · `/escolher` · `/ppt` · `/ship`

### 🧠 IA

`/ia` — pergunta e resposta pela API da Anthropic.

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

## Estrutura do projeto

```
src/
├── index.js              # cria o client, carrega tudo e conecta
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
└── lib/                  # utilidades: db, logger, embeds, tempo, cooldown, permissões
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
`poll_votes`, `afk`.

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
| Erro ao instalar `better-sqlite3` | Node abaixo da versão 20, ou faltam ferramentas de compilação para o *build* nativo |

---

## Licença

MIT.
