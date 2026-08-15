import { colors } from '../../config.js';
import { db } from '../../lib/db.js';
import { embed, truncate } from '../../lib/embeds.js';
import { aviso, familia, opt, privado } from '../../lib/familia.js';
import { quantidade } from '../../lib/portugues.js';

const inserir = db.prepare(
  'INSERT INTO pessoal (guild_id, user_id, tipo, texto, criado) VALUES (?, ?, ?, ?, ?)',
);
const listar = db.prepare(
  'SELECT * FROM pessoal WHERE guild_id = ? AND user_id = ? AND tipo = ? ORDER BY feito, id',
);
const pegar = db.prepare('SELECT * FROM pessoal WHERE id = ? AND guild_id = ? AND user_id = ?');
const remover = db.prepare('DELETE FROM pessoal WHERE id = ? AND guild_id = ? AND user_id = ?');
const limparTipo = db.prepare('DELETE FROM pessoal WHERE guild_id = ? AND user_id = ? AND tipo = ?');
const marcar = db.prepare('UPDATE pessoal SET feito = ? WHERE id = ? AND guild_id = ? AND user_id = ?');
const contar = db.prepare(
  'SELECT tipo, COUNT(*) AS total, SUM(feito) AS feitos FROM pessoal WHERE guild_id = ? AND user_id = ? GROUP BY tipo',
);

const lerPref = db.prepare('SELECT valor FROM preferencias WHERE guild_id = ? AND user_id = ? AND chave = ?');
const gravarPref = db.prepare(`
  INSERT INTO preferencias (guild_id, user_id, chave, valor) VALUES (?, ?, ?, ?)
  ON CONFLICT (guild_id, user_id, chave) DO UPDATE SET valor = excluded.valor
`);
const apagarPref = db.prepare('DELETE FROM preferencias WHERE guild_id = ? AND user_id = ? AND chave = ?');
const todosDaChave = db.prepare('SELECT user_id, valor FROM preferencias WHERE guild_id = ? AND chave = ?');

const LIMITE = 50;

const chaves = (interaction) => [interaction.guildId, interaction.user.id];

/** Cria um item de um tipo, respeitando o limite por pessoa. */
function criar(interaction, tipo, texto) {
  const total = listar.get(...chaves(interaction), tipo) ? listar.all(...chaves(interaction), tipo).length : 0;
  if (total >= LIMITE) throw aviso(`Você já tem ${LIMITE} ${tipo}s. Apague alguma antes de criar outra.`);
  const info = inserir.run(...chaves(interaction), tipo, texto, Date.now());
  return info.lastInsertRowid;
}

/** Lista de um tipo, formatada, sempre privada — é a área pessoal de alguém. */
function mostrar(interaction, tipo, titulo, comCaixa) {
  const itens = listar.all(...chaves(interaction), tipo);
  if (itens.length === 0) return privado(`Você ainda não tem nenhuma **${tipo}**.`);
  const linhas = itens.map((item) => {
    const caixa = comCaixa ? (item.feito ? '✅ ' : '⬜ ') : '• ';
    const texto = item.feito ? `~~${item.texto}~~` : item.texto;
    return `${caixa}\`#${item.id}\` ${texto}`;
  });
  return {
    embeds: [
      embed.base(colors.primary)
        .setTitle(`${titulo} (${itens.length})`)
        .setDescription(truncate(linhas.join('\n'), 4000))
        .setFooter({ text: 'Só você está vendo isto.' }),
    ],
    flags: 64,
  };
}

const ID = (descricao = 'O número do item') => opt.inteiro('id', descricao, true, { min: 1 });
const TEXTO = (descricao) => opt.texto('texto', descricao, true, { max: 500 });

/** Confere que o item existe e é do tipo certo antes de mexer nele. */
function exigirItem(interaction, id, tipo) {
  const item = pegar.get(id, ...chaves(interaction));
  if (!item || item.tipo !== tipo) throw aviso(`Não achei ${tipo} com o número \`#${id}\` na sua lista.`);
  return item;
}

const dataValida = (texto) => {
  const partida = /^(\d{1,2})[/-](\d{1,2})$/.exec(texto.trim());
  if (!partida) throw aviso('Escreva no formato `DD/MM`, por exemplo `14/08`.');
  const [, dia, mes] = partida.map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) throw aviso('Essa data não existe.');
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
};

export default familia({
  name: 'pessoal',
  description: 'Suas anotações, tarefas, metas e preferências — só você vê.',
  cooldown: 2,
  dm: false,
  subs: [
    {
      name: 'nota-criar',
      description: 'Guarda uma anotação.',
      options: [TEXTO('A anotação')],
      run: ({ texto }, interaction) =>
        privado(`📝 Anotação \`#${criar(interaction, 'nota', texto)}\` guardada.`),
    },
    {
      name: 'nota-listar',
      description: 'Mostra suas anotações.',
      run: (_, interaction) => mostrar(interaction, 'nota', '📝 Suas anotações', false),
    },
    {
      name: 'nota-ver',
      description: 'Abre uma anotação inteira.',
      options: [ID('O número da anotação')],
      run: ({ id }, interaction) => {
        const item = exigirItem(interaction, id, 'nota');
        return privado(`📝 **Anotação #${item.id}**\n_criada <t:${Math.floor(item.criado / 1000)}:R>_\n\n${item.texto}`);
      },
    },
    {
      name: 'nota-apagar',
      description: 'Apaga uma anotação.',
      options: [ID('O número da anotação')],
      run: ({ id }, interaction) => {
        exigirItem(interaction, id, 'nota');
        remover.run(id, ...chaves(interaction));
        return privado(`🗑️ Anotação \`#${id}\` apagada.`);
      },
    },
    {
      name: 'nota-limpar',
      description: 'Apaga todas as suas anotações.',
      run: (_, interaction) => {
        const { changes } = limparTipo.run(...chaves(interaction), 'nota');
        return privado(`🗑️ Apaguei **${changes}** anotação(ões).`);
      },
    },
    {
      name: 'tarefa-criar',
      description: 'Adiciona uma tarefa à sua lista.',
      options: [TEXTO('A tarefa')],
      run: ({ texto }, interaction) =>
        privado(`✅ Tarefa \`#${criar(interaction, 'tarefa', texto)}\` criada.`),
    },
    {
      name: 'tarefa-listar',
      description: 'Mostra sua lista de tarefas.',
      run: (_, interaction) => mostrar(interaction, 'tarefa', '✅ Suas tarefas', true),
    },
    {
      name: 'tarefa-concluir',
      description: 'Marca uma tarefa como feita.',
      options: [ID('O número da tarefa')],
      run: ({ id }, interaction) => {
        const item = exigirItem(interaction, id, 'tarefa');
        if (item.feito) throw aviso('Essa tarefa já está concluída.');
        marcar.run(1, id, ...chaves(interaction));
        return privado(`🎉 Tarefa \`#${id}\` concluída: ~~${item.texto}~~`);
      },
    },
    {
      name: 'tarefa-reabrir',
      description: 'Volta uma tarefa concluída para pendente.',
      options: [ID('O número da tarefa')],
      run: ({ id }, interaction) => {
        const item = exigirItem(interaction, id, 'tarefa');
        if (!item.feito) throw aviso('Essa tarefa já está pendente.');
        marcar.run(0, id, ...chaves(interaction));
        return privado(`↩️ Tarefa \`#${id}\` está pendente de novo.`);
      },
    },
    {
      name: 'tarefa-apagar',
      description: 'Apaga uma tarefa.',
      options: [ID('O número da tarefa')],
      run: ({ id }, interaction) => {
        exigirItem(interaction, id, 'tarefa');
        remover.run(id, ...chaves(interaction));
        return privado(`🗑️ Tarefa \`#${id}\` apagada.`);
      },
    },
    {
      name: 'tarefa-limpar-feitas',
      description: 'Apaga só as tarefas já concluídas.',
      run: (_, interaction) => {
        const { changes } = db
          .prepare("DELETE FROM pessoal WHERE guild_id = ? AND user_id = ? AND tipo = 'tarefa' AND feito = 1")
          .run(...chaves(interaction));
        return privado(`🧹 Apaguei **${quantidade(changes, 'tarefa concluída', 'tarefas concluídas')}**.`);
      },
    },
    {
      name: 'tarefa-limpar',
      description: 'Apaga todas as suas tarefas.',
      run: (_, interaction) => {
        const { changes } = limparTipo.run(...chaves(interaction), 'tarefa');
        return privado(`🗑️ Apaguei **${quantidade(changes, 'tarefa')}**.`);
      },
    },
    {
      name: 'meta-criar',
      description: 'Registra uma meta sua.',
      options: [TEXTO('A meta')],
      run: ({ texto }, interaction) =>
        privado(`🎯 Meta \`#${criar(interaction, 'meta', texto)}\` registrada. Boa sorte!`),
    },
    {
      name: 'meta-listar',
      description: 'Mostra suas metas.',
      run: (_, interaction) => mostrar(interaction, 'meta', '🎯 Suas metas', true),
    },
    {
      name: 'meta-concluir',
      description: 'Marca uma meta como alcançada.',
      options: [ID('O número da meta')],
      run: ({ id }, interaction) => {
        const item = exigirItem(interaction, id, 'meta');
        if (item.feito) throw aviso('Essa meta já está concluída.');
        marcar.run(1, id, ...chaves(interaction));
        const dias = Math.floor((Date.now() - item.criado) / 86_400_000);
        return privado(`🏆 **Meta alcançada!**\n${item.texto}\n\n_Você levou ${quantidade(dias, 'dia')} desde o registro._`);
      },
    },
    {
      name: 'meta-apagar',
      description: 'Apaga uma meta.',
      options: [ID('O número da meta')],
      run: ({ id }, interaction) => {
        exigirItem(interaction, id, 'meta');
        remover.run(id, ...chaves(interaction));
        return privado(`🗑️ Meta \`#${id}\` apagada.`);
      },
    },
    {
      name: 'aniversario-definir',
      description: 'Guarda o dia do seu aniversário.',
      options: [opt.texto('data', 'No formato DD/MM', true, { max: 5 })],
      run: ({ data }, interaction) => {
        const valor = dataValida(data);
        gravarPref.run(...chaves(interaction), 'aniversario', valor);
        return privado(`🎂 Anotei: **${valor}**. Use \`/pessoal aniversários-próximos\` para ver os próximos aniversários.`);
      },
    },
    {
      name: 'aniversario-ver',
      description: 'Mostra o aniversário de alguém.',
      options: [opt.usuario('membro', 'De quem (padrão: você)', false)],
      run: ({ membro }, interaction) => {
        const alvo = membro ?? interaction.user;
        const valor = lerPref.get(interaction.guildId, alvo.id, 'aniversario')?.valor;
        if (!valor) throw aviso(`${alvo.id === interaction.user.id ? 'Você ainda não definiu seu' : 'Essa pessoa não definiu o'} aniversário.`);
        return `🎂 O aniversário de **${alvo.username}** é em **${valor}**.`;
      },
    },
    {
      name: 'aniversarios-proximos',
      description: 'Quem faz aniversário nos próximos dias.',
      run: (_, interaction) => {
        const hoje = new Date();
        const registros = todosDaChave.all(interaction.guildId, 'aniversario');
        if (registros.length === 0) throw aviso('Ninguém definiu aniversário ainda neste servidor.');

        const comFalta = registros.map(({ user_id, valor }) => {
          const [dia, mes] = valor.split('/').map(Number);
          let proximo = new Date(hoje.getFullYear(), mes - 1, dia);
          if (proximo < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) {
            proximo = new Date(hoje.getFullYear() + 1, mes - 1, dia);
          }
          return { user_id, valor, falta: Math.round((proximo - hoje) / 86_400_000) };
        });

        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle('🎂 Próximos aniversários')
              .setDescription(
                comFalta
                  .sort((a, b) => a.falta - b.falta)
                  .slice(0, 15)
                  .map((r) => `**${r.valor}** — <@${r.user_id}> ${r.falta === 0 ? '🎉 **é hoje!**' : `em ${quantidade(r.falta, 'dia')}`}`)
                  .join('\n'),
              ),
          ],
        };
      },
    },
    {
      name: 'aniversario-remover',
      description: 'Apaga o seu aniversário do servidor.',
      run: (_, interaction) => {
        const { changes } = apagarPref.run(...chaves(interaction), 'aniversario');
        if (changes === 0) throw aviso('Você não tinha aniversário guardado.');
        return privado('🗑️ Aniversário removido.');
      },
    },
    {
      name: 'anotar-rapido',
      description: 'Guarda um link ou trecho para ver depois.',
      options: [TEXTO('O que guardar')],
      run: ({ texto }, interaction) =>
        privado(`🔖 Guardado como \`#${criar(interaction, 'guardado', texto)}\`. Veja com \`/pessoal guardados\`.`),
    },
    {
      name: 'guardados',
      description: 'Mostra o que você guardou para ver depois.',
      run: (_, interaction) => mostrar(interaction, 'guardado', '🔖 Guardados', false),
    },
    {
      name: 'guardado-apagar',
      description: 'Apaga um item guardado.',
      options: [ID('O número do item')],
      run: ({ id }, interaction) => {
        exigirItem(interaction, id, 'guardado');
        remover.run(id, ...chaves(interaction));
        return privado(`🗑️ Item \`#${id}\` apagado.`);
      },
    },
    {
      name: 'resumo',
      description: 'Quanto você tem de cada coisa.',
      run: (_, interaction) => {
        const linhas = contar.all(...chaves(interaction));
        if (linhas.length === 0) throw aviso('Você ainda não guardou nada por aqui.');
        const rotulos = { nota: '📝 Anotações', tarefa: '✅ Tarefas', meta: '🎯 Metas', guardado: '🔖 Guardados' };
        return {
          embeds: [
            embed.base(colors.primary)
              .setTitle('Sua área pessoal')
              .setDescription(
                linhas
                  .map((l) => `${rotulos[l.tipo] ?? l.tipo}: **${l.total}**${l.feitos > 0 ? ` (${quantidade(l.feitos, 'concluída', 'concluídas')})` : ''}`)
                  .join('\n'),
              )
              .setFooter({ text: `Limite de ${LIMITE} itens por tipo.` }),
          ],
          flags: 64,
        };
      },
    },
    {
      name: 'apagar-tudo',
      description: 'Apaga tudo o que você guardou neste servidor.',
      options: [opt.texto('confirmar', 'Digite APAGAR para confirmar', true, { max: 10 })],
      run: ({ confirmar }, interaction) => {
        if (confirmar !== 'APAGAR') throw aviso('Digite exatamente `APAGAR` para confirmar. Nada foi removido.');
        const itens = db.prepare('DELETE FROM pessoal WHERE guild_id = ? AND user_id = ?').run(...chaves(interaction));
        const prefs = db.prepare('DELETE FROM preferencias WHERE guild_id = ? AND user_id = ?').run(...chaves(interaction));
        return privado(`🗑️ Apaguei **${quantidade(itens.changes, 'item', 'itens')}** e **${quantidade(prefs.changes, 'preferência')}**.`);
      },
    },
  ],
});
