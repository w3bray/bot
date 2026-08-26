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
  alvosDaLimpeza,
  buildServer,
  EXTRAS,
  EXTRAS_PADRAO,
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
            '> ⚠️ O construtor começa **apagando** os canais e cargos que já existem. Dá para',
            '> desmarcar isso no painel seguinte, e nada acontece sem você confirmar duas vezes.',
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

  const limpando = extras.includes('limpar');

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      // Com limpeza ligada o botão não constrói: leva para a tela de
      // confirmação, que é onde o estrago fica escrito por extenso.
      .setCustomId(`builder:${limpando ? 'confirmar' : 'criar'}:${templateKey}:${encodeExtras(extras)}`)
      .setLabel(limpando ? `Apagar e montar (${plan.channels} canais)` : `Construir (${plan.channels} canais)`)
      .setEmoji(limpando ? '🧨' : '🏗️')
      .setStyle(limpando ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('builder:voltar')
      .setLabel('Trocar modelo')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('builder:cancelar')
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    embeds: [
      embed
        .base(limpando ? colors.danger : template.color)
        .setTitle(`${template.emoji} ${template.label}`)
        .setDescription(tree)
        .addFields(
          { name: 'Cargos', value: roles },
          {
            name: 'Total',
            value: `**${plan.categories}** categorias · **${plan.channels}** canais · **${plan.roles}** cargos`,
          },
        )
        .setFooter({
          text: limpando
            ? 'Os canais e cargos atuais serão apagados antes de montar.'
            : 'Nada será apagado. O construtor só adiciona ao que já existe.',
        }),
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
      const panel = renderPanel(key, EXTRAS_PADRAO);
      return interaction.update({ embeds: panel.embeds, components: panel.components });
    }

    if (action === 'extras' || action === 'painel') {
      const [key, rawExtras] = args;
      if (!permitido(interaction, key)) return replyError(interaction, 'Esse modelo não existe mais.');
      // 'extras' vem do menu e traz a seleção nova; 'painel' é o botão Voltar da
      // confirmação, que devolve os mesmos extras pelo custom_id.
      const escolhidos = action === 'extras' ? interaction.values : decodeExtras(rawExtras);
      const panel = renderPanel(key, escolhidos);
      return interaction.update({ embeds: panel.embeds, components: panel.components });
    }

    if (action === 'confirmar') {
      if (!permitido(interaction, args[0])) {
        return replyError(interaction, 'Esse modelo não existe mais.');
      }
      const tela = renderConfirmacao(interaction, args);
      return interaction.update({ embeds: tela.embeds, components: tela.components });
    }

    if (action === 'criar') {
      if (!permitido(interaction, args[0])) {
        return replyError(interaction, 'Esse modelo não existe mais.');
      }
      return create(interaction, args);
    }
  },
};

/**
 * A tela entre o clique e o estrago.
 *
 * Mostra os números reais do servidor — não uma frase genérica — porque
 * "36 canais e 12 cargos serão apagados" faz alguém parar, e "isso é
 * irreversível" não faz.
 */
function renderConfirmacao(interaction, [key, rawExtras]) {
  const template = TEMPLATES[key];
  const extras = decodeExtras(rawExtras);
  const plan = planSummary(template, extras);
  const alvos = alvosDaLimpeza(interaction.guild);

  const protegidos = [...interaction.guild.channels.cache.values()].length - alvos.canais.length;

  return {
    embeds: [
      embed
        .base(colors.danger)
        .setTitle('🧨 Confirma apagar o servidor inteiro?')
        .setDescription(
          [
            `Vou apagar **${quantidade(alvos.canais.length, 'canal', 'canais')}** e ` +
              `**${quantidade(alvos.cargos.length, 'cargo')}** deste servidor, e montar ` +
              `**${template.label}** no lugar.`,
            '',
            '**Todo o histórico de mensagens desses canais some para sempre.** O Discord não',
            'guarda cópia, não existe lixeira e nem você nem eu conseguimos trazer de volta.',
          ].join('\n'),
        )
        .addFields(
          {
            name: 'Sai',
            value: `**${alvos.canais.length}** canais · **${alvos.cargos.length}** cargos`,
            inline: true,
          },
          {
            name: 'Entra',
            value: `**${plan.channels}** canais · **${plan.roles}** cargos`,
            inline: true,
          },
          ...(protegidos > 0
            ? [
                {
                  name: 'Fica de pé',
                  value:
                    `**${protegidos}** ${protegidos === 1 ? 'canal que não consigo apagar' : 'canais que não consigo apagar'}` +
                    ' — canal de regras ou de avisos de um servidor de comunidade, ou acima do meu cargo.',
                },
              ]
            : []),
        )
        .setFooter({ text: 'Se não é isso que você quer, desmarque a limpeza no painel anterior.' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`builder:criar:${key}:${rawExtras}`)
          .setLabel(`Sim, apagar ${alvos.canais.length} canais e montar`)
          .setEmoji('🧨')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`builder:painel:${key}:${rawExtras}`)
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('builder:cancelar')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

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

  const limpando = extras.includes('limpar');

  if ((extras.includes('cargos') || limpando) && !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return replyError(
      interaction,
      'Preciso da permissão **Gerenciar Cargos** para mexer nos cargos — ou desmarque essa opção no menu.',
    );
  }

  const plan = planSummary(template, extras);

  // A construção leva vários segundos: o Discord dá 3s para responder, então
  // trocamos a mensagem por um aviso de progresso antes de começar.
  await interaction.update({
    embeds: [
      embed.info(
        `${limpando ? 'Apagando o antigo e montando' : 'Construindo'} **${template.label}**… ` +
          `${plan.channels} canais e ${plan.roles} cargos. Isso leva alguns segundos.`,
      ),
    ],
    components: [],
  });

  // O canal de onde o comando saiu fica por último: apagá-lo antes de responder
  // deixaria a pessoa sem nenhum retorno do que aconteceu.
  const origem = limpando && interaction.channelId ? new Set([interaction.channelId]) : new Set();

  const { created, removed, failures, primeiroCanal, restam } = await buildServer(
    interaction.guild,
    template,
    extras,
    { preservar: origem },
  );

  if (failures.length > 0) {
    logger.warn(`/construir: ${quantidade(failures.length, 'falha')} em ${interaction.guild.id}`);
  }

  const done = embed
    .base(template.color)
    .setTitle(`${template.emoji} Servidor construído`)
    .setDescription(
      [
        limpando
          ? `Apaguei **${removed.channels}** canais e **${removed.roles}** cargos antigos.`
          : null,
        `Criei **${created.categories}** categorias, **${created.channels}** canais e **${created.roles}** cargos.`,
      ]
        .filter(Boolean)
        .join('\n'),
    );

  if (failures.length > 0) {
    done.addFields({
      name: `⚠️ ${quantidade(failures.length, 'item pendente', 'itens pendentes')}`,
      value: failures.slice(0, 8).join('\n').slice(0, 1024),
    });
    done.setFooter({ text: 'O motivo mais comum é o cargo do bot estar abaixo na lista de cargos.' });
  }

  // A mensagem efêmera morre junto com o canal de onde veio o comando, então o
  // relatório também vai para um canal novo — lá ele sobrevive à limpeza.
  if (limpando && primeiroCanal) {
    await primeiroCanal.send({ embeds: [done] }).catch(() => {});
  }

  await interaction.editReply({ embeds: [done], components: [] }).catch(() => {});

  // Por último o canal de origem. Depois disto não há mais para onde responder.
  for (const canal of restam) {
    await canal.delete('Limpeza pedida no /construir').catch(() => {});
  }
}
