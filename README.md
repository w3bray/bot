# Bot de Discord multiuso

Bot completo em **Node.js + discord.js v14**, com moderação automática, níveis, economia,
perfis sociais, atendimento, sorteios, enquetes, jogos, registros, mural de destaques e painel de cargos,
download de vídeos, construtor de servidor e um comando de IA.

Tudo em português do Brasil, com **100 comandos principais e 400 rotas executáveis** — usando
todo o limite de comandos globais do Discord —,
persistência em SQLite e
carregamento automático de comandos, eventos e botões.

No Discord em português do Brasil, comandos, subcomandos e opções aparecem com a
acentuação correta, como `/matemática`, `/moderação auditar-permissões` e
`usuário:@membro`.

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
| 🛡️ **Moderação** | Banimento, expulsão, castigo temporário, advertências com punição automática por acúmulo, limpeza de mensagens com filtros, controle de canais, cargos e apelidos |
| 📋 **Casos** | Toda punição vira um caso numerado, gravado no banco e enviado ao canal de registros. Consulta por usuário ou por número |
| 🤖 **Moderação automática** | Anti-convite, anti-link, antispam, limite de letras maiúsculas e de menções, além de uma lista de palavras proibidas. Punição configurável e isenção por cargo ou canal |
| 📈 **Níveis** | XP por mensagem com tempo de espera, curva progressiva, classificação e cargos entregues automaticamente ao subir de nível |
| 🪙 **Economia** | Recompensa diária, trabalho, banco, transferência, apostas com moeda virtual, loja, classificação por patrimônio e calculadoras financeiras |
| 💞 **Social** | Perfil completo com nível, patrimônio, reputação e distintivos; biografia, reputação diária e casamento com pedido por botão |
| 🎮 **Jogos** | Jogo da velha PvP no tabuleiro de botões e quiz de conhecimentos gerais que premia quem acerta primeiro |
| 📥 **Download de vídeo** | `/baixar` puxa o vídeo de um link e envia no canal, com opção de extrair só o áudio |
| 🎫 **Atendimento** | Painel com botão, canal privado, opções de assumir e encerrar, além de transcrição por mensagem direta e no canal de registros |
| 🎉 **Sorteios** | Botão de participação (clicar de novo cancela), exigência de cargo, encerramento automático e resorteio |
| 📊 **Enquetes** | Até 5 opções, votação por botão, barra de resultados ao vivo, escolha única ou múltipla, encerramento automático |
| ⭐ **Mural de destaques** | Mensagens que recebem ⭐ suficientes vão para um mural, com contador que se atualiza sozinho |
| 👋 **Boas-vindas** | Mensagens de entrada e saída com marcadores, e cargo automático para novos membros |
| 📜 **Registros** | Entradas, saídas, mensagens apagadas e editadas |
| 🎭 **Painel de cargos** | Botões para o membro pegar e remover cargos sozinho |
| 💡 **Sugestões** | Canal de sugestões com votação por botão e decisão da equipe |
| 💬 **Comandos próprios** | A equipe cria respostas automáticas do servidor, acionadas por prefixo |
| 🧠 **IA** | `/ia` responde perguntas usando a API da Anthropic (opcional) |
| 🔧 **Utilidades** | Latência, informações do usuário, servidor, cargo e bot, lembretes, ausência, mensagem apagada e ajuda navegável |
| 🎯 **Planejamento** | Pautas, atas, feedback, metas, 5W2H, matriz de risco, prioridades, cronogramas e planos de comunicação |
| 🎲 **Sorteios e lazer** | Dados, escolhas ponderadas, amostragens, jokenpô e jogos rápidos para o servidor |

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
   - ✅ **Message Content Intent** — moderação automática e sistema de níveis
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
| `GUILD_ID` | não | ID do servidor de testes, usado pelo `npm run deploy` para registro instantâneo. **Não afeta o `AUTO_DEPLOY`**, que registra sempre e só no global |
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
/configurar registros tipo:Moderação canal:#registros-mod
/configurar registros tipo:Servidor canal:#registros-servidor
/configurar boas-vindas canal:#bem-vindos mensagem:Boas-vindas ao {server}, {user}!
/configurar cargo-automático cargo:@Membro
/configurar níveis ativar:true canal:#níveis
/configurar recompensa nível:10 cargo:@Ativo
/configurar destaques canal:#destaques mínimo:5
/configurar atendimento categoria:Atendimento cargo:@Suporte registros:#registros-atendimento
/atendimento painel
/auto-moderação filtros convites:true excesso-mensagens:true
/auto-moderação punição ação:Apagar e castigar minutos:10
```

Confira tudo com `/configurar ver` e `/auto-moderação ver`.

**Marcadores** aceitos nas mensagens de boas-vindas e saída: `{user}` (menção),
`{username}`, `{tag}`, `{server}`, `{count}` (total de membros).
Na mensagem de nível: `{user}`, `{username}`, `{level}`, `{server}`.

---

## Lista de comandos

### 🛡️ Moderação

| Comando | O que faz |
|---|---|
| `/banir` | Bane um usuário, com opção de apagar as mensagens recentes dele |
| `/desbanir` | Remove o banimento (com preenchimento automático da lista de banidos) |
| `/expulsar` | Expulsa um membro |
| `/castigo aplicar` · `/castigo remover` | Aplica ou remove um castigo temporário (até 28 dias) |
| `/avisar` | Advertência. Aos 3, 5 e 7 avisos aplica castigo/expulsão automaticamente |
| `/avisos listar` · `/avisos remover` · `/avisos limpar` | Gerencia as advertências de um membro |
| `/limpar` | Apaga até 100 mensagens, com filtro por usuário, bots, anexos ou links |
| `/canal trancar` · `/canal destrancar` · `/canal lento` | Controla o canal |
| `/cargo adicionar` · `/cargo remover` | Gerencia cargos de um membro |
| `/apelido` | Altera ou remove o apelido |
| `/histórico usuário` · `/histórico caso` | Consulta o histórico de punições |

### ⚙️ Configuração

| Comando | O que faz |
|---|---|
| `/configurar ver` | Mostra toda a configuração atual |
| `/configurar registros` · `/configurar boas-vindas` · `/configurar saída` · `/configurar cargo-automático` | Canais e mensagens automáticas |
| `/configurar níveis` · `/configurar recompensa` | Sistema de XP e cargos por nível |
| `/configurar destaques` · `/configurar atendimento` · `/configurar moeda` | Demais módulos |
| `/auto-moderação ver` · `/auto-moderação filtros` · `/auto-moderação limites` · `/auto-moderação punição` · `/auto-moderação palavras` · `/auto-moderação ignorar` | Moderação automática |
| `/painel-cargos` | Publica um painel de cargos com botões |

### 🔧 Utilidades

`/ajuda` · `/ping` · `/info-usuário` · `/info-servidor` · `/avatar` · `/info-cargo` · `/info-bot` ·
`/lembrete criar` · `/lembrete listar` · `/lembrete cancelar` · `/enquete` · `/ausente` · `/apagada` ·
`/sugestão enviar` · `/sugestão decidir` · `/baixar`

### 💞 Social

`/perfil` · `/biografia` · `/reputação dar` · `/reputação ranking` · `/casar` · `/divorciar`

### 📈 Níveis e 🪙 Economia

`/nível` · `/ranking níveis` · `/ranking moedas` · `/saldo` · `/diário` · `/trabalhar` · `/pagar` ·
`/apostar` · `/banco depositar` · `/banco sacar` · `/roubar` · `/loja ver` · `/loja comprar` · `/loja inventário`

### 🎫 Atendimento, 🎉 Sorteios, 🎮 Jogos e 🎲 Sorteios aleatórios

`/atendimento abrir` · `/atendimento fechar` · `/atendimento adicionar` · `/atendimento painel` ·
`/sorteio criar` · `/sorteio encerrar` · `/sorteio resortear` ·
`/velha` · `/quiz` · `/dado` · `/escolher` · `/jokenpô` · `/ponderado` · `/amostra`

### 🏗️ Servidor

| Comando | O que faz |
|---|---|
| `/construir` | Monta categorias, canais e cargos a partir de um modelo pronto |

Quatro modelos: **Segurança e tecnologia**, **Comunidade**, **Jogos** e **Estudos**. O
comando abre um painel com a prévia do que será criado e um menu para incluir ou não a
limpeza, os cargos, os canais de voz e a área privada da equipe.

Existe um quinto modelo, **Servidor completo**, restrito ao dono do bot: 9 categorias,
37 canais e 7 cargos cobrindo comunidade, loja, academia, área VIP, parcerias e staff, com
emoji em cada canal e nome de categoria em itálico. Ele não aparece no menu nem nas opções
de `/construir` para mais ninguém — veja `/dono construir`.

O itálico não é recurso do Discord: são caracteres do bloco Mathematical Alphanumeric
Symbols. E o espaço em volta do `·` nos nomes de canal é U+2005, não o espaço comum — em
canal de texto o Discord troca espaço ASCII por hífen, e é por usarem espaço fora do ASCII
que servidores estilizados conseguem exibir `📷 · mídias` em vez de `📷-·-mídias`.

Exige **Gerenciar Servidor** de quem usa e **Gerenciar Canais** do bot (mais
**Gerenciar Cargos**, se for mexer nos cargos).

#### 🧨 A limpeza

O construtor começa **apagando os canais e cargos que já existem** — a opção vem marcada.
Desmarque `Apagar tudo que já existe antes de montar` no painel para só acrescentar ao que
o servidor já tem.

**O histórico de mensagens dos canais apagados some para sempre.** O Discord não guarda
cópia e não existe lixeira: nem o dono do servidor recupera. Por isso o botão vermelho leva
a uma segunda tela, que mostra os números reais (`vou apagar 34 canais e 9 cargos`) antes de
qualquer coisa acontecer.

O que a limpeza **não** consegue apagar, e continua de pé:

| Item | Motivo |
|---|---|
| `@everyone` | não existe servidor sem ele |
| Cargos de bots, integrações e do impulso | são `managed`; o Discord recusa |
| Cargos acima do cargo do bot | fora do alcance dele |
| Canal de regras e de avisos da moderação | um servidor de comunidade exige os dois |

A ordem é **montar primeiro, apagar depois**. Se o rate limit ou uma queda interromper o
processo no meio, o servidor fica com canais repetidos — que dá para resolver — em vez de
vazio, que não dá. O canal de onde o comando saiu é o último a cair, para você chegar a ler
o relatório; ele também é enviado para o primeiro canal novo, que sobrevive à limpeza.

### ✍️ Texto e código

| Comando | Subcomandos | O que faz |
|---|---|---|
| `/texto` | 25 | Caixa, ordem, limpeza, contagem, frequência de letras, efeitos |
| `/código` | 20 | Base64, hex, binário, Morse, César, MD5/SHA, Unicode, JSON, timestamp |

### 🔧 Mais utilidades

| Comando | Subcomandos | O que faz |
|---|---|---|
| `/converter` | 25 | Unidades, bases numéricas, romanos, número por extenso e coordenadas em DMS |
| `/matemática` | 21 | Expressões, estatística, primos, fatoração, juros, combinatória |
| `/gerar` | 20 | Senhas, UUID, cores, dados de teste, README, changelog, curl e arquivos auxiliares |
| `/tempo` | 18 | Fusos, contagens, idade, soma de dias úteis, progresso do ano e timestamps |
| `/planejar` | 25 | Pautas, atas, decisões, riscos, prioridades, capacidade e comunicação |

Também há `/estimativa` para cálculo PERT e `/avaliar-opções` para comparação ponderada
com critérios, notas e pesos definidos por quem usa.

O avaliador de expressões do `/matemática calcular` é escrito à mão, sem `eval`: só
números e os operadores `+ - * / % ^ ( )` são reconhecidos. Uma string vinda do Discord
nunca chega perto do interpretador.

### 🎲 Mais jogos e sorteios

| Comando | Subcomandos | O que faz |
|---|---|---|
| `/aleatório` | 25 | Sorteios ponderados, amostras, chaveamentos, distribuições e dados de teste |
| `/jogo` | 25 | Anagramas, lógica, sudoku, criptogramas e jogos de palavras — resposta em spoiler |

Os jogos não guardam estado: a resposta vai escondida num `||spoiler||`, então cada
partida cabe numa mensagem só, sem tabela, expiração nem limpeza.

### 🪙 Mais economia e área pessoal

| Comando | Rotas no conjunto | O que faz |
|---|---|---|
| `/bolso` | 24 | Apostas com moeda virtual, rodada de mercado e estatísticas patrimoniais |
| `/pessoal` | 25 | Anotações, tarefas, metas, guardados e aniversários — sempre privados |

O tempo de espera da rodada de mercado fica na tabela `acoes`, não em memória. Reiniciar
o bot não libera uma nova rodada antes da hora.

### 🏗️ Servidor

| Comando | Subcomandos | O que faz |
|---|---|---|
| `/construir` | — | Monta o servidor a partir de um modelo pronto |
| `/servidor` | 25 | Proprietário, cargos, canais sem categoria, emojis, impulsos, banidos e permissões |
| `/moderação` | 25 | Auditoria de permissões, cargos vazios, canais inativos, webhooks, cargos em massa e voz |

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
| `/dono registrar` | Atualiza os comandos globais e limpa registros antigos por servidor |
| `/dono construir` | Monta o servidor no modelo **completo** — 9 categorias, 37 canais, 7 cargos |
| `/dono convite` | Gera o link para adicionar o bot em servidores ilimitados |
| `/dono moedas` | Cria ou remove moedas de alguém |
| `/dono nível` | Define o nível de alguém |
| `/dono estatísticas` | Servidores, membros, memória e latência somando todos os processos |

Donos também **não pegam cooldown** em nenhum comando.

### 🧠 IA

`/ia` — pergunta e resposta pela API da Anthropic.

---

## Servidores ilimitados

O bot funciona em **quantos servidores você quiser** sem cadastrar ID nenhum. Com
`AUTO_DEPLOY=true` os comandos são registrados **só no escopo global**, que pertence à
aplicação e não ao servidor — então valem em todo servidor onde o bot está, inclusive nos
que ele entrar depois.

Para adicionar o bot em outro lugar, `/dono convite` dá o link. Não há passo de registro.

### Por que não registrar também por servidor

Comandos de servidor e comandos globais são **dois registros independentes**, e o Discord
mostra **os dois** na lista. Registrar o mesmo conjunto nos dois escopos faz cada comando
aparecer **duplicado** ao digitar `/`.

Por isso o `AUTO_DEPLOY` usa apenas o global. Ele também apaga, na inicialização,
registros de servidor deixados por versões antigas — a limpeza roda uma vez e depois não
encontra mais nada para fazer.

Para desenvolver com registro instantâneo, desligue o `AUTO_DEPLOY` e use
`npm run deploy` com `GUILD_ID` preenchido: aí o escopo de servidor é intencional e não há
global para duplicar.

> A espera de até uma hora vale para **mudanças** no conjunto de comandos globais se
> propagarem, não para servidores novos.

---

## Por que 400 comandos e não 400 barras

O Discord aceita no **máximo 100 comandos de barra por aplicação**. Não é limitação do
bot: passar disso faz o registro inteiro ser recusado e o bot fica com **zero** comandos.

O projeto usa exatamente esse teto: **100 comandos de topo**, e os outros 300 vivem como
subcomandos deles — `/texto título`, `/bolso comparar-patrimônio`. O preenchimento automático do Discord
acha qualquer um pelo nome.

Os mais usados são promovidos a comando próprio: uma família declara
`atalhos: ['senha', 'uuid']` e esses subcomandos **saem** dela para virar `/senha` e
`/uuid`. Saem mesmo — manter os dois caminhos faria o mesmo trabalho aparecer duas vezes
na lista e contar duas vezes no total.

> Existe um teto maior e pouco conhecido: além dos 100 globais, dá para registrar outros
> 100 **específicos de um servidor**, chegando a 200 naquele servidor. Não usamos isso: os
> comandos extras não funcionariam nos outros servidores.

As famílias grandes são declaradas como tabela em `src/lib/familia.js`, não com o builder
na mão. O helper valida na carga o que o Discord validaria só no deploy — nome duplicado,
descrição acima de 100 caracteres, opção obrigatória depois de opcional — então um erro
aparece no `npm start` em vez de derrubar o registro de todos os comandos.

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
| Contadores | `client.guilds.cache.size` é só a fatia local, então `/info-bot` e a presença mostrariam números errados | `broadcastEval` soma entre processos; se algum ainda não respondeu, cai para o número local e marca como *(parcial)* |
| Registros | Vários processos escrevendo no mesmo terminal | Prefixo `[shard N]` em cada linha |

**O que continua por processo, de propósito:** o estado das partidas, o `/apagada`, o
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
`/velha` e `/quiz` (efêmero por natureza) e o `/apagada`, porque conteúdo apagado é
sensível e não deve sobreviver a um reinício nem ir para o disco — ele também expira
em 10 minutos.

**Backup:** basta copiar a pasta `data/` com o bot desligado.

---

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| Os comandos não aparecem | Faltou `npm run deploy`. Sem `GUILD_ID` o registro é global e leva até 1 hora |
| "Não tenho permissão para banir/expulsar" | O cargo do bot está abaixo do cargo do alvo. Mova o cargo do bot para cima |
| Níveis e moderação automática não funcionam | **Message Content Intent** desativado no Portal do Desenvolvedor |
| Boas-vindas e autorole não funcionam | **Server Members Intent** desativado |
| O mural de destaques não publica | O bot precisa ver o canal de origem, ter histórico de mensagens e permissão de envio no canal do mural |
| `/ia` diz que não está configurado | Falta `ANTHROPIC_API_KEY` no `.env` |
| `/baixar` diz que não está disponível | `yt-dlp` não está no PATH do processo do bot |
| `/baixar` reclama de tamanho | O vídeo passou do teto de upload do servidor. Use `audio: true` ou aumente o nível de impulso |
| Comandos personalizados não respondem | O prefixo mudou (veja `/configurar ver`) ou falta a **Message Content Intent** |
| Sorteio encerrado várias vezes | Sinal de shards recebendo os mesmos servidores — confira se `SHARDS`/`SHARD_COUNT` não foram definidos à mão no `.env` (essas variáveis pertencem ao discord.js; a sua é `SHARDING`) |
| `/info-bot` mostra *(parcial)* | Algum processo ainda estava iniciando quando o comando rodou. Tente de novo em alguns segundos |
| Erro ao instalar `better-sqlite3` | Node abaixo da versão 20, ou faltam ferramentas de compilação para o *build* nativo |

---

## Licença

MIT.
