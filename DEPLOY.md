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

## Oracle Cloud — passo a passo

O *Always Free* da Oracle dá uma máquina ARM (Ampere A1) de até 4 núcleos e 24 GB
de RAM sem cobrar nada — bem mais do que este bot precisa. Em troca, o cadastro é
o mais chato de todos os provedores. Vale a pena, mas leia as três armadilhas no
fim desta seção antes de começar.

Os nomes abaixo estão como aparecem no **painel em português**, com o termo em
inglês entre parênteses — a Oracle muda a interface com frequência e algumas
telas ficam em inglês mesmo com o idioma em português.

### 1. Criar a conta

[oracle.com/br/cloud/free](https://www.oracle.com/br/cloud/free/) →
**Experimente gratuitamente** *(Start for free)*.

Pede **cartão de crédito** para verificar identidade. Recursos *Always Free* não
são cobrados; a Oracle faz uma cobrança simbólica de verificação e estorna. Ainda
assim, não deixe a conta virar *Pay As You Go* sem querer.

Escolha a região mais perto de você — **Brasil Leste (São Paulo)** ou
**Brasil Sudeste (Vinhedo)**. **A região não pode ser trocada depois.**

### 2. Gerar a chave SSH no celular

A Oracle **não usa senha**: só chave SSH. Faça isso antes de criar a máquina.

No **Termius** (o app costuma ficar em inglês): menu → *Keychain* → **+** →
*Generate key* → tipo **ED25519** → salve. Depois abra a chave criada e copie a
**chave pública** (*Public key*), que começa com `ssh-ed25519`.

### 3. Criar a máquina

No painel: menu ☰ → **Computação** *(Compute)* → **Instâncias** *(Instances)* →
botão **Criar instância** *(Create instance)*.

A Oracle usa um **assistente com etapas numeradas**: *Informações básicas* →
*Segurança* → *Rede* → *Armazenamento* → *Revisão*. Use **Próximo** para avançar
e **Anterior** para voltar e conferir — nada é criado até você clicar em **Criar**
na última etapa.

#### Etapa 1 — Informações básicas

| Campo | O que fazer |
|---|---|
| **Nome** | qualquer um, ex.: `bot-discord` |
| **Criar no compartimento** | deixe o que já vem (o compartimento raiz) |
| **Imagem** | **Canonical Ubuntu** → versão **24.04** |
| **Formato** *(Shape)* | aba **Ampere** → `VM.Standard.A1.Flex` → **2 OCPUs** e **12 GB** de memória |

Confira o selo **Elegível para Always Free** *(Always Free Eligible)* ao escolher
o formato. **Sem esse selo você está criando uma máquina paga.**

#### Etapa 2 — Segurança

Não precisa mexer em nada. Siga em **Próximo**.

#### Etapa 3 — Rede

É onde a maioria trava. O aviso *"Você deve selecionar uma sub-rede pública para
designar um endereço IPv4 público"* aparece porque nenhuma sub-rede foi escolhida
ainda.

| Campo | O que marcar |
|---|---|
| **Rede principal** | **Criar uma nova rede virtual na nuvem** |
| **Sub-rede** | **Criar uma nova sub-rede pública** |
| **Designação de endereço IPv4** | **Designar endereço IPv4 público automaticamente** |
| **Opções de início** | deixe em *Permitir que o Oracle Cloud Infrastructure escolha o melhor tipo de rede* |

A palavra **pública** na sub-rede é o que destrava o resto: numa sub-rede privada
o endereço IP público fica indisponível, e sem ele não dá para conectar pela
internet.

Ignore **Designação de endereço IPv6** e as **Opções avançadas** (registro de DNS).

##### Ainda na etapa 3: Adicionar chaves SSH

Aqui a Oracle oferece quatro opções. Nunca escolha *Nenhuma chave SSH* — você
ficaria sem nenhuma forma de entrar na máquina.

- **Já gerou a chave no Termius (passo 2)?** Marque **Colar chave pública** e cole
  o texto que começa com `ssh-ed25519`.
- **Não gerou?** Marque **Gerar um par de chaves para mim** e clique em
  **Fazer download da chave privada**. Depois importe esse arquivo no Termius.

> ⚠️ **Se escolher gerar, baixe a chave privada antes de sair da tela.** A Oracle
> não disponibiliza esse arquivo depois. Sem ele, a única saída é apagar a
> instância e criar outra.

#### Etapas 4 e 5 — Armazenamento e Revisão

Em **Armazenamento**, não mude nada: o disco padrão sobra para este bot.

Em **Revisão**, confira imagem, formato e o selo Always Free, e clique em
**Criar** *(Create)*.

O status fica laranja em **Provisionando** *(Provisioning)* e depois verde em
**Em execução** *(Running)* — aí aparece o **Endereço IP público**
*(Public IP address)*, que é o que você usa para conectar.

> **Não precisa liberar porta nenhuma.** O bot só faz conexões de saída — ele
> fala com o Discord, ninguém fala com ele. Se você achar tutorial mandando mexer
> em **Lista de Segurança** *(Security List)*, aquilo é para hospedar site.

### 4. Conectar e instalar

No Termius: **+** → *New host* → cole o IP → **Username: `ubuntu`** → escolha a
chave que você gerou. Conecte.

Depois é o mesmo instalador das outras opções:

```bash
curl -fsSLO https://raw.githubusercontent.com/w3bray/bot/main/scripts/install.sh
sudo bash install.sh
```

O usuário na Oracle é `ubuntu`, não `root` — por isso o `sudo` é obrigatório.

### As três armadilhas da Oracle

**1. "Não há capacidade de host suficiente"** *(Out of host capacity)* — o erro
mais comum ao criar a máquina ARM: a região está lotada. Não é problema seu:

- tente de novo mais tarde (madrugada costuma funcionar);
- troque o **Domínio de disponibilidade** *(Availability Domain)* — AD-1, AD-2, AD-3;
- ou use o formato AMD `VM.Standard.E2.1.Micro`, que quase sempre tem vaga — mas
  veja a armadilha 2.

**2. A máquina AMD gratuita tem só 1 GB de RAM.** Construir a imagem nela pode
travar por falta de memória. Se for a sua única opção, crie memória virtual
**antes** de rodar o instalador:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Na máquina ARM com 12 GB isso não é necessário.

**3. A Oracle pode recuperar máquinas ociosas.** As regras do *Always Free*
preveem retomar instâncias que ficam muito tempo com uso baixo de CPU, rede e
memória — e um bot de Discord é justamente de uso baixo. Confira os termos
atuais na sua conta; quem depende de 24/7 costuma migrar para *Pay As You Go*,
que mantém os mesmos recursos gratuitos mas não sofre essa recuperação. Se fizer
isso, fique de olho na fatura.

### Sobre o ARM

A máquina Ampere é ARM64, arquitetura diferente do PC comum — mas o `Dockerfile`
deste repositório funciona nela sem nenhuma mudança:

- o `better-sqlite3` usa binário pronto quando existe e **compila sozinho** quando
  não existe; os compiladores estão na primeira etapa da imagem;
- o `yt-dlp` que a imagem baixa é Python puro, sem arquitetura;
- `ffmpeg` e a imagem base do Node têm versão ARM64 oficial.

A primeira construção na ARM pode demorar alguns minutos a mais se ele precisar
compilar. É normal, e acontece uma vez só.

---

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
| Oracle: *"Você deve selecionar uma sub-rede pública para designar um endereço IPv4 público"* | Na etapa **Rede**, marque **Criar uma nova rede virtual na nuvem** e **Criar uma nova sub-rede pública**. Em sub-rede privada não existe IP público |
| Oracle: criei a instância e não consigo entrar | Você marcou *Nenhuma chave SSH*, ou gerou o par e não baixou a chave privada. Ela não fica disponível depois — apague a instância e crie de novo |

---

## Segurança

- **Nunca** mande seu token para ninguém, nem cole em chat, print ou repositório.
  Se vazar, use *Reset Token* no Developer Portal — o antigo morre na hora.
- O `.env` já está no `.gitignore` e no `.dockerignore`: ele não vai para o GitHub
  nem para dentro da imagem.
- No VPS, prefira entrar com chave SSH em vez de senha assim que se sentir à
  vontade — é mais seguro e você para de digitar senha no celular.
