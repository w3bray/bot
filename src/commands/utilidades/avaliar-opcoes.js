import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';

function lista(texto) {
  return texto
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function numeros(texto) {
  return lista(texto).map((item) => Number(item.replace(',', '.')));
}

const formatar = (valor) =>
  Number(valor.toFixed(2)).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('avaliar-opcoes')
    .setDescription('Compara duas opções com critérios, notas e pesos definidos por você.')
    .addStringOption((option) =>
      option
        .setName('criterios')
        .setDescription('Critérios separados por vírgula')
        .setRequired(true)
        .setMaxLength(500),
    )
    .addStringOption((option) =>
      option
        .setName('primeira')
        .setDescription('Nome da primeira opção')
        .setRequired(true)
        .setMaxLength(100),
    )
    .addStringOption((option) =>
      option
        .setName('notas-primeira')
        .setDescription('Notas de 0 a 10, na ordem dos critérios')
        .setRequired(true)
        .setMaxLength(200),
    )
    .addStringOption((option) =>
      option
        .setName('segunda')
        .setDescription('Nome da segunda opção')
        .setRequired(true)
        .setMaxLength(100),
    )
    .addStringOption((option) =>
      option
        .setName('notas-segunda')
        .setDescription('Notas de 0 a 10, na ordem dos critérios')
        .setRequired(true)
        .setMaxLength(200),
    )
    .addStringOption((option) =>
      option
        .setName('pesos')
        .setDescription('Pesos positivos na mesma ordem; o padrão é 1 para todos')
        .setMaxLength(200),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async execute(interaction) {
    const criterios = lista(interaction.options.getString('criterios'));
    const primeira = interaction.options.getString('primeira').trim();
    const segunda = interaction.options.getString('segunda').trim();
    const notasPrimeira = numeros(interaction.options.getString('notas-primeira'));
    const notasSegunda = numeros(interaction.options.getString('notas-segunda'));
    const pesosInformados = interaction.options.getString('pesos');
    const pesos = pesosInformados ? numeros(pesosInformados) : criterios.map(() => 1);

    if (criterios.length < 2 || criterios.length > 10) {
      return replyError(interaction, 'Informe de 2 a 10 critérios.');
    }

    const conjuntos = [notasPrimeira, notasSegunda, pesos];
    if (conjuntos.some((valores) => valores.length !== criterios.length)) {
      return replyError(
        interaction,
        `Cada lista precisa ter exatamente ${criterios.length} valores, um para cada critério.`,
      );
    }

    if (
      [...notasPrimeira, ...notasSegunda].some(
        (nota) => Number.isFinite(nota) === false || nota < 0 || nota > 10,
      )
    ) {
      return replyError(interaction, 'As notas precisam ser números entre 0 e 10.');
    }

    if (pesos.some((peso) => Number.isFinite(peso) === false || peso <= 0)) {
      return replyError(interaction, 'Os pesos precisam ser números maiores que zero.');
    }

    const pesoTotal = pesos.reduce((soma, peso) => soma + peso, 0);
    const pontuar = (notas) =>
      notas.reduce((soma, nota, indice) => soma + nota * pesos[indice], 0) / pesoTotal;
    const totalPrimeira = pontuar(notasPrimeira);
    const totalSegunda = pontuar(notasSegunda);
    const vencedor =
      totalPrimeira === totalSegunda
        ? null
        : totalPrimeira > totalSegunda
          ? primeira
          : segunda;

    const linhas = criterios.map(
      (criterio, indice) =>
        `**${criterio}:** ${formatar(notasPrimeira[indice])} × ${formatar(pesos[indice])} | ` +
        `${formatar(notasSegunda[indice])} × ${formatar(pesos[indice])}`,
    );

    await interaction.reply({
      embeds: [
        embed
          .base(colors.primary)
          .setTitle('Comparação ponderada')
          .setDescription(
            [
              `**${primeira}:** ${formatar(totalPrimeira)}/10`,
              `**${segunda}:** ${formatar(totalSegunda)}/10`,
              '',
              vencedor ? `Maior pontuação: **${vencedor}**.` : '**Empate na pontuação final.**',
            ].join('\n'),
          )
          .addFields({ name: 'Notas × pesos', value: linhas.join('\n') })
          .setFooter({ text: 'A comparação usa somente os critérios, notas e pesos informados.' }),
      ],
    });
  },
};
