import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { colors } from '../config.js';
import { embed, replyError, truncate } from './embeds.js';

/**
 * Monta um comando com muitos subcomandos a partir de uma tabela.
 *
 * Escrever 25 subcomandos com o builder na mão custa umas 200 linhas de
 * repetição por arquivo, e o erro típico — nome duplicado, descrição acima de
 * 100 caracteres — só aparece quando o Discord recusa o registro inteiro. Aqui
 * a tabela é declarativa e as regras do Discord são checadas na carga, então um
 * erro estoura no `npm start` em vez de derrubar o deploy de todos os comandos.
 *
 * Cada subcomando é `{ name, description, options?, run }`. O `run` recebe as
 * opções já resolvidas num objeto simples e devolve:
 *
 *   string  → vira um embed padrão
 *   objeto  → usado como payload da resposta (para embeds próprios)
 *   null    → o run já respondeu por conta própria
 */

/** Atalhos para declarar opções sem repetir o tipo por extenso. */
export const opt = {
  texto: (name = 'texto', description = 'O texto', required = true, extra = {}) => ({
    kind: 'string',
    name,
    description,
    required,
    ...extra,
  }),
  numero: (name, description, required = true, extra = {}) => ({
    kind: 'number',
    name,
    description,
    required,
    ...extra,
  }),
  inteiro: (name, description, required = true, extra = {}) => ({
    kind: 'integer',
    name,
    description,
    required,
    ...extra,
  }),
  usuario: (name = 'usuario', description = 'O membro', required = false) => ({
    kind: 'user',
    name,
    description,
    required,
  }),
  canal: (name = 'canal', description = 'O canal', required = false) => ({
    kind: 'channel',
    name,
    description,
    required,
  }),
  cargo: (name = 'cargo', description = 'O cargo', required = false) => ({
    kind: 'role',
    name,
    description,
    required,
  }),
  sim: (name, description, required = false) => ({
    kind: 'boolean',
    name,
    description,
    required,
  }),
};

const ADICIONA = {
  string: (sub, o) =>
    sub.addStringOption((b) => {
      b.setName(o.name).setDescription(o.description).setRequired(o.required);
      if (o.max) b.setMaxLength(o.max);
      if (o.min) b.setMinLength(o.min);
      if (o.choices) b.addChoices(...o.choices);
      return b;
    }),
  integer: (sub, o) =>
    sub.addIntegerOption((b) => {
      b.setName(o.name).setDescription(o.description).setRequired(o.required);
      if (o.min !== undefined) b.setMinValue(o.min);
      if (o.max !== undefined) b.setMaxValue(o.max);
      if (o.choices) b.addChoices(...o.choices);
      return b;
    }),
  number: (sub, o) =>
    sub.addNumberOption((b) => {
      b.setName(o.name).setDescription(o.description).setRequired(o.required);
      if (o.min !== undefined) b.setMinValue(o.min);
      if (o.max !== undefined) b.setMaxValue(o.max);
      return b;
    }),
  user: (sub, o) =>
    sub.addUserOption((b) =>
      b.setName(o.name).setDescription(o.description).setRequired(o.required),
    ),
  channel: (sub, o) =>
    sub.addChannelOption((b) =>
      b.setName(o.name).setDescription(o.description).setRequired(o.required),
    ),
  role: (sub, o) =>
    sub.addRoleOption((b) =>
      b.setName(o.name).setDescription(o.description).setRequired(o.required),
    ),
  boolean: (sub, o) =>
    sub.addBooleanOption((b) =>
      b.setName(o.name).setDescription(o.description).setRequired(o.required),
    ),
};

const LE = {
  string: (o, n) => o.getString(n),
  integer: (o, n) => o.getInteger(n),
  number: (o, n) => o.getNumber(n),
  user: (o, n) => o.getUser(n),
  channel: (o, n) => o.getChannel(n),
  role: (o, n) => o.getRole(n),
  boolean: (o, n) => o.getBoolean(n),
};

/** As regras do Discord que, se violadas, fazem o registro inteiro falhar. */
function valida(nomeComando, subs) {
  if (subs.length === 0 || subs.length > 25) {
    throw new Error(`/${nomeComando}: ${subs.length} subcomandos (o Discord aceita de 1 a 25).`);
  }

  const vistos = new Set();
  for (const sub of subs) {
    if (vistos.has(sub.name)) throw new Error(`/${nomeComando}: subcomando "${sub.name}" duplicado.`);
    vistos.add(sub.name);

    if (!/^[a-z0-9_-]{1,32}$/.test(sub.name)) {
      throw new Error(`/${nomeComando} ${sub.name}: nome inválido (use a-z, 0-9, _ e -, até 32).`);
    }
    if (sub.description.length > 100) {
      throw new Error(`/${nomeComando} ${sub.name}: descrição com ${sub.description.length} caracteres (máx. 100).`);
    }
    if ((sub.options ?? []).length > 25) {
      throw new Error(`/${nomeComando} ${sub.name}: opções demais.`);
    }
    for (const o of sub.options ?? []) {
      if (o.description.length > 100) {
        throw new Error(`/${nomeComando} ${sub.name} ${o.name}: descrição longa demais.`);
      }
    }
    if (typeof sub.run !== 'function') {
      throw new Error(`/${nomeComando} ${sub.name}: falta a função run.`);
    }
  }
}

export function familia({
  name,
  description,
  subs,
  cooldown = 3,
  cor = colors.primary,
  dm = true,
}) {
  valida(name, subs);

  const data = new SlashCommandBuilder().setName(name).setDescription(description);

  for (const sub of subs) {
    data.addSubcommand((builder) => {
      builder.setName(sub.name).setDescription(sub.description);
      for (const o of sub.options ?? []) ADICIONA[o.kind](builder, o);
      return builder;
    });
  }

  data.setContexts(
    ...(dm
      ? [InteractionContextType.Guild, InteractionContextType.BotDM]
      : [InteractionContextType.Guild]),
  );

  const porNome = new Map(subs.map((sub) => [sub.name, sub]));

  return {
    cooldown,
    guildOnly: !dm,
    data,

    async execute(interaction, client) {
      const sub = porNome.get(interaction.options.getSubcommand());
      if (!sub) return replyError(interaction, 'Esse subcomando não existe mais.');

      const valores = {};
      for (const o of sub.options ?? []) valores[o.name] = LE[o.kind](interaction.options, o.name);

      let resultado;
      try {
        resultado = await sub.run(valores, interaction, client);
      } catch (error) {
        // Erros de uso (divisão por zero, número fora de faixa) viram aviso
        // legível; o resto sobe para o handler global, que já loga.
        if (error?.usuario) return replyError(interaction, error.message);
        throw error;
      }

      if (resultado === null || resultado === undefined) return;
      if (typeof resultado === 'string') {
        return interaction.reply({
          embeds: [embed.base(cor).setDescription(truncate(resultado, 4096))],
        });
      }
      return interaction.reply(resultado);
    },
  };
}

/** Erro que o usuário causou — vira aviso em vez de "algo deu errado". */
export function aviso(mensagem) {
  const error = new Error(mensagem);
  error.usuario = true;
  return error;
}

/** Resposta só para quem chamou. */
export function privado(descricao, cor = colors.primary) {
  return {
    embeds: [embed.base(cor).setDescription(truncate(descricao, 4096))],
    flags: MessageFlags.Ephemeral,
  };
}

/**
 * Bloco de código, o formato certo para saída de texto processado.
 *
 * As três crases do texto de entrada recebem um espaço de largura zero no meio:
 * sem isso, quem mandasse ``` fecharia o bloco e o resto vazaria como markdown.
 */
export function bloco(conteudo, linguagem = '') {
  const corpo = truncate(String(conteudo).replaceAll('```', '`​``'), 3900);
  return `\`\`\`${linguagem}\n${corpo || ' '}\n\`\`\``;
}
