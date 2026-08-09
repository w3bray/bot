import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { isOwner } from '../../lib/owner.js';

const CATEGORIES = {
  moderacao: { label: '🛡️ Moderação', order: 1 },
  automod: { label: '🤖 AutoMod', order: 2 },
  configuracao: { label: '⚙️ Configuração', order: 3 },
  servidor: { label: '🏗️ Servidor', order: 4 },
  texto: { label: '✍️ Texto e código', order: 5 },
  utilidades: { label: '🔧 Utilidades', order: 6 },
  social: { label: '💞 Social', order: 7 },
  niveis: { label: '📈 Níveis', order: 8 },
  economia: { label: '🪙 Economia', order: 9 },
  jogos: { label: '🎮 Jogos', order: 10 },
  diversao: { label: '🎲 Diversão', order: 11 },
  sorteios: { label: '🎉 Sorteios', order: 12 },
  tickets: { label: '🎫 Tickets', order: 13 },
  ia: { label: '🧠 Inteligência Artificial', order: 14 },
  dono: { label: '👑 Dono do bot', order: 15 },
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

    const owner = isOwner(interaction.user.id);
    const grouped = new Map();
    for (const command of client.commands.values()) {
      // Comandos de dono só aparecem para quem pode usá-los.
      if (command.ownerOnly && !owner) continue;
      const category = command.category ?? 'utilidades';
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(command);
    }

    const visiveis = [...grouped.values()].reduce((sum, list) => sum + list.length, 0);
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
              `Ao todo são **${visiveis}** comandos.`,
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
    // Um campo de embed aceita 1024 caracteres. Com 25 subcomandos descritos a
    // lista passa disso e o Discord recusa a mensagem inteira, então quebramos
    // em quantos campos forem necessários.
    const linhas = subcommands.map((sub) => `\`/${json.name} ${sub.name}\` — ${sub.description}`);
    let parte = [];
    let tamanho = 0;
    let indice = 0;

    const despejar = () => {
      if (parte.length === 0) return;
      indice += 1;
      detail.addFields({
        name: indice === 1 ? `Subcomandos (${subcommands.length})` : '​',
        value: parte.join('\n'),
      });
      parte = [];
      tamanho = 0;
    };

    for (const linha of linhas) {
      if (tamanho + linha.length + 1 > 1024) despejar();
      parte.push(linha);
      tamanho += linha.length + 1;
    }
    despejar();
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
