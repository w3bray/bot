import crypto from 'node:crypto';
import { colors } from '../../config.js';
import { db, getGuildConfig } from '../../lib/db.js';
import { embed, truncate } from '../../lib/embeds.js';
import { aviso, familia, opt } from '../../lib/familia.js';
import { formatDuration } from '../../lib/time.js';
import { addBalance, getAccount, updateAccount } from '../../services/economy.js';

const sortear = (max) => crypto.randomInt(max);
const escolher = (itens) => itens[sortear(itens.length)];
const entre = (min, max) => min + sortear(max - min + 1);

const lerAcao = db.prepare('SELECT quando FROM acoes WHERE guild_id = ? AND user_id = ? AND acao = ?');
const gravarAcao = db.prepare(`
  INSERT INTO acoes (guild_id, user_id, acao, quando) VALUES (?, ?, ?, ?)
  ON CONFLICT (guild_id, user_id, acao) DO UPDATE SET quando = excluded.quando
`);

/** Cooldown durável: falha com aviso legível se ainda não deu o tempo. */
function cobrarEspera(interaction, acao, duracao) {
  const anterior = lerAcao.get(interaction.guildId, interaction.user.id, acao)?.quando ?? 0;
  const restante = anterior + duracao - Date.now();
  if (restante > 0) throw aviso(`Calma! Você pode fazer isso de novo em **${formatDuration(restante)}**.`);
  gravarAcao.run(interaction.guildId, interaction.user.id, acao, Date.now());
}

const moeda = (interaction) => getGuildConfig(interaction.guildId)?.currency_name ?? 'moedas';
const dinheiro = (valor, interaction) => `**${valor.toLocaleString('pt-BR')}** ${moeda(interaction)}`;

const saldoDe = (interaction, userId = interaction.user.id) =>
  getAccount(interaction.guildId, userId).balance;

/** Atividade que rende dinheiro com chance de dar errado. */
const atividade = ({ name, description, emoji, espera, minimo, maximo, sucessos, fracassos, chance = 80 }) => ({
  name,
  description,
  run: (_, interaction) => {
    cobrarEspera(interaction, name, espera);
    if (sortear(100) >= chance) {
      return `${emoji} ${escolher(fracassos)}\n\nVocê não ganhou nada dessa vez.`;
    }
    const ganho = entre(minimo, maximo);
    const conta = addBalance(interaction.guildId, interaction.user.id, ganho);
    return `${emoji} ${escolher(sucessos)}\n\nVocê ganhou ${dinheiro(ganho, interaction)}.\nSaldo: ${dinheiro(conta.balance, interaction)}`;
  },
});

/** Aposta simples: valida a entrada, resolve e ajusta o saldo. */
function apostar(interaction, valor, ganhou, multiplicador = 2) {
  const saldo = saldoDe(interaction);
  if (valor > saldo) throw aviso(`Você só tem ${dinheiro(saldo, interaction)}.`);
  const delta = ganhou ? Math.round(valor * (multiplicador - 1)) : -valor;
  const conta = addBalance(interaction.guildId, interaction.user.id, delta);
  return { delta, saldo: conta.balance };
}

const APOSTA = opt.inteiro('valor', 'Quanto apostar', true, { min: 1, max: 1_000_000 });

export default familia({
  name: 'bolso',
  description: 'Trabalhos, apostas, investimentos e o que fazer com o seu dinheiro.',
  cooldown: 2,
  dm: false,
  subs: [
    atividade({
      name: 'minerar', description: 'Vai para a mina atrás de minérios.', emoji: '⛏️',
      espera: 20 * 60_000, minimo: 60, maximo: 420, chance: 85,
      sucessos: ['Você achou um veio de ferro.', 'Saiu um punhado de ouro!', 'Uma safira no meio da pedra.'],
      fracassos: ['A picareta quebrou logo no começo.', 'Só pedra comum hoje.'],
    }),
    atividade({
      name: 'pescar', description: 'Joga a linha e espera.', emoji: '🎣',
      espera: 15 * 60_000, minimo: 40, maximo: 300, chance: 80,
      sucessos: ['Um dourado enorme!', 'Pegou um cardume inteiro.', 'Tilápia gorda na rede.'],
      fracassos: ['Só veio uma bota velha.', 'O peixe roubou a isca e fugiu.'],
    }),
    atividade({
      name: 'cacar', description: 'Sai para caçar na mata.', emoji: '🏹',
      espera: 25 * 60_000, minimo: 80, maximo: 500, chance: 70,
      sucessos: ['Voltou com a caça do dia.', 'Um javali grande!'],
      fracassos: ['Perdeu o rastro.', 'Você tropeçou e espantou tudo.'],
    }),
    atividade({
      name: 'plantar', description: 'Planta e colhe na roça.', emoji: '🌱',
      espera: 45 * 60_000, minimo: 150, maximo: 700, chance: 90,
      sucessos: ['A colheita rendeu bem.', 'O milho deu no ponto.', 'Feira cheia hoje!'],
      fracassos: ['A praga comeu tudo.', 'Choveu demais e apodreceu.'],
    }),
    atividade({
      name: 'reciclar', description: 'Recolhe recicláveis pela cidade.', emoji: '♻️',
      espera: 10 * 60_000, minimo: 20, maximo: 160, chance: 95,
      sucessos: ['Encheu o saco de latinhas.', 'Achou papelão bom.'],
      fracassos: ['Alguém passou antes de você.'],
    }),
    atividade({
      name: 'programar', description: 'Pega um freela de programação.', emoji: '💻',
      espera: 60 * 60_000, minimo: 300, maximo: 1200, chance: 75,
      sucessos: ['Entregou o sistema e o cliente pagou à vista.', 'Corrigiu o bug em 10 minutos e cobrou por 10 horas.'],
      fracassos: ['O cliente sumiu sem pagar.', 'Os requisitos mudaram no meio e o projeto morreu.'],
    }),
    atividade({
      name: 'transmitir', description: 'Faz uma live e recebe doações.', emoji: '🎥',
      espera: 40 * 60_000, minimo: 100, maximo: 900, chance: 65,
      sucessos: ['A live bombou!', 'Um viewer generoso mandou um valor alto.'],
      fracassos: ['Zero espectadores hoje.', 'A internet caiu no meio.'],
    }),
    atividade({
      name: 'entregar', description: 'Faz entregas de bicicleta.', emoji: '🛵',
      espera: 20 * 60_000, minimo: 70, maximo: 350, chance: 88,
      sucessos: ['Sete entregas sem atraso.', 'A gorjeta foi melhor que a corrida.'],
      fracassos: ['O pedido caiu no caminho.'],
    }),
    {
      name: 'crime',
      description: 'Alto risco, alto retorno. Pode dar muito errado.',
      run: (_, interaction) => {
        cobrarEspera(interaction, 'crime', 90 * 60_000);
        const saldo = saldoDe(interaction);
        if (sortear(100) < 45) {
          const ganho = entre(400, 2000);
          const conta = addBalance(interaction.guildId, interaction.user.id, ganho);
          return `🕶️ ${escolher(['Deu tudo certo e ninguém viu.', 'Saída limpa pelos fundos.'])}\n\nVocê levou ${dinheiro(ganho, interaction)}.\nSaldo: ${dinheiro(conta.balance, interaction)}`;
        }
        const multa = Math.min(saldo, entre(200, 900));
        const conta = addBalance(interaction.guildId, interaction.user.id, -multa);
        return `🚔 ${escolher(['Você foi pego em flagrante.', 'O alarme disparou.'])}\n\nPagou ${dinheiro(multa, interaction)} de multa.\nSaldo: ${dinheiro(conta.balance, interaction)}`;
      },
    },
    {
      name: 'mendigar',
      description: 'Pede uma ajudinha. Rende pouco, mas é rápido.',
      run: (_, interaction) => {
        cobrarEspera(interaction, 'mendigar', 5 * 60_000);
        const saldo = saldoDe(interaction);
        if (saldo > 5000) throw aviso('Você está rico demais para pedir esmola. 💰');
        const ganho = entre(5, 60);
        const conta = addBalance(interaction.guildId, interaction.user.id, ganho);
        return `🥺 ${escolher(['Alguém teve pena de você.', 'Um estranho deu uns trocados.'])}\n\n+${dinheiro(ganho, interaction)}\nSaldo: ${dinheiro(conta.balance, interaction)}`;
      },
    },
    {
      name: 'apostar-moeda',
      description: 'Cara ou coroa valendo dinheiro.',
      options: [
        APOSTA,
        { kind: 'string', name: 'lado', description: 'Sua escolha', required: true,
          choices: [{ name: 'Cara', value: 'cara' }, { name: 'Coroa', value: 'coroa' }] },
      ],
      run: ({ valor, lado }, interaction) => {
        const saiu = sortear(2) ? 'cara' : 'coroa';
        const { delta, saldo } = apostar(interaction, valor, saiu === lado);
        return `🪙 Saiu **${saiu}**!\n\n${delta > 0 ? `Você ganhou ${dinheiro(delta, interaction)}` : `Você perdeu ${dinheiro(-delta, interaction)}`}.\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'apostar-dado',
      description: 'Acerte o número do dado e ganhe 5x.',
      options: [APOSTA, opt.inteiro('numero', 'De 1 a 6', true, { min: 1, max: 6 })],
      run: ({ valor, numero }, interaction) => {
        const saiu = sortear(6) + 1;
        const { delta, saldo } = apostar(interaction, valor, saiu === numero, 5);
        return `🎲 Caiu **${saiu}**!\n\n${delta > 0 ? `Você ganhou ${dinheiro(delta, interaction)}` : `Você perdeu ${dinheiro(-delta, interaction)}`}.\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'caca-niquel',
      description: 'Gira a máquina caça-níquel.',
      options: [APOSTA],
      run: ({ valor }, interaction) => {
        const simbolos = ['🍒', '🍋', '🔔', '⭐', '💎'];
        const giro = [escolher(simbolos), escolher(simbolos), escolher(simbolos)];
        const iguais = new Set(giro).size;
        const multiplicador = iguais === 1 ? 10 : iguais === 2 ? 2 : 0;
        const { delta, saldo } = apostar(interaction, valor, multiplicador > 0, multiplicador);
        return `🎰 ${giro.join(' | ')}\n\n${
          multiplicador === 10 ? `**JACKPOT!** ${dinheiro(delta, interaction)}` :
          multiplicador === 2 ? `Dois iguais! +${dinheiro(delta, interaction)}` :
          `Nada. Você perdeu ${dinheiro(-delta, interaction)}.`
        }\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'roleta',
      description: 'Aposta na cor da roleta.',
      options: [
        APOSTA,
        { kind: 'string', name: 'cor', description: 'A cor', required: true,
          choices: [
            { name: 'Vermelho (2x)', value: 'vermelho' },
            { name: 'Preto (2x)', value: 'preto' },
            { name: 'Verde (14x)', value: 'verde' },
          ] },
      ],
      run: ({ valor, cor }, interaction) => {
        const numero = sortear(37);
        const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        const saiu = numero === 0 ? 'verde' : vermelhos.includes(numero) ? 'vermelho' : 'preto';
        const { delta, saldo } = apostar(interaction, valor, saiu === cor, cor === 'verde' ? 14 : 2);
        const emoji = { verde: '🟢', vermelho: '🔴', preto: '⚫' }[saiu];
        return `🎡 Caiu **${numero}** ${emoji} (${saiu})\n\n${delta > 0 ? `Você ganhou ${dinheiro(delta, interaction)}` : `Você perdeu ${dinheiro(-delta, interaction)}`}.\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'alto-baixo',
      description: 'Adivinhe se a próxima carta é maior ou menor.',
      options: [
        APOSTA,
        { kind: 'string', name: 'palpite', description: 'Sua aposta', required: true,
          choices: [{ name: 'Maior', value: 'maior' }, { name: 'Menor', value: 'menor' }] },
      ],
      run: ({ valor, palpite }, interaction) => {
        const primeira = sortear(13) + 1;
        const segunda = sortear(13) + 1;
        const nome = (n) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[n] ?? String(n);
        if (primeira === segunda) return `🃏 Saiu **${nome(primeira)}** e **${nome(segunda)}** — empate, aposta devolvida.`;
        const acertou = (segunda > primeira) === (palpite === 'maior');
        const { delta, saldo } = apostar(interaction, valor, acertou);
        return `🃏 **${nome(primeira)}** → **${nome(segunda)}**\n\n${delta > 0 ? `Acertou! +${dinheiro(delta, interaction)}` : `Errou. −${dinheiro(-delta, interaction)}`}\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'loteria',
      description: 'Aposta num número de 1 a 100. Prêmio de 50x.',
      options: [APOSTA, opt.inteiro('numero', 'De 1 a 100', true, { min: 1, max: 100 })],
      run: ({ valor, numero }, interaction) => {
        const sorteado = sortear(100) + 1;
        const { delta, saldo } = apostar(interaction, valor, sorteado === numero, 50);
        return `🎟️ O número sorteado foi **${sorteado}**.\n\n${delta > 0 ? `🎉 **VOCÊ GANHOU** ${dinheiro(delta, interaction)}!` : `Não foi dessa vez. −${dinheiro(-delta, interaction)}`}\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'investir',
      description: 'Investe e descobre o resultado na hora.',
      options: [opt.inteiro('valor', 'Quanto investir', true, { min: 100, max: 1_000_000 })],
      run: ({ valor }, interaction) => {
        cobrarEspera(interaction, 'investir', 30 * 60_000);
        const saldo = saldoDe(interaction);
        if (valor > saldo) throw aviso(`Você só tem ${dinheiro(saldo, interaction)}.`);
        // Retorno entre −40% e +60%: esperança levemente positiva, com risco real.
        const variacao = entre(-40, 60);
        const resultado = Math.round((valor * variacao) / 100);
        const conta = addBalance(interaction.guildId, interaction.user.id, resultado);
        return [
          `📈 Você investiu ${dinheiro(valor, interaction)}.`,
          `Variação: **${variacao > 0 ? '+' : ''}${variacao}%**`,
          resultado >= 0 ? `Lucro: ${dinheiro(resultado, interaction)}` : `Prejuízo: ${dinheiro(-resultado, interaction)}`,
          `Saldo: ${dinheiro(conta.balance, interaction)}`,
        ].join('\n');
      },
    },
    {
      name: 'doar',
      description: 'Doa parte do seu dinheiro para alguém.',
      options: [opt.usuario('membro', 'Quem recebe', true), opt.inteiro('valor', 'Quanto doar', true, { min: 1, max: 1_000_000 })],
      run: ({ membro, valor }, interaction) => {
        if (membro.id === interaction.user.id) throw aviso('Doar para si mesmo não move nada.');
        if (membro.bot) throw aviso('Bots não usam dinheiro.');
        const saldo = saldoDe(interaction);
        if (valor > saldo) throw aviso(`Você só tem ${dinheiro(saldo, interaction)}.`);
        addBalance(interaction.guildId, interaction.user.id, -valor);
        addBalance(interaction.guildId, membro.id, valor);
        return `💝 Você doou ${dinheiro(valor, interaction)} para ${membro}.`;
      },
    },
    {
      name: 'rachar',
      description: 'Divide um valor entre várias pessoas.',
      options: [
        opt.inteiro('valor', 'Valor total', true, { min: 2, max: 1_000_000 }),
        opt.inteiro('pessoas', 'Entre quantas pessoas', true, { min: 2, max: 50 }),
      ],
      run: ({ valor, pessoas }, interaction) => {
        const cada = Math.floor(valor / pessoas);
        const resto = valor % pessoas;
        return [
          `Dividindo ${dinheiro(valor, interaction)} entre **${pessoas}** pessoas:`,
          `Cada uma paga **${cada.toLocaleString('pt-BR')}**`,
          resto > 0 ? `Sobram **${resto}** — alguém paga a mais.` : 'Divisão exata. ✅',
        ].join('\n');
      },
    },
    {
      name: 'extrato',
      description: 'Mostra a sua situação financeira completa.',
      options: [opt.usuario('membro', 'De quem (padrão: você)', false)],
      run: ({ membro }, interaction) => {
        const alvo = membro ?? interaction.user;
        const conta = getAccount(interaction.guildId, alvo.id);
        const total = conta.balance + conta.bank;
        const posicao = db
          .prepare('SELECT COUNT(*) AS acima FROM economy WHERE guild_id = ? AND (balance + bank) > ?')
          .get(interaction.guildId, total).acima + 1;
        return {
          embeds: [
            embed.base(colors.economy)
              .setTitle(`Extrato de ${alvo.username}`)
              .setThumbnail(alvo.displayAvatarURL({ size: 128 }))
              .addFields(
                { name: 'Carteira', value: dinheiro(conta.balance, interaction), inline: true },
                { name: 'Banco', value: dinheiro(conta.bank, interaction), inline: true },
                { name: 'Total', value: dinheiro(total, interaction), inline: true },
                { name: 'Posição', value: `#${posicao}`, inline: true },
                { name: 'Sequência diária', value: `${conta.streak} dia(s)`, inline: true },
              ),
          ],
        };
      },
    },
    {
      name: 'ranking',
      description: 'Os mais ricos do servidor, somando banco e carteira.',
      run: (_, interaction) => {
        const linhas = db
          .prepare('SELECT user_id, balance + bank AS total FROM economy WHERE guild_id = ? ORDER BY total DESC LIMIT 15')
          .all(interaction.guildId)
          .map((r, i) => `${['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`} <@${r.user_id}> — ${r.total.toLocaleString('pt-BR')}`);
        return {
          embeds: [
            embed.base(colors.economy)
              .setTitle(`Mais ricos de ${interaction.guild.name}`)
              .setDescription(truncate(linhas.join('\n') || '_Ninguém tem dinheiro ainda._', 4000)),
          ],
        };
      },
    },
    {
      name: 'total-servidor',
      description: 'Quanto dinheiro existe no servidor inteiro.',
      run: (_, interaction) => {
        const dados = db
          .prepare('SELECT COUNT(*) AS contas, SUM(balance + bank) AS total, MAX(balance + bank) AS maior FROM economy WHERE guild_id = ?')
          .get(interaction.guildId);
        const total = dados.total ?? 0;
        return [
          `**${(dados.contas ?? 0).toLocaleString('pt-BR')}** contas`,
          `Total em circulação: **${total.toLocaleString('pt-BR')}** ${moeda(interaction)}`,
          `Maior fortuna: **${(dados.maior ?? 0).toLocaleString('pt-BR')}**`,
          `Média por conta: **${dados.contas ? Math.round(total / dados.contas).toLocaleString('pt-BR') : 0}**`,
        ].join('\n');
      },
    },
    {
      name: 'zerar-minha-conta',
      description: 'Apaga o seu próprio saldo. Sem volta.',
      run: (_, interaction) => {
        const saldo = getAccount(interaction.guildId, interaction.user.id);
        if (saldo.balance + saldo.bank === 0) throw aviso('Sua conta já está zerada.');
        updateAccount(interaction.guildId, interaction.user.id, { balance: 0, bank: 0 });
        return `💸 Conta zerada. Você abriu mão de ${dinheiro(saldo.balance + saldo.bank, interaction)}.`;
      },
    },
    {
      name: 'esperas',
      description: 'Mostra quanto falta para cada atividade liberar.',
      run: (_, interaction) => {
        const tempos = {
          mendigar: 5 * 60_000, reciclar: 10 * 60_000, pescar: 15 * 60_000,
          minerar: 20 * 60_000, entregar: 20 * 60_000, cacar: 25 * 60_000,
          investir: 30 * 60_000, transmitir: 40 * 60_000, plantar: 45 * 60_000,
          programar: 60 * 60_000, crime: 90 * 60_000,
        };
        const agora = Date.now();
        const linhas = Object.entries(tempos).map(([acao, duracao]) => {
          const quando = lerAcao.get(interaction.guildId, interaction.user.id, acao)?.quando ?? 0;
          const falta = quando + duracao - agora;
          return `${falta > 0 ? '⏳' : '✅'} \`/bolso ${acao}\` — ${falta > 0 ? formatDuration(falta) : 'disponível'}`;
        });
        return { embeds: [embed.base(colors.economy).setTitle('Suas atividades').setDescription(linhas.join('\n'))] };
      },
    },
  ],
});
