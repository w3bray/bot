import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../../lib/db.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatMoney, getAccount } from '../../services/economy.js';
import { ITEMS, buyItem, getInventory } from '../../services/shop.js';

export default {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Loja de distintivos para o seu perfil.')
    .addSubcommand((sub) => sub.setName('ver').setDescription('Mostra os itens à venda.'))
    .addSubcommand((sub) =>
      sub
        .setName('comprar')
        .setDescription('Compra um item da loja.')
        .addStringOption((option) =>
          option
            .setName('item')
            .setDescription('Qual item?')
            .setRequired(true)
            .addChoices(
              ...ITEMS.map((item) => ({
                name: `${item.emoji} ${item.name} — ${item.price.toLocaleString('pt-BR')}`,
                value: item.id,
              })),
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('inventario')
        .setDescription('Mostra os itens que você já comprou.')
        .addUserOption((option) =>
          option.setName('usuario').setDescription('De quem? (padrão: você)'),
        ),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'ver') return showShop(interaction);
    if (subcommand === 'comprar') return buy(interaction);
    return showInventory(interaction);
  },
};

async function showShop(interaction) {
  const settings = getGuildConfig(interaction.guildId);
  const account = getAccount(interaction.guildId, interaction.user.id);
  const owned = new Set(
    getInventory(interaction.guildId, interaction.user.id).map((row) => row.item_id),
  );

  await interaction.reply({
    embeds: [
      embed
        .base(colors.economy)
        .setTitle('🛒 Loja de distintivos')
        .setDescription(
          ITEMS.map(
            (item) =>
              `${item.emoji} **${item.name}** — ${formatMoney(item.price, settings.currency_name)}${owned.has(item.id) ? ' ✅' : ''}\n> ${item.description}`,
          ).join('\n\n'),
        )
        .setFooter({
          text: `Seu saldo: ${formatMoney(account.balance, settings.currency_name)} · compre com /loja comprar`,
        }),
    ],
  });
}

async function buy(interaction) {
  const itemId = interaction.options.getString('item');
  const settings = getGuildConfig(interaction.guildId);

  const result = buyItem(interaction.guildId, interaction.user.id, itemId);

  if (!result.ok) {
    return replyError(
      interaction,
      result.missing
        ? `Saldo insuficiente — faltam **${formatMoney(result.missing, settings.currency_name)}**.`
        : `Não deu: ${result.reason}.`,
    );
  }

  await interaction.reply({
    embeds: [
      embed
        .success(
          `Você comprou ${result.item.emoji} **${result.item.name}** por ${formatMoney(result.item.price, settings.currency_name)}.\nO distintivo já aparece no seu \`/perfil\`.`,
          '🛒 Compra concluída',
        )
        .addFields({
          name: 'Saldo restante',
          value: formatMoney(result.remaining, settings.currency_name),
          inline: true,
        }),
    ],
  });
}

async function showInventory(interaction) {
  const user = interaction.options.getUser('usuario') ?? interaction.user;
  const items = getInventory(interaction.guildId, user.id);

  if (items.length === 0) {
    return interaction.reply({
      embeds: [
        embed.info(
          user.id === interaction.user.id
            ? 'Seu inventário está vazio. Veja a loja com `/loja ver`.'
            : `**${user.tag}** ainda não comprou nada.`,
        ),
      ],
    });
  }

  const total = items.reduce((sum, row) => sum + row.item.price, 0);
  const settings = getGuildConfig(interaction.guildId);

  await interaction.reply({
    embeds: [
      embed
        .base(colors.economy)
        .setTitle(`🎒 Inventário de ${user.tag}`)
        .setDescription(
          items.map((row) => `${row.item.emoji} **${row.item.name}**`).join('\n'),
        )
        .setFooter({
          text: `${items.length} item(ns) · investido: ${formatMoney(total, settings.currency_name)}`,
        }),
    ],
  });
}
