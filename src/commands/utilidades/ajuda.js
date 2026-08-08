import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';

const CATEGORIES = {
  moderacao: { label: '🛡️ Moderação', order: 1 },
  automod: { label: '🤖 AutoMod', order: 2 },
  configuracao: { label: '⚙️ Configuração', order: 3 },
  utilidades: { label: '🔧 Utilidades', order: 4 },
  social: { label: '💞 Social', order: 5 },
  niveis: { label: '📈 Níveis', order: 6 },
  economia: { label: '🪙 Economia', order: 7 },
  jogos: { label: '🎮 Jogos', order: 8 },
  diversao: { label: '🎲 Diversão', order: 9 },
  sorteios: { label: '🎉 Sorteios', order: 10 },
  tickets: { label: '🎫 Tickets', order: 11 },
  ia: { label: '🧠 Inteligência Artificial', order: 12 },
};

export default {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Lista os comandos disponíveis.')
    .addStringOption((option) =>
      option
        .setName('comando')
        .setDescription('Ver detalhes de um comando específico')
        .setAutocomplete(true),
    )
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = [...client.commands.keys()]
      .filter((name) => name.includes(focused))
      .slice(0, 25)
      .map((name) => ({ name: `/${name}`, value: name }));

    await interaction.respond(choices);
  },

  async execute(interaction, client) {
    const requested = interaction.options.getString('comando');
    if (requested) return showCommand(interaction, client, requested);

    const grouped = new Map();
    for (const command of client.commands.values()) {
      const category = command.category ?? 'utilidades';
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(command);
    }

    const fields = [...grouped.entries()]
      .sort((a, b) => (CATEGORIES[a[0]]?.order ?? 99) - (CATEGORIES[b[0]]?.order ?? 99))
      .map(([category, commands]) => ({
        name: `${CATEGORIES[category]?.label ?? category} (${commands.length})`,
        value: commands
          .map((command) => `\`/${command.data.name}\``)
          .sort()
          .join(' '),
      }));

    await interaction.reply({
      embeds: [
        embed
          .base(colors.primary)
          .setTitle(`Comandos de ${client.user.username}`)
          .setDescription(
            [
              `Ao todo são **${client.commands.size}** comandos.`,
              'Use `/ajuda comando:<nome>` para ver os detalhes de um deles.',
            ].join('\n'),
          )
          .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
          .addFields(fields)
          .setFooter({ text: 'Alguns comandos exigem permissões específicas.' }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

async function showCommand(interaction, client, name) {
  const command = client.commands.get(name);
  if (!command) return replyError(interaction, `O comando \`/${name}\` não existe.`);

  const json = command.data.toJSON();
  const detail = embed
    .base(colors.primary)
    .setTitle(`/${json.name}`)
    .setDescription(json.description)
    .addFields({
      name: 'Categoria',
      value: CATEGORIES[command.category]?.label ?? command.category ?? '—',
      inline: true,
    });

  if (command.cooldown) {
    detail.addFields({ name: 'Tempo de espera', value: `${command.cooldown}s`, inline: true });
  }

  const subcommands = (json.options ?? []).filter((option) => option.type === 1);
  const groups = (json.options ?? []).filter((option) => option.type === 2);
  const plainOptions = (json.options ?? []).filter((option) => option.type > 2);

  if (subcommands.length > 0) {
    detail.addFields({
      name: 'Subcomandos',
      value: subcommands
        .map((sub) => `\`/${json.name} ${sub.name}\` — ${sub.description}`)
        .join('\n'),
    });
  }

  for (const group of groups) {
    detail.addFields({
      name: `Grupo: ${group.name}`,
      value: (group.options ?? [])
        .map((sub) => `\`/${json.name} ${group.name} ${sub.name}\` — ${sub.description}`)
        .join('\n'),
    });
  }

  if (plainOptions.length > 0) {
    detail.addFields({
      name: 'Opções',
      value: plainOptions
        .map(
          (option) =>
            `\`${option.name}\`${option.required ? ' *(obrigatório)*' : ''} — ${option.description}`,
        )
        .join('\n'),
    });
  }

  await interaction.reply({ embeds: [detail], flags: MessageFlags.Ephemeral });
}
