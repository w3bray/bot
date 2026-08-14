import crypto from 'node:crypto';
import { colors } from '../../config.js';
import { db, getGuildConfig } from '../../lib/db.js';
import { embed } from '../../lib/embeds.js';
import { aviso, familia, opt } from '../../lib/familia.js';
import { quantidade } from '../../lib/portugues.js';
import { formatDuration } from '../../lib/time.js';
import { addBalance, getAccount, updateAccount } from '../../services/economy.js';

const sortear = (max) => crypto.randomInt(max);
const escolher = (itens) => itens[sortear(itens.length)];
const entre = (min, max) => min + sortear(max - min + 1);
const formatar = (valor, casas = 2) =>
  Number(valor.toFixed(casas)).toLocaleString('pt-BR', { maximumFractionDigits: casas });

const lerAcao = db.prepare('SELECT quando FROM acoes WHERE guild_id = ? AND user_id = ? AND acao = ?');
const gravarAcao = db.prepare(`
  INSERT INTO acoes (guild_id, user_id, acao, quando) VALUES (?, ?, ?, ?)
  ON CONFLICT (guild_id, user_id, acao) DO UPDATE SET quando = excluded.quando
`);

function cobrarEspera(interaction, acao, duracao) {
  const anterior = lerAcao.get(interaction.guildId, interaction.user.id, acao)?.quando ?? 0;
  const restante = anterior + duracao - Date.now();
  if (restante > 0) throw aviso(`Essa ação estará disponível em **${formatDuration(restante)}**.`);
  gravarAcao.run(interaction.guildId, interaction.user.id, acao, Date.now());
}

const moeda = (interaction) => getGuildConfig(interaction.guildId)?.currency_name ?? 'moedas';
const dinheiro = (valor, interaction) => `**${Math.round(valor).toLocaleString('pt-BR')}** ${moeda(interaction)}`;
const saldoDe = (interaction, userId = interaction.user.id) =>
  getAccount(interaction.guildId, userId).balance;

function apostar(interaction, valor, ganhou, multiplicador = 2) {
  const saldo = saldoDe(interaction);
  if (valor > saldo) throw aviso(`Você só tem ${dinheiro(saldo, interaction)}.`);
  const delta = ganhou ? Math.round(valor * (multiplicador - 1)) : -valor;
  const conta = addBalance(interaction.guildId, interaction.user.id, delta);
  return { delta, saldo: conta.balance };
}

function lerPesos(texto) {
  const partes = texto
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const valores = partes.map((item) => Number(item.replace(',', '.')));
  if (
    valores.length < 2 ||
    valores.length > 20 ||
    valores.some((item) => Number.isFinite(item) === false || item <= 0)
  ) {
    throw aviso('Informe de 2 a 20 pesos positivos, separados por vírgula.');
  }
  return valores;
}

const APOSTA = opt.inteiro('valor', 'Quanto apostar', true, { min: 1, max: 1_000_000 });
const VALOR = (name, description) =>
  opt.numero(name, description, true, { min: 0.01, max: 1_000_000_000_000 });

export default familia({
  name: 'bolso',
  // As calculadoras promovidas são comandos independentes; não ficam duplicadas em /bolso.
  atalhos: [
    'orcamento',
    'parcelar',
    'meta-financeira',
    'reserva',
    'custo-hora',
    'taxa-poupanca',
    'ponto-equilibrio',
    'margem',
    'extrato',
  ],
  description: 'Reúne jogos de economia virtual, análises do servidor e cálculos financeiros.',
  cooldown: 2,
  dm: false,
  subs: [
    {
      name: 'orcamento',
      description: 'Divide uma renda entre despesas essenciais, objetivos e uso flexível.',
      options: [
        VALOR('renda', 'Renda disponível'),
        opt.numero('essenciais', 'Percentual para despesas essenciais; padrão 50', false, { min: 0, max: 100 }),
        opt.numero('objetivos', 'Percentual para metas e reservas; padrão 20', false, { min: 0, max: 100 }),
      ],
      run: ({ renda, essenciais, objetivos }) => {
        const pctEssenciais = essenciais ?? 50;
        const pctObjetivos = objetivos ?? 20;
        if (pctEssenciais + pctObjetivos > 100) {
          throw aviso('A soma dos percentuais não pode passar de 100%.');
        }
        const pctFlexivel = 100 - pctEssenciais - pctObjetivos;
        return [
          '## Distribuição do orçamento',
          `**Despesas essenciais (${formatar(pctEssenciais)}%):** ${formatar(renda * pctEssenciais / 100)}`,
          `**Metas e reservas (${formatar(pctObjetivos)}%):** ${formatar(renda * pctObjetivos / 100)}`,
          `**Uso flexível (${formatar(pctFlexivel)}%):** ${formatar(renda * pctFlexivel / 100)}`,
          '',
          '_Os valores usam a mesma unidade monetária informada na renda._',
        ].join('\n');
      },
    },
    {
      name: 'parcelar',
      description: 'Calcula o valor total e cada parcela com juros mensais compostos.',
      options: [
        VALOR('valor', 'Valor à vista'),
        opt.inteiro('parcelas', 'Quantidade de parcelas', true, { min: 1, max: 600 }),
        opt.numero('juros', 'Taxa mensal em porcentagem; padrão 0', false, { min: 0, max: 100 }),
      ],
      run: ({ valor, parcelas, juros }) => {
        const taxa = (juros ?? 0) / 100;
        const fator = (1 + taxa) ** parcelas;
        const parcela = taxa === 0 ? valor / parcelas : valor * taxa * fator / (fator - 1);
        const total = parcela * parcelas;
        return `## Parcelamento\n**${parcelas} parcelas de:** ${formatar(parcela)}\n**Total:** ${formatar(total)}\n**Acréscimo:** ${formatar(total - valor)}\n**Taxa mensal:** ${formatar(juros ?? 0)}%`;
      },
    },
    {
      name: 'meta-financeira',
      description: 'Calcula quanto guardar por mês para alcançar uma meta.',
      options: [
        VALOR('meta', 'Valor desejado'),
        opt.inteiro('meses', 'Prazo em meses', true, { min: 1, max: 1200 }),
        opt.numero('atual', 'Valor já acumulado; padrão 0', false, { min: 0, max: 1_000_000_000_000 }),
      ],
      run: ({ meta, meses, atual }) => {
        const acumulado = atual ?? 0;
        const restante = Math.max(0, meta - acumulado);
        return `## Meta financeira\n**Meta:** ${formatar(meta)}\n**Já acumulado:** ${formatar(acumulado)}\n**Falta:** ${formatar(restante)}\n**Valor mensal necessário:** ${formatar(restante / meses)} por ${meses} meses`;
      },
    },
    {
      name: 'reserva',
      description: 'Calcula uma reserva a partir das despesas mensais e do período desejado.',
      options: [
        VALOR('despesas', 'Despesas essenciais mensais'),
        opt.numero('meses', 'Quantidade de meses cobertos', true, { min: 0.1, max: 120 }),
        opt.numero('atual', 'Valor já reservado; padrão 0', false, { min: 0, max: 1_000_000_000_000 }),
      ],
      run: ({ despesas, meses, atual }) => {
        const alvo = despesas * meses;
        const acumulado = atual ?? 0;
        return `## Reserva planejada\n**Alvo:** ${formatar(alvo)}\n**Valor atual:** ${formatar(acumulado)}\n**Falta:** ${formatar(Math.max(0, alvo - acumulado))}\n**Cobertura desejada:** ${formatar(meses)} meses`;
      },
    },
    {
      name: 'custo-hora',
      description: 'Calcula o valor por hora necessário para atingir uma receita mensal.',
      options: [
        VALOR('receita', 'Receita mensal desejada'),
        opt.numero('horas', 'Horas faturáveis no mês', true, { min: 0.1, max: 744 }),
        opt.numero('custos', 'Custos mensais adicionais; padrão 0', false, { min: 0, max: 1_000_000_000_000 }),
      ],
      run: ({ receita, horas, custos }) => {
        const total = receita + (custos ?? 0);
        return `## Custo por hora\n**Receita e custos a cobrir:** ${formatar(total)}\n**Horas faturáveis:** ${formatar(horas)}\n**Valor mínimo por hora:** ${formatar(total / horas)}`;
      },
    },
    {
      name: 'taxa-poupanca',
      description: 'Calcula qual porcentagem da renda foi guardada.',
      options: [VALOR('renda', 'Renda do período'), VALOR('guardado', 'Valor guardado no período')],
      run: ({ renda, guardado }) => {
        const taxa = guardado / renda * 100;
        return `## Taxa de poupança\n**Renda:** ${formatar(renda)}\n**Valor guardado:** ${formatar(guardado)}\n**Taxa:** ${formatar(taxa)}%`;
      },
    },
    {
      name: 'ponto-equilibrio',
      description: 'Calcula quantas unidades cobrem custos fixos e variáveis.',
      options: [
        VALOR('custos-fixos', 'Custos fixos totais'),
        VALOR('preco', 'Preço por unidade'),
        opt.numero('custo-variavel', 'Custo variável por unidade', true, { min: 0, max: 1_000_000_000_000 }),
      ],
      run: ({ 'custos-fixos': custosFixos, preco, 'custo-variavel': custoVariavel }) => {
        const contribuicao = preco - custoVariavel;
        if (contribuicao <= 0) throw aviso('O preço precisa ser maior que o custo variável por unidade.');
        const unidades = Math.ceil(custosFixos / contribuicao);
        return `## Ponto de equilíbrio\n**Margem de contribuição:** ${formatar(contribuicao)} por unidade\n**Unidades necessárias:** ${unidades.toLocaleString('pt-BR')}\n**Receita aproximada:** ${formatar(unidades * preco)}`;
      },
    },
    {
      name: 'margem',
      description: 'Calcula lucro e margem a partir da receita e dos custos.',
      options: [VALOR('receita', 'Receita total'), VALOR('custos', 'Custos totais')],
      run: ({ receita, custos }) => {
        const lucro = receita - custos;
        const percentual = lucro / receita * 100;
        return `## Margem\n**Receita:** ${formatar(receita)}\n**Custos:** ${formatar(custos)}\n**Resultado:** ${formatar(lucro)}\n**Margem:** ${formatar(percentual)}%`;
      },
    },
    {
      name: 'extrato',
      description: 'Mostra carteira, banco, patrimônio e posição no servidor.',
      options: [opt.usuario('membro', 'Pessoa consultada; o padrão é você', false)],
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
                { name: 'Patrimônio', value: dinheiro(total, interaction), inline: true },
                { name: 'Posição', value: `#${posicao}`, inline: true },
                { name: 'Sequência diária', value: quantidade(conta.streak, 'dia'), inline: true },
              ),
          ],
        };
      },
    },
    {
      name: 'comparar-patrimonio',
      description: 'Compara o patrimônio de duas pessoas no servidor.',
      options: [
        opt.usuario('primeira', 'Primeira pessoa', true),
        opt.usuario('segunda', 'Segunda pessoa', true),
      ],
      run: ({ primeira, segunda }, interaction) => {
        if (primeira.id === segunda.id) throw aviso('Escolha duas pessoas diferentes.');
        const contaA = getAccount(interaction.guildId, primeira.id);
        const contaB = getAccount(interaction.guildId, segunda.id);
        const totalA = contaA.balance + contaA.bank;
        const totalB = contaB.balance + contaB.bank;
        const diferenca = Math.abs(totalA - totalB);
        const maior = totalA === totalB ? null : totalA > totalB ? primeira : segunda;
        return [
          `${primeira}: ${dinheiro(totalA, interaction)}`,
          `${segunda}: ${dinheiro(totalB, interaction)}`,
          maior ? `\n${maior} tem ${dinheiro(diferenca, interaction)} a mais.` : '\nOs patrimônios são iguais.',
        ].join('\n');
      },
    },
    {
      name: 'apostar-dado',
      description: 'Aposta nas moedas do servidor tentando acertar um dado.',
      options: [APOSTA, opt.inteiro('numero', 'Número de 1 a 6', true, { min: 1, max: 6 })],
      run: ({ valor, numero }, interaction) => {
        const saiu = sortear(6) + 1;
        const { delta, saldo } = apostar(interaction, valor, saiu === numero, 5);
        return `O dado caiu em **${saiu}**.\n\n${delta > 0 ? `Ganho: ${dinheiro(delta, interaction)}` : `Perda: ${dinheiro(-delta, interaction)}`}\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'caca-niqueis',
      description: 'Aposta nas moedas do servidor em uma rodada de caça-níqueis.',
      options: [APOSTA],
      run: ({ valor }, interaction) => {
        const simbolos = ['🍒', '🍋', '🔔', '⭐', '💎'];
        const giro = [escolher(simbolos), escolher(simbolos), escolher(simbolos)];
        const distintos = new Set(giro).size;
        const multiplicador = distintos === 1 ? 10 : distintos === 2 ? 2 : 0;
        const { delta, saldo } = apostar(interaction, valor, multiplicador > 0, multiplicador);
        return `${giro.join(' | ')}\n\n${
          multiplicador === 10 ? `Prêmio máximo: ${dinheiro(delta, interaction)}` :
          multiplicador === 2 ? `Dois símbolos iguais: +${dinheiro(delta, interaction)}` :
          `Perda: ${dinheiro(-delta, interaction)}`
        }\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'roleta',
      description: 'Aposta nas moedas do servidor escolhendo uma cor da roleta.',
      options: [
        APOSTA,
        { kind: 'string', name: 'cor', description: 'Cor escolhida', required: true,
          choices: [
            { name: 'Vermelho (2×)', value: 'vermelho' },
            { name: 'Preto (2×)', value: 'preto' },
            { name: 'Verde (14×)', value: 'verde' },
          ] },
      ],
      run: ({ valor, cor }, interaction) => {
        const numero = sortear(37);
        const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        const saiu = numero === 0 ? 'verde' : vermelhos.includes(numero) ? 'vermelho' : 'preto';
        const { delta, saldo } = apostar(interaction, valor, saiu === cor, cor === 'verde' ? 14 : 2);
        return `A roleta caiu em **${numero} (${saiu})**.\n\n${delta > 0 ? `Ganho: ${dinheiro(delta, interaction)}` : `Perda: ${dinheiro(-delta, interaction)}`}\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'alto-baixo',
      description: 'Aposta se a próxima carta será maior ou menor.',
      options: [
        APOSTA,
        { kind: 'string', name: 'palpite', description: 'Direção escolhida', required: true,
          choices: [{ name: 'Maior', value: 'maior' }, { name: 'Menor', value: 'menor' }] },
      ],
      run: ({ valor, palpite }, interaction) => {
        const primeira = sortear(13) + 1;
        const segunda = sortear(13) + 1;
        const nome = (n) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[n] ?? String(n);
        if (primeira === segunda) return `Saiu **${nome(primeira)}** e **${nome(segunda)}**. A aposta foi devolvida.`;
        const acertou = (segunda > primeira) === (palpite === 'maior');
        const { delta, saldo } = apostar(interaction, valor, acertou);
        return `**${nome(primeira)} → ${nome(segunda)}**\n\n${delta > 0 ? `Ganho: ${dinheiro(delta, interaction)}` : `Perda: ${dinheiro(-delta, interaction)}`}\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'loteria',
      description: 'Aposta nas moedas do servidor tentando acertar um número de 1 a 100.',
      options: [APOSTA, opt.inteiro('numero', 'Número de 1 a 100', true, { min: 1, max: 100 })],
      run: ({ valor, numero }, interaction) => {
        const sorteado = sortear(100) + 1;
        const { delta, saldo } = apostar(interaction, valor, sorteado === numero, 50);
        return `O número sorteado foi **${sorteado}**.\n\n${delta > 0 ? `Ganho: ${dinheiro(delta, interaction)}` : `Perda: ${dinheiro(-delta, interaction)}`}\nSaldo: ${dinheiro(saldo, interaction)}`;
      },
    },
    {
      name: 'mercado',
      description: 'Simula uma rodada de mercado com as moedas do servidor.',
      options: [opt.inteiro('valor', 'Quantidade aplicada', true, { min: 100, max: 1_000_000 })],
      run: ({ valor }, interaction) => {
        cobrarEspera(interaction, 'mercado', 30 * 60_000);
        const saldo = saldoDe(interaction);
        if (valor > saldo) throw aviso(`Você só tem ${dinheiro(saldo, interaction)}.`);
        const variacao = entre(-40, 60);
        const resultado = Math.round(valor * variacao / 100);
        const conta = addBalance(interaction.guildId, interaction.user.id, resultado);
        return `## Rodada de mercado\n**Valor aplicado:** ${dinheiro(valor, interaction)}\n**Variação:** ${variacao > 0 ? '+' : ''}${variacao}%\n**Resultado:** ${resultado >= 0 ? '+' : '−'}${dinheiro(Math.abs(resultado), interaction)}\n**Saldo:** ${dinheiro(conta.balance, interaction)}`;
      },
    },
    {
      name: 'rachar',
      description: 'Divide um valor igualmente entre várias pessoas.',
      options: [
        opt.inteiro('valor', 'Valor total', true, { min: 2, max: 1_000_000 }),
        opt.inteiro('pessoas', 'Quantidade de pessoas', true, { min: 2, max: 50 }),
      ],
      run: ({ valor, pessoas }, interaction) => {
        const cada = Math.floor(valor / pessoas);
        const resto = valor % pessoas;
        return `Dividindo ${dinheiro(valor, interaction)} entre **${pessoas}** pessoas:\n**Cada pessoa:** ${cada.toLocaleString('pt-BR')}\n**Resto:** ${resto.toLocaleString('pt-BR')}`;
      },
    },
    {
      name: 'distribuicao',
      description: 'Mostra como o patrimônio está distribuído entre as contas do servidor.',
      run: (_, interaction) => {
        const totais = db
          .prepare('SELECT balance + bank AS total FROM economy WHERE guild_id = ?')
          .all(interaction.guildId)
          .map((linha) => linha.total);
        const faixas = [
          ['Sem patrimônio', (valor) => valor === 0],
          ['Até 1.000', (valor) => valor > 0 && valor <= 1_000],
          ['De 1.001 a 10.000', (valor) => valor > 1_000 && valor <= 10_000],
          ['Acima de 10.000', (valor) => valor > 10_000],
        ];
        const descricao = totais.length
          ? faixas.map(([nome, teste]) => `**${nome}:** ${quantidade(totais.filter(teste).length, 'conta')}`).join('\n')
          : 'Ainda não há contas registradas.';
        return { embeds: [embed.base(colors.economy).setTitle('Distribuição patrimonial').setDescription(descricao)] };
      },
    },
    {
      name: 'mediana-servidor',
      description: 'Calcula a mediana e a média dos patrimônios do servidor.',
      run: (_, interaction) => {
        const valores = db
          .prepare('SELECT balance + bank AS total FROM economy WHERE guild_id = ? ORDER BY total')
          .all(interaction.guildId)
          .map((linha) => linha.total);
        if (valores.length === 0) throw aviso('Ainda não há contas registradas no servidor.');
        const meio = Math.floor(valores.length / 2);
        const mediana = valores.length % 2 ? valores[meio] : (valores[meio - 1] + valores[meio]) / 2;
        const media = valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
        return `## Patrimônio do servidor\n**Contas:** ${valores.length.toLocaleString('pt-BR')}\n**Mediana:** ${dinheiro(mediana, interaction)}\n**Média:** ${dinheiro(media, interaction)}`;
      },
    },
    {
      name: 'total-servidor',
      description: 'Mostra o total de moedas em circulação no servidor.',
      run: (_, interaction) => {
        const dados = db
          .prepare('SELECT COUNT(*) AS contas, SUM(balance + bank) AS total, MAX(balance + bank) AS maior FROM economy WHERE guild_id = ?')
          .get(interaction.guildId);
        const total = dados.total ?? 0;
        return `**Contas:** ${(dados.contas ?? 0).toLocaleString('pt-BR')}\n**Total em circulação:** ${dinheiro(total, interaction)}\n**Maior patrimônio:** ${dinheiro(dados.maior ?? 0, interaction)}\n**Média por conta:** ${dinheiro(dados.contas ? total / dados.contas : 0, interaction)}`;
      },
    },
    {
      name: 'zerar-minha-conta',
      description: 'Zera a sua carteira e o seu banco no servidor.',
      run: (_, interaction) => {
        const conta = getAccount(interaction.guildId, interaction.user.id);
        const total = conta.balance + conta.bank;
        if (total === 0) throw aviso('Sua conta já está zerada.');
        updateAccount(interaction.guildId, interaction.user.id, { balance: 0, bank: 0 });
        return `Sua conta foi zerada. O patrimônio removido era ${dinheiro(total, interaction)}.`;
      },
    },
    {
      name: 'preco-venda',
      description: 'Calcula um preço de venda a partir do custo e da margem desejada.',
      options: [
        VALOR('custo', 'Custo total por unidade'),
        opt.numero('margem', 'Margem desejada em porcentagem', true, { min: 0.01, max: 99.99 }),
      ],
      run: ({ custo, margem }) => {
        const preco = custo / (1 - margem / 100);
        return `## Preço de venda\n**Custo:** ${formatar(custo)}\n**Margem desejada:** ${formatar(margem)}%\n**Preço calculado:** ${formatar(preco)}\n**Resultado por unidade:** ${formatar(preco - custo)}`;
      },
    },
    {
      name: 'comissao',
      description: 'Calcula uma comissão percentual com parcela fixa opcional.',
      options: [
        VALOR('vendas', 'Valor total das vendas'),
        opt.numero('taxa', 'Percentual de comissão', true, { min: 0, max: 100 }),
        opt.numero('fixo', 'Parcela fixa adicional; padrão 0', false, { min: 0, max: 1_000_000_000_000 }),
      ],
      run: ({ vendas, taxa, fixo }) => {
        const variavel = vendas * taxa / 100;
        return `## Comissão\n**Parcela variável:** ${formatar(variavel)}\n**Parcela fixa:** ${formatar(fixo ?? 0)}\n**Total:** ${formatar(variavel + (fixo ?? 0))}`;
      },
    },
    {
      name: 'rateio',
      description: 'Divide um valor proporcionalmente entre pesos informados.',
      options: [
        VALOR('total', 'Valor total'),
        opt.texto('pesos', 'Pesos separados por vírgula', true, { max: 300 }),
      ],
      run: ({ total, pesos }) => {
        const valores = lerPesos(pesos);
        const soma = valores.reduce((acumulado, valor) => acumulado + valor, 0);
        const partes = valores.map((peso) => ({ peso, valor: total * peso / soma }));
        return `## Rateio proporcional\n${partes.map((parte, indice) => `**Parte ${indice + 1}** — peso ${formatar(parte.peso)}: ${formatar(parte.valor)}`).join('\n')}\n\n**Total:** ${formatar(total)}`;
      },
    },
  ],
});
