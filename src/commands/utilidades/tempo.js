import { aviso, familia, opt } from '../../lib/familia.js';

const FUSOS = [
  { name: 'Brasília (BRT)', value: 'America/Sao_Paulo' },
  { name: 'Manaus', value: 'America/Manaus' },
  { name: 'Rio Branco', value: 'America/Rio_Branco' },
  { name: 'Fernando de Noronha', value: 'America/Noronha' },
  { name: 'Lisboa', value: 'Europe/Lisbon' },
  { name: 'Londres', value: 'Europe/London' },
  { name: 'Nova York', value: 'America/New_York' },
  { name: 'Los Angeles', value: 'America/Los_Angeles' },
  { name: 'Tóquio', value: 'Asia/Tokyo' },
  { name: 'Sydney', value: 'Australia/Sydney' },
  { name: 'UTC', value: 'UTC' },
];

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const lerData = (texto) => {
  const data = new Date(texto.trim().replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) {
    throw aviso('Não entendi essa data. Use `2026-12-25` ou `2026-12-25 20:00`.');
  }
  return data;
};

const DATA = (name = 'data', descricao = 'Ex.: 2026-12-25') =>
  opt.texto(name, descricao, true, { max: 40 });

const emFuso = (data, fuso, opcoes) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, ...opcoes }).format(data);

const diasEntre = (a, b) => Math.round((b - a) / 86_400_000);

// Bissexto: divisível por 4, exceto séculos que não são divisíveis por 400.
const bissexto = (ano) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

export default familia({
  name: 'tempo',
  description: 'Datas, horários, fusos, contagens e prazos.',
  cooldown: 3,
  subs: [
    {
      name: 'agora',
      description: 'Que horas são, no seu fuso e em outros.',
      run: () => {
        const agora = new Date();
        const segundos = Math.floor(agora.getTime() / 1000);
        return [
          `🕐 **No seu horário local:** <t:${segundos}:F>`,
          '',
          ...FUSOS.slice(0, 6).map(
            (f) => `**${f.name}** — ${emFuso(agora, f.value, { dateStyle: 'short', timeStyle: 'short' })}`,
          ),
        ].join('\n');
      },
    },
    {
      name: 'fuso',
      description: 'Que horas são num fuso específico.',
      options: [{ kind: 'string', name: 'lugar', description: 'O fuso', required: true, choices: FUSOS }],
      run: ({ lugar }) => {
        const agora = new Date();
        const nome = FUSOS.find((f) => f.value === lugar).name;
        return `🌍 **${nome}**\n${emFuso(agora, lugar, { dateStyle: 'full', timeStyle: 'medium' })}`;
      },
    },
    {
      name: 'converter-fuso',
      description: 'Converte um horário de um fuso para outro.',
      options: [
        DATA('quando', 'Ex.: 2026-12-25 20:00'),
        { kind: 'string', name: 'de', description: 'Fuso de origem', required: true, choices: FUSOS },
        { kind: 'string', name: 'para', description: 'Fuso de destino', required: true, choices: FUSOS },
      ],
      run: ({ quando, de, para }) => {
        // Descobre o deslocamento real do fuso de origem naquela data — assim o
        // horário de verão do hemisfério norte entra na conta sozinho.
        const ingenua = lerData(quando);
        const comoUtc = new Date(ingenua.toISOString().replace('Z', 'Z'));
        const deslocamento = deslocamentoDoFuso(comoUtc, de);
        const instante = new Date(comoUtc.getTime() - deslocamento);
        const nome = (v) => FUSOS.find((f) => f.value === v).name;
        return [
          `**${nome(de)}:** ${emFuso(instante, de, { dateStyle: 'short', timeStyle: 'short' })}`,
          `**${nome(para)}:** ${emFuso(instante, para, { dateStyle: 'short', timeStyle: 'short' })}`,
          '',
          `Para todo mundo ver no próprio fuso: <t:${Math.floor(instante.getTime() / 1000)}:F>`,
        ].join('\n');
      },
    },
    {
      name: 'faltam',
      description: 'Quanto tempo falta para uma data.',
      options: [DATA()],
      run: ({ data }) => {
        const alvo = lerData(data);
        const segundos = Math.floor(alvo.getTime() / 1000);
        const passou = alvo < new Date();
        return `📅 **${emFuso(alvo, 'America/Sao_Paulo', { dateStyle: 'full' })}**\n\n${passou ? 'Foi' : 'Falta'} <t:${segundos}:R>`;
      },
    },
    {
      name: 'diferenca',
      description: 'Quantos dias há entre duas datas.',
      options: [DATA('de', 'Data inicial'), DATA('ate', 'Data final')],
      run: ({ de, ate }) => {
        const inicio = lerData(de);
        const fim = lerData(ate);
        const dias = Math.abs(diasEntre(inicio, fim));
        const anos = Math.floor(dias / 365.2425);
        const meses = Math.floor((dias % 365.2425) / 30.44);
        return [
          `**${dias.toLocaleString('pt-BR')}** dias`,
          `**${Math.floor(dias / 7).toLocaleString('pt-BR')}** semanas`,
          anos > 0 ? `Aproximadamente **${anos}** ano(s) e **${meses}** mês(es)` : null,
          `**${(dias * 24).toLocaleString('pt-BR')}** horas`,
        ].filter(Boolean).join('\n');
      },
    },
    {
      name: 'idade',
      description: 'Calcula a idade a partir da data de nascimento.',
      options: [DATA('nascimento', 'Ex.: 2005-08-14')],
      run: ({ nascimento }) => {
        const nasceu = lerData(nascimento);
        const hoje = new Date();
        if (nasceu > hoje) throw aviso('Essa data está no futuro.');

        let anos = hoje.getFullYear() - nasceu.getFullYear();
        const fezAniversario =
          hoje.getMonth() > nasceu.getMonth() ||
          (hoje.getMonth() === nasceu.getMonth() && hoje.getDate() >= nasceu.getDate());
        if (!fezAniversario) anos -= 1;

        const proximo = new Date(hoje.getFullYear(), nasceu.getMonth(), nasceu.getDate());
        if (proximo < hoje) proximo.setFullYear(proximo.getFullYear() + 1);

        return [
          `🎂 **${anos} anos**`,
          `Nascido(a) numa **${DIAS[nasceu.getDay()]}**`,
          `Já viveu **${diasEntre(nasceu, hoje).toLocaleString('pt-BR')}** dias`,
          `Próximo aniversário <t:${Math.floor(proximo.getTime() / 1000)}:R>`,
        ].join('\n');
      },
    },
    {
      name: 'dia-da-semana',
      description: 'Em que dia da semana cai uma data.',
      options: [DATA()],
      run: ({ data }) => {
        const quando = lerData(data);
        return `**${emFuso(quando, 'UTC', { dateStyle: 'long' })}** cai numa **${DIAS[quando.getUTCDay()]}**`;
      },
    },
    {
      name: 'somar-dias',
      description: 'Soma (ou subtrai) dias de uma data.',
      options: [DATA(), opt.inteiro('dias', 'Use negativo para subtrair', true, { min: -36500, max: 36500 })],
      run: ({ data, dias }) => {
        const inicio = lerData(data);
        const fim = new Date(inicio.getTime() + dias * 86_400_000);
        return `**${emFuso(inicio, 'UTC', { dateStyle: 'short' })}** ${dias >= 0 ? '+' : '−'} ${Math.abs(dias)} dias\n\n**${emFuso(fim, 'UTC', { dateStyle: 'full' })}**`;
      },
    },
    {
      name: 'dias-uteis',
      description: 'Conta dias úteis entre duas datas.',
      options: [DATA('de', 'Data inicial'), DATA('ate', 'Data final')],
      run: ({ de, ate }) => {
        const inicio = lerData(de);
        const fim = lerData(ate);
        if (inicio > fim) throw aviso('A data inicial precisa vir antes da final.');
        if (diasEntre(inicio, fim) > 3650) throw aviso('O intervalo máximo é de 10 anos.');

        let uteis = 0;
        let fds = 0;
        for (let d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
          if (d.getUTCDay() === 0 || d.getUTCDay() === 6) fds += 1;
          else uteis += 1;
        }
        return `**${uteis}** dias úteis\n**${fds}** dias de fim de semana`;
      },
    },
    {
      name: 'semana',
      description: 'Em que semana do ano cai uma data.',
      options: [DATA()],
      run: ({ data }) => {
        const quando = lerData(data);
        const inicioDoAno = new Date(Date.UTC(quando.getUTCFullYear(), 0, 1));
        const dia = diasEntre(inicioDoAno, quando) + 1;
        const semana = Math.ceil((dia + inicioDoAno.getUTCDay()) / 7);
        const total = bissexto(quando.getUTCFullYear()) ? 366 : 365;
        return [
          `Dia **${dia}** de **${total}** do ano`,
          `Semana **${semana}**`,
          `Faltam **${total - dia}** dias para acabar o ano`,
        ].join('\n');
      },
    },
    {
      name: 'bissexto',
      description: 'Diz se um ano é bissexto.',
      options: [opt.inteiro('ano', 'O ano', true, { min: 1, max: 9999 })],
      run: ({ ano }) => {
        const proximos = [];
        for (let a = ano + 1; proximos.length < 3; a += 1) if (bissexto(a)) proximos.push(a);
        return `**${ano}** ${bissexto(ano) ? '**é** bissexto ✅' : '**não é** bissexto ❌'}\n\nPróximos bissextos: ${proximos.join(', ')}`;
      },
    },
    {
      name: 'cronometro',
      description: 'Marca um instante para você medir tempo depois.',
      run: () => {
        const agora = Math.floor(Date.now() / 1000);
        return `⏱️ Marquei <t:${agora}:T>.\nUse de novo depois e compare — ou veja: <t:${agora}:R>`;
      },
    },
    {
      name: 'ano-novo',
      description: 'Quanto falta para o ano novo.',
      run: () => {
        const agora = new Date();
        const virada = new Date(Date.UTC(agora.getUTCFullYear() + 1, 0, 1, 3)); // meia-noite em Brasília
        return `🎆 Faltam <t:${Math.floor(virada.getTime() / 1000)}:R> para **${virada.getUTCFullYear()}**`;
      },
    },
    {
      name: 'progresso-ano',
      description: 'Quanto do ano já passou.',
      run: () => {
        const agora = new Date();
        const inicio = new Date(Date.UTC(agora.getUTCFullYear(), 0, 1));
        const fim = new Date(Date.UTC(agora.getUTCFullYear() + 1, 0, 1));
        const pct = ((agora - inicio) / (fim - inicio)) * 100;
        const cheios = Math.round(pct / 5);
        return `**${agora.getUTCFullYear()}**\n\`${'█'.repeat(cheios)}${'░'.repeat(20 - cheios)}\` **${pct.toFixed(1)}%**`;
      },
    },
    {
      name: 'progresso-mes',
      description: 'Quanto do mês já passou.',
      run: () => {
        const agora = new Date();
        const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
        const fim = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));
        const pct = ((agora - inicio) / (fim - inicio)) * 100;
        const cheios = Math.round(pct / 5);
        const mes = emFuso(agora, 'UTC', { month: 'long' });
        return `**${mes}**\n\`${'█'.repeat(cheios)}${'░'.repeat(20 - cheios)}\` **${pct.toFixed(1)}%**`;
      },
    },
    {
      name: 'unix',
      description: 'Converte um timestamp Unix em data legível.',
      options: [opt.inteiro('timestamp', 'Segundos desde 1970', true, { min: 0, max: 253_402_300_799 })],
      run: ({ timestamp }) =>
        `\`${timestamp}\`\n\n<t:${timestamp}:F>\n<t:${timestamp}:R>`,
    },
    {
      name: 'para-unix',
      description: 'Converte uma data em timestamp Unix.',
      options: [DATA('quando', 'Ex.: 2026-12-25 20:00')],
      run: ({ quando }) => {
        const segundos = Math.floor(lerData(quando).getTime() / 1000);
        return `\`${segundos}\`\n\n<t:${segundos}:F>`;
      },
    },
    {
      name: 'duracao',
      description: 'Soma durações escritas como 1h30m20s.',
      options: [opt.texto('duracoes', 'Ex.: 1h30m + 45m + 2h', true, { max: 300 })],
      run: ({ duracoes }) => {
        const partidas = duracoes.matchAll(/(\d+)\s*([dhms])/gi);
        const pesos = { d: 86400, h: 3600, m: 60, s: 1 };
        let total = 0;
        let achou = false;
        for (const [, valor, unidade] of partidas) {
          total += Number(valor) * pesos[unidade.toLowerCase()];
          achou = true;
        }
        if (!achou) throw aviso('Escreva assim: `1h30m`, `2d 4h`, `90s`.');
        const partes = [
          [Math.floor(total / 86400), 'd'],
          [Math.floor((total % 86400) / 3600), 'h'],
          [Math.floor((total % 3600) / 60), 'm'],
          [total % 60, 's'],
        ].filter(([n]) => n > 0);
        return `Total: **${partes.map(([n, u]) => `${n}${u}`).join(' ') || '0s'}**\nEm segundos: **${total.toLocaleString('pt-BR')}**`;
      },
    },
  ],
});

/** Deslocamento do fuso, em milissegundos, na data indicada. */
function deslocamentoDoFuso(data, fuso) {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const partes = Object.fromEntries(
    formatador.formatToParts(data).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]),
  );
  const comoUtc = Date.UTC(
    partes.year, partes.month - 1, partes.day,
    partes.hour % 24, partes.minute, partes.second,
  );
  return comoUtc - data.getTime();
}
