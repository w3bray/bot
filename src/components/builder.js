import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { colors } from '../config.js';
import { embed, replyError } from '../lib/embeds.js';
import { logger } from '../lib/logger.js';
import { quantidade } from '../lib/portugues.js';
import { isOwner } from '../lib/owner.js';
import {
  buildServer,
  EXTRAS,
  exigeDono,
  planSummary,
  selectedCategories,
  templatesVisiveis,
  TEMPLATES,
} from '../services/templates.js';

// Os extras viajam dentro do custom_id, que é limitado a 100 caracteres e usa
// ":" como separador. Juntamos com "." e reservamos "nada" para a lista vazia,
// porque um argumento vazio viraria string vazia no split e confundiria o parse.
const SEM_EXTRAS = 'nada';

const encodeExtras = (extras) => (extras.length > 0 ? extras.join('.') : SEM_EXTRAS);
const decodeExtras = (raw) => (!raw || raw === SEM_EXTRAS ? [] : raw.split('.'));

/**
 * Menu inicial: escolher o modelo.
 *
 * `dono` decide se os modelos restritos entram na lista. Não é a trava — a
 * trava é o `permitido()` abaixo, checado a cada clique — mas evita mostrar
 * para os outros um modelo que eles não conseguiriam usar.
 */
export function renderPicker(dono = false) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('builder:modelo')
    .setPlaceholder('Escolha o modelo do servidor…')
    .addOptions(
      templatesVisiveis(dono).map(([key, template]) =>
        new StringSelectMenuOptionBuilder()
          .setValue(key)
          .setLabel(template.label)
          .setDescription(template.short)
          .setEmoji(template.emoji),
      ),
    );

  return {
    embeds: [
      embed
        .base(colors.primary)
        .setTitle('🏗️ Construtor de servidor')
        .setDescription(
          [
            'Escolha um modelo abaixo. Você verá **exatamente o que será criado** antes de confirmar.',
            '',
            '> Nada é apagado: o construtor apenas **adiciona** categorias, canais e cargos ao que já existe.',
          ].join('\n'),
        ),
    ],
    components: [new ActionRowBuilder().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  };
}

/** Painel completo: prévia do que será criado + extras + confirmar/cancelar. */
export function renderPanel(templateKey, extras) {
  const template = TEMPLATES[templateKey];
  const plan = planSummary(template, extras);

  const tree = selectedCategories(template, extras)
    .map((category) => {
      // Modelos estilizados já trazem o emoji no nome do canal; repetir um
      // prefixo ali só polui a prévia.
      const prefix = /^[a-z]/i.test(category.channels[0]?.name ?? '')
        ? (category.voice ? '🔊 ' : category.staff ? '🔒 ' : '# ')
        : '';
      const channels = category.channels
        .map((channel) => `${prefix}${channel.name}`)
        .join(' · ');
      return `**${category.name}**\n${channels}`;
    })
    .join('\n\n');

  const roles = extras.includes('cargos')
    ? template.roles.map((role) => `\`${role.name}\``).join(' ')
    : '_nenhum_';

  const extrasMenu = new StringSelectMenuBuilder()
    .setCustomId(`builder:extras:${templateKey}`)
    .setPlaceholder('O que incluir…')
    .setMinValues(0)
    .setMaxValues(Object.keys(EXTRAS).length)
    .addOptions(
      Object.entries(EXTRAS).map(([key, extra]) =>
        new StringSelectMenuOptionBuilder()
          .setValue(key)
          .setLabel(extra.label)
          .setEmoji(extra.emoji)
          .setDefault(extras.includes(key)),
      ),
    );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`builder:criar:${templateKey}:${encodeExtras(extras)}`)
      .setLabel(`Construir (${plan.channels} canais)`)
      .setEmoji('🏗️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('builder:voltar')
      .setLabel('Trocar modelo')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('builder:cancelar')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Danger),
  );

  return {
    embeds: [
      embed
        .base(template.color)
        .setTitle(`${template.emoji} ${template.label}`)
        .setDescription(tree)
        .addFields(
          { name: 'Cargos', value: roles },
          {
            name: 'Total',
            value: `**${plan.categories}** categorias · **${plan.channels}** canais · **${plan.roles}** cargos`,
          },
        )
        .setFooter({ text: 'Nada será apagado. O construtor só adiciona.' }),
    ],
    components: [new ActionRowBuilder().addComponents(extrasMenu), buttons],
    flags: MessageFlags.Ephemeral,
  };
}

/**
 * Todo caminho que toca um modelo passa por aqui.
 *
 * Um custom_id é texto que sai do bot e volta pelo cliente — dá para forjar.
 * Por isso o modelo restrito é rechecado em cada clique, e não só na hora de
 * montar o menu. Fora do modelo restrito, a resposta é a mesma de um modelo
 * inexistente: quem não é dono não descobre nem que ele existe.
 */
function permitido(interaction, key) {
  if (!TEMPLATES[key]) return false;
  return !exigeDono(key) || isOwner(interaction.user.id);
}

export default {
  id: 'builder',

  async execute(interaction, { action, args }) {
    if (action === 'cancelar') {
      return interaction.update({
        embeds: [embed.info('Construção cancelada. Nada foi criado.')],
        components: [],
      });
    }

    if (action === 'voltar') {
      const picker = renderPicker(isOwner(interaction.user.id));
      return interaction.update({ embeds: picker.embeds, components: picker.components });
    }

    if (action === 'modelo') {
      const key = interaction.values[0];
      if (!permitido(interaction, key)) return replyError(interaction, 'Esse modelo não existe mais.');
      // Padrão generoso: tudo marcado, e quem não quiser desmarca no menu.
      const panel = renderPanel(key, Object.keys(EXTRAS));
      return interaction.update({ embeds: panel.embeds, components: panel.components });
    }

    if (action === 'extras') {
      const [key] = args;
      if (!permitido(interaction, key)) return replyError(interaction, 'Esse modelo não existe mais.');
      const panel = renderPanel(key, interaction.values);
      return interaction.update({ embeds: panel.embeds, components: panel.components });
    }

    if (action === 'criar') {
      if (!permitido(interaction, args[0])) {
        return replyError(interaction, 'Esse modelo não existe mais.');
      }
      return create(interaction, args);
    }
  },
};

async function create(interaction, [key, rawExtras]) {
  const template = TEMPLATES[key];
  if (!template) return replyError(interaction, 'Esse modelo não existe mais.');

  const extras = decodeExtras(rawExtras);
  const me = interaction.guild.members.me;

  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return replyError(
      interaction,
      'Preciso da permissão **Gerenciar Canais** para construir. Dê a permissão ao meu cargo e tente de novo.',
    );
  }

  if (extras.includes('cargos') && !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return replyError(
      interaction,
      'Preciso da permissão **Gerenciar Cargos** para criar os cargos — ou desmarque essa opção no menu.',
    );
  }

  const plan = planSummary(template, extras);

  // A construção leva vários segundos: o Discord dá 3s para responder, então
  // trocamos a mensagem por um aviso de progresso antes de começar.
  await interaction.update({
    embeds: [
      embed.info(
        `Construindo **${template.label}**… ${plan.channels} canais e ${plan.roles} cargos. Isso leva alguns segundos.`,
      ),
    ],
    components: [],
  });

  const { created, failures } = await buildServer(interaction.guild, template, extras);

  if (failures.length > 0) {
    logger.warn(`/construir: ${quantidade(failures.length, 'falha')} em ${interaction.guild.id}`);
  }

  const done = embed
    .base(template.color)
    .setTitle(`${template.emoji} Servidor construído`)
    .setDescription(
      `Criei **${created.categories}** categorias, **${created.channels}** canais e **${created.roles}** cargos.`,
    );

  if (failures.length > 0) {
    done.addFields({
      name: `⚠️ ${quantidade(failures.length, 'item não criado', 'itens não criados')}`,
      value: failures.slice(0, 8).join('\n').slice(0, 1024),
    });
    done.setFooter({ text: 'O motivo mais comum é o cargo do bot estar abaixo na lista de cargos.' });
  }

  await interaction.editReply({ embeds: [done], components: [] });
}
