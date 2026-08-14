import { aviso, familia, opt } from '../../lib/familia.js';

const formatar = (valor, casas = 2) =>
  Number(valor.toFixed(casas)).toLocaleString('pt-BR', { maximumFractionDigits: casas });

function itens(texto, minimo = 1, maximo = 30) {
  const lista = texto
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (lista.length < minimo) throw aviso(`Informe pelo menos ${minimo} item${minimo === 1 ? '' : 's'}.`);
  if (lista.length > maximo) throw aviso(`Use no máximo ${maximo} itens.`);
  return lista;
}

function listaMarcada(texto, marcador = '•') {
  return itens(texto).map((item) => `${marcador} ${item}`).join('\n');
}

function lerData(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw aviso('Use a data no formato AAAA-MM-DD.');
  const data = new Date(`${texto}T12:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) {
    throw aviso('A data informada não existe.');
  }
  return data;
}

const dataPt = (data) => data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const somarDias = (data, dias) => new Date(data.getTime() + dias * 86_400_000);

export default familia({
  name: 'planejar',
  description: 'Organiza reuniões, decisões, prioridades, riscos e planos de trabalho.',
  cooldown: 3,
  subs: [
    {
      name: 'pauta',
      description: 'Monta uma pauta de reunião com divisão objetiva do tempo.',
      options: [
        opt.texto('tema', 'Tema da reunião', true, { max: 200 }),
        opt.inteiro('duracao', 'Duração total em minutos', true, { min: 15, max: 480 }),
        opt.texto('objetivos', 'Objetivos separados por ponto e vírgula', false, { max: 1000 }),
      ],
      run: ({ tema, duracao, objetivos }) => {
        const abertura = Math.max(5, Math.round(duracao * 0.1));
        const encerramento = Math.max(5, Math.round(duracao * 0.1));
        const discussao = duracao - abertura - encerramento;
        return [
          `## Pauta — ${tema}`,
          `**Duração:** ${duracao} minutos`,
          objetivos ? `**Objetivos**\n${listaMarcada(objetivos)}` : null,
          '**Roteiro**',
          `1. Abertura e contexto — ${abertura} min`,
          `2. Discussão e decisões — ${discussao} min`,
          `3. Responsáveis e próximos passos — ${encerramento} min`,
        ].filter(Boolean).join('\n\n');
      },
    },
    {
      name: 'ata',
      description: 'Formata uma ata curta com decisões e responsáveis.',
      options: [
        opt.texto('titulo', 'Título da reunião', true, { max: 200 }),
        opt.texto('participantes', 'Participantes separados por vírgula', true, { max: 1000 }),
        opt.texto('decisoes', 'Decisões separadas por ponto e vírgula', false, { max: 1500 }),
        opt.texto('acoes', 'Ações separadas por ponto e vírgula', false, { max: 1500 }),
        opt.texto('observacoes', 'Observações adicionais', false, { max: 1000 }),
      ],
      run: ({ titulo, participantes, decisoes, acoes, observacoes }) => [
        `## Ata — ${titulo}`,
        `**Data:** ${new Date().toLocaleDateString('pt-BR')}`,
        `**Participantes:** ${itens(participantes).join(', ')}`,
        decisoes ? `**Decisões**\n${listaMarcada(decisoes)}` : '**Decisões:** nenhuma registrada.',
        acoes ? `**Ações**\n${listaMarcada(acoes, '- [ ]')}` : '**Ações:** nenhuma registrada.',
        observacoes ? `**Observações**\n${observacoes}` : null,
      ].filter(Boolean).join('\n\n'),
    },
    {
      name: 'retrospectiva',
      description: 'Organiza uma retrospectiva no formato iniciar, parar e continuar.',
      options: [
        opt.texto('iniciar', 'O que a equipe deve começar a fazer', true, { max: 1000 }),
        opt.texto('parar', 'O que a equipe deve deixar de fazer', true, { max: 1000 }),
        opt.texto('continuar', 'O que vale manter', true, { max: 1000 }),
      ],
      run: ({ iniciar, parar, continuar }) => [
        '## Retrospectiva',
        `**Iniciar**\n${listaMarcada(iniciar)}`,
        `**Parar**\n${listaMarcada(parar)}`,
        `**Continuar**\n${listaMarcada(continuar)}`,
      ].join('\n\n'),
    },
    {
      name: 'feedback',
      description: 'Estrutura um feedback com situação, comportamento e impacto.',
      options: [
        opt.usuario('pessoa', 'Pessoa que receberá o feedback', true),
        opt.texto('situacao', 'Contexto específico observado', true, { max: 500 }),
        opt.texto('comportamento', 'Comportamento observado, sem julgamento', true, { max: 700 }),
        opt.texto('impacto', 'Efeito concreto do comportamento', true, { max: 700 }),
        opt.texto('proximo-passo', 'Mudança ou continuidade esperada', false, { max: 700 }),
      ],
      run: ({ pessoa, situacao, comportamento, impacto, 'proximo-passo': proximoPasso }) => [
        `## Feedback para ${pessoa}`,
        `**Situação:** ${situacao}`,
        `**Comportamento observado:** ${comportamento}`,
        `**Impacto:** ${impacto}`,
        proximoPasso ? `**Próximo passo combinado:** ${proximoPasso}` : null,
      ].filter(Boolean).join('\n\n'),
    },
    {
      name: 'meta-smart',
      description: 'Organiza uma meta com resultado, medida, prazo e justificativa.',
      options: [
        opt.texto('objetivo', 'Resultado específico desejado', true, { max: 500 }),
        opt.texto('metrica', 'Como o avanço será medido', true, { max: 300 }),
        opt.texto('alvo', 'Valor ou condição de sucesso', true, { max: 200 }),
        opt.texto('prazo', 'Data ou período limite', true, { max: 100 }),
        opt.texto('motivo', 'Por que essa meta importa', false, { max: 500 }),
      ],
      run: ({ objetivo, metrica, alvo, prazo, motivo }) => [
        '## Meta',
        `**Objetivo:** ${objetivo}`,
        `**Métrica:** ${metrica}`,
        `**Alvo:** ${alvo}`,
        `**Prazo:** ${prazo}`,
        motivo ? `**Relevância:** ${motivo}` : null,
      ].filter(Boolean).join('\n'),
    },
    {
      name: 'plano-5w2h',
      description: 'Monta um plano de ação no formato 5W2H.',
      options: [
        opt.texto('acao', 'O que será feito', true, { max: 400 }),
        opt.texto('motivo', 'Por que será feito', true, { max: 400 }),
        opt.texto('responsavel', 'Quem ficará responsável', true, { max: 200 }),
        opt.texto('prazo', 'Quando será concluído', true, { max: 100 }),
        opt.texto('local', 'Onde será executado', false, { max: 200 }),
        opt.texto('metodo', 'Como será executado', false, { max: 600 }),
        opt.texto('custo', 'Custo estimado', false, { max: 100 }),
      ],
      run: ({ acao, motivo, responsavel, prazo, local, metodo, custo }) => [
        '## Plano 5W2H',
        `**O quê:** ${acao}`,
        `**Por quê:** ${motivo}`,
        `**Quem:** ${responsavel}`,
        `**Quando:** ${prazo}`,
        `**Onde:** ${local || 'a definir'}`,
        `**Como:** ${metodo || 'a definir'}`,
        `**Quanto:** ${custo || 'a definir'}`,
      ].join('\n'),
    },
    {
      name: 'matriz-risco',
      description: 'Classifica um risco pela probabilidade e pelo impacto.',
      options: [
        opt.texto('risco', 'Risco que será avaliado', true, { max: 400 }),
        opt.inteiro('probabilidade', 'Probabilidade de 1 a 5', true, { min: 1, max: 5 }),
        opt.inteiro('impacto', 'Impacto de 1 a 5', true, { min: 1, max: 5 }),
        opt.texto('mitigacao', 'Ação para reduzir o risco', false, { max: 700 }),
      ],
      run: ({ risco, probabilidade, impacto, mitigacao }) => {
        const pontuacao = probabilidade * impacto;
        const [nivel, resposta] =
          pontuacao <= 4
            ? ['baixo', 'Acompanhar durante a execução.']
            : pontuacao <= 9
              ? ['moderado', 'Definir uma medida preventiva.']
              : pontuacao <= 16
                ? ['alto', 'Tratar antes de avançar.']
                : ['crítico', 'Interromper e reduzir a exposição imediatamente.'];
        return [
          `## Risco ${nivel}`,
          `**Risco:** ${risco}`,
          `**Pontuação:** ${probabilidade} × ${impacto} = **${pontuacao}/25**`,
          `**Resposta recomendada:** ${resposta}`,
          mitigacao ? `**Mitigação informada:** ${mitigacao}` : null,
        ].filter(Boolean).join('\n\n');
      },
    },
    {
      name: 'priorizar',
      description: 'Classifica uma tarefa por urgência e importância.',
      options: [
        opt.texto('tarefa', 'Tarefa que será classificada', true, { max: 400 }),
        opt.inteiro('urgencia', 'Urgência de 1 a 5', true, { min: 1, max: 5 }),
        opt.inteiro('importancia', 'Importância de 1 a 5', true, { min: 1, max: 5 }),
      ],
      run: ({ tarefa, urgencia, importancia }) => {
        const urgente = urgencia >= 3;
        const importante = importancia >= 3;
        const decisao = importante && urgente
          ? 'Fazer agora.'
          : importante
            ? 'Agendar e proteger tempo para executar.'
            : urgente
              ? 'Delegar ou simplificar.'
              : 'Eliminar, adiar ou manter fora da fila principal.';
        return `## Prioridade\n**Tarefa:** ${tarefa}\n**Urgência:** ${urgencia}/5\n**Importância:** ${importancia}/5\n\n**Encaminhamento:** ${decisao}`;
      },
    },
    {
      name: 'pontuar-ice',
      description: 'Calcula uma pontuação ICE para comparar iniciativas.',
      options: [
        opt.texto('iniciativa', 'Nome da iniciativa', true, { max: 300 }),
        opt.numero('impacto', 'Impacto de 1 a 10', true, { min: 1, max: 10 }),
        opt.numero('confianca', 'Confiança de 1 a 10', true, { min: 1, max: 10 }),
        opt.numero('facilidade', 'Facilidade de 1 a 10', true, { min: 1, max: 10 }),
      ],
      run: ({ iniciativa, impacto, confianca, facilidade }) => {
        const pontuacao = impacto * confianca * facilidade;
        return `## Pontuação ICE\n**Iniciativa:** ${iniciativa}\n**Impacto:** ${formatar(impacto)}\n**Confiança:** ${formatar(confianca)}\n**Facilidade:** ${formatar(facilidade)}\n\n**Pontuação:** ${formatar(pontuacao, 1)}`;
      },
    },
    {
      name: 'pontuar-rice',
      description: 'Calcula uma pontuação RICE para comparar iniciativas.',
      options: [
        opt.texto('iniciativa', 'Nome da iniciativa', true, { max: 300 }),
        opt.inteiro('alcance', 'Pessoas ou eventos alcançados', true, { min: 1, max: 1_000_000 }),
        opt.numero('impacto', 'Impacto estimado de 0,1 a 10', true, { min: 0.1, max: 10 }),
        opt.inteiro('confianca', 'Confiança em porcentagem', true, { min: 1, max: 100 }),
        opt.numero('esforco', 'Esforço estimado, maior que zero', true, { min: 0.1, max: 1_000_000 }),
      ],
      run: ({ iniciativa, alcance, impacto, confianca, esforco }) => {
        const pontuacao = (alcance * impacto * (confianca / 100)) / esforco;
        return `## Pontuação RICE\n**Iniciativa:** ${iniciativa}\n**Alcance:** ${alcance.toLocaleString('pt-BR')}\n**Impacto:** ${formatar(impacto)}\n**Confiança:** ${confianca}%\n**Esforço:** ${formatar(esforco)}\n\n**Pontuação:** ${formatar(pontuacao)}`;
      },
    },
    {
      name: 'pros-contras',
      description: 'Organiza os argumentos favoráveis e contrários a uma decisão.',
      options: [
        opt.texto('decisao', 'Decisão que será analisada', true, { max: 400 }),
        opt.texto('pros', 'Pontos favoráveis separados por ponto e vírgula', true, { max: 1500 }),
        opt.texto('contras', 'Pontos contrários separados por ponto e vírgula', true, { max: 1500 }),
      ],
      run: ({ decisao, pros, contras }) => [
        `## Análise — ${decisao}`,
        `**Pontos favoráveis**\n${listaMarcada(pros, '+')}`,
        `**Pontos contrários**\n${listaMarcada(contras, '−')}`,
      ].join('\n\n'),
    },
    {
      name: 'matriz-swot',
      description: 'Organiza forças, fraquezas, oportunidades e ameaças.',
      options: [
        opt.texto('objetivo', 'Objeto da análise', true, { max: 300 }),
        opt.texto('forcas', 'Forças separadas por ponto e vírgula', true, { max: 1200 }),
        opt.texto('fraquezas', 'Fraquezas separadas por ponto e vírgula', true, { max: 1200 }),
        opt.texto('oportunidades', 'Oportunidades separadas por ponto e vírgula', true, { max: 1200 }),
        opt.texto('ameacas', 'Ameaças separadas por ponto e vírgula', true, { max: 1200 }),
      ],
      run: ({ objetivo, forcas, fraquezas, oportunidades, ameacas }) => [
        `## Matriz SWOT — ${objetivo}`,
        `**Forças**\n${listaMarcada(forcas)}`,
        `**Fraquezas**\n${listaMarcada(fraquezas)}`,
        `**Oportunidades**\n${listaMarcada(oportunidades)}`,
        `**Ameaças**\n${listaMarcada(ameacas)}`,
      ].join('\n\n'),
    },
    {
      name: 'briefing',
      description: 'Monta um briefing direto para uma entrega.',
      options: [
        opt.texto('entrega', 'O que deve ser entregue', true, { max: 400 }),
        opt.texto('objetivo', 'Resultado esperado', true, { max: 500 }),
        opt.texto('publico', 'Público ou usuário da entrega', true, { max: 300 }),
        opt.texto('requisitos', 'Requisitos separados por ponto e vírgula', true, { max: 1500 }),
        opt.texto('prazo', 'Prazo da entrega', false, { max: 100 }),
        opt.texto('formato', 'Formato esperado', false, { max: 200 }),
      ],
      run: ({ entrega, objetivo, publico, requisitos, prazo, formato }) => [
        `## Briefing — ${entrega}`,
        `**Objetivo:** ${objetivo}`,
        `**Público:** ${publico}`,
        `**Requisitos**\n${listaMarcada(requisitos)}`,
        prazo ? `**Prazo:** ${prazo}` : null,
        formato ? `**Formato:** ${formato}` : null,
      ].filter(Boolean).join('\n\n'),
    },
    {
      name: 'delegar',
      description: 'Registra uma delegação com resultado esperado e prazo.',
      options: [
        opt.texto('tarefa', 'Tarefa que será delegada', true, { max: 500 }),
        opt.usuario('responsavel', 'Pessoa responsável', true),
        opt.texto('resultado', 'Critério de conclusão', true, { max: 500 }),
        opt.texto('prazo', 'Prazo combinado', true, { max: 100 }),
        opt.texto('contexto', 'Contexto ou restrições relevantes', false, { max: 700 }),
      ],
      run: ({ tarefa, responsavel, resultado, prazo, contexto }) => [
        '## Delegação',
        `**Responsável:** ${responsavel}`,
        `**Tarefa:** ${tarefa}`,
        `**Concluída quando:** ${resultado}`,
        `**Prazo:** ${prazo}`,
        contexto ? `**Contexto:** ${contexto}` : null,
      ].filter(Boolean).join('\n'),
    },
    {
      name: 'checklist',
      description: 'Transforma uma lista em um checklist pronto para usar.',
      options: [
        opt.texto('titulo', 'Título do checklist', true, { max: 200 }),
        opt.texto('itens', 'Itens separados por ponto e vírgula', true, { max: 1800 }),
      ],
      run: ({ titulo, itens: texto }) => `## ${titulo}\n${listaMarcada(texto, '- [ ]')}`,
    },
    {
      name: 'cronograma',
      description: 'Distribui fases consecutivas entre uma data inicial e um total de dias.',
      options: [
        opt.texto('fases', 'Fases separadas por ponto e vírgula', true, { max: 1200 }),
        opt.inteiro('dias', 'Total de dias do cronograma', true, { min: 1, max: 3650 }),
        opt.texto('inicio', 'Data inicial em AAAA-MM-DD; o padrão é hoje', false, { max: 10 }),
      ],
      run: ({ fases, dias, inicio }) => {
        const lista = itens(fases, 1, 20);
        if (dias < lista.length) throw aviso('O total de dias não pode ser menor que o número de fases.');
        let cursor = inicio ? lerData(inicio) : new Date();
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), 12));
        const base = Math.floor(dias / lista.length);
        const extras = dias % lista.length;
        const linhas = lista.map((fase, indice) => {
          const duracao = base + (indice < extras ? 1 : 0);
          const fim = somarDias(cursor, duracao - 1);
          const linha = `**${indice + 1}. ${fase}** — ${dataPt(cursor)} a ${dataPt(fim)} (${duracao} dia${duracao === 1 ? '' : 's'})`;
          cursor = somarDias(fim, 1);
          return linha;
        });
        return `## Cronograma de ${dias} dias\n${linhas.join('\n')}`;
      },
    },
    {
      name: 'capacidade',
      description: 'Calcula a capacidade de trabalho disponível para um período.',
      options: [
        opt.inteiro('pessoas', 'Quantidade de pessoas', true, { min: 1, max: 10_000 }),
        opt.numero('horas-dia', 'Horas disponíveis por pessoa e por dia', true, { min: 0.1, max: 24 }),
        opt.inteiro('dias', 'Quantidade de dias úteis', true, { min: 1, max: 366 }),
        opt.inteiro('foco', 'Percentual realmente dedicado; padrão 80', false, { min: 1, max: 100 }),
      ],
      run: ({ pessoas, 'horas-dia': horasDia, dias, foco }) => {
        const percentual = foco ?? 80;
        const bruto = pessoas * horasDia * dias;
        const liquido = bruto * (percentual / 100);
        return `## Capacidade\n**Capacidade bruta:** ${formatar(bruto)} horas\n**Foco considerado:** ${percentual}%\n**Capacidade disponível:** ${formatar(liquido)} horas`;
      },
    },
    {
      name: 'quorum',
      description: 'Calcula quantas pessoas são necessárias para atingir um quórum.',
      options: [
        opt.inteiro('participantes', 'Total de participantes elegíveis', true, { min: 1, max: 1_000_000 }),
        opt.numero('percentual', 'Percentual mínimo exigido', true, { min: 0.01, max: 100 }),
      ],
      run: ({ participantes, percentual }) => {
        const minimo = Math.ceil(participantes * (percentual / 100));
        return `## Quórum\n**Mínimo necessário:** ${minimo.toLocaleString('pt-BR')} de ${participantes.toLocaleString('pt-BR')} participantes\n**Ausências possíveis:** ${(participantes - minimo).toLocaleString('pt-BR')}\n**Regra:** ${formatar(percentual)}%`;
      },
    },
    {
      name: 'agenda-tempo',
      description: 'Divide o tempo de uma reunião igualmente entre os assuntos.',
      options: [
        opt.texto('assuntos', 'Assuntos separados por ponto e vírgula', true, { max: 1500 }),
        opt.inteiro('duracao', 'Duração total em minutos', true, { min: 1, max: 1440 }),
      ],
      run: ({ assuntos, duracao }) => {
        const lista = itens(assuntos, 1, 30);
        const base = Math.floor(duracao / lista.length);
        const extras = duracao % lista.length;
        if (base === 0) throw aviso('A duração precisa ter pelo menos um minuto por assunto.');
        return `## Distribuição de ${duracao} minutos\n${lista
          .map((assunto, indice) => `**${indice + 1}. ${assunto}** — ${base + (indice < extras ? 1 : 0)} min`)
          .join('\n')}`;
      },
    },
    {
      name: 'carga-trabalho',
      description: 'Soma horas de tarefas e calcula a carga média por pessoa.',
      options: [
        opt.texto('tarefas', 'Use tarefa|horas e separe as entradas por ponto e vírgula', true, { max: 1800 }),
        opt.inteiro('pessoas', 'Quantidade de pessoas disponíveis', true, { min: 1, max: 10_000 }),
      ],
      run: ({ tarefas, pessoas }) => {
        const entradas = itens(tarefas, 1, 30).map((entrada) => {
          const [nome, horasTexto] = entrada.split('|').map((parte) => parte?.trim());
          const horas = Number(horasTexto?.replace(',', '.'));
          if (!nome || Number.isFinite(horas) === false || horas <= 0) {
            throw aviso('Use o formato `tarefa|horas`; exemplo: Revisão|3; Testes|5.');
          }
          return { nome, horas };
        });
        const total = entradas.reduce((soma, entrada) => soma + entrada.horas, 0);
        return [
          '## Carga de trabalho',
          entradas.map((entrada) => `• ${entrada.nome}: ${formatar(entrada.horas)} h`).join('\n'),
          `**Total:** ${formatar(total)} h`,
          `**Média por pessoa:** ${formatar(total / pessoas)} h`,
        ].join('\n\n');
      },
    },
    {
      name: 'pre-mortem',
      description: 'Cria um roteiro para antecipar falhas antes de iniciar um projeto.',
      options: [
        opt.texto('projeto', 'Projeto ou decisão que será analisado', true, { max: 400 }),
        opt.texto('prazo', 'Prazo ou marco principal', false, { max: 100 }),
      ],
      run: ({ projeto, prazo }) => [
        `## Pré-mortem — ${projeto}`,
        prazo ? `**Marco analisado:** ${prazo}` : null,
        '**Cenário:** o projeto falhou. Responda antes de começar:',
        '1. Qual causa interna provavelmente levou à falha?',
        '2. Qual dependência externa foi subestimada?',
        '3. Que sinal de alerta poderia aparecer cedo?',
        '4. Qual medida preventiva cabe no plano agora?',
        '5. Quem acompanhará cada risco prioritário?',
      ].filter(Boolean).join('\n\n'),
    },
    {
      name: 'scamper',
      description: 'Gera perguntas do método SCAMPER para explorar uma ideia.',
      options: [opt.texto('tema', 'Produto, processo ou ideia', true, { max: 400 })],
      run: ({ tema }) => [
        `## SCAMPER — ${tema}`,
        '**Substituir:** o que pode ser trocado sem perder valor?',
        '**Combinar:** quais partes funcionariam melhor juntas?',
        '**Adaptar:** que solução de outro contexto pode ser aproveitada?',
        '**Modificar:** o que pode ser ampliado, reduzido ou reorganizado?',
        '**Propor outro uso:** quem mais poderia se beneficiar?',
        '**Eliminar:** o que acrescenta custo sem resultado?',
        '**Reordenar:** o que muda se a sequência for invertida?',
      ].join('\n'),
    },
    {
      name: 'acordo-equipe',
      description: 'Formata os acordos de funcionamento de uma equipe.',
      options: [
        opt.texto('titulo', 'Nome da equipe ou do projeto', true, { max: 200 }),
        opt.texto('acordos', 'Acordos separados por ponto e vírgula', true, { max: 1800 }),
      ],
      run: ({ titulo, acordos }) => `## Acordos — ${titulo}\n${listaMarcada(acordos, '- [ ]')}`,
    },
    {
      name: 'resumo-executivo',
      description: 'Estrutura contexto, decisão, impacto e próximos passos.',
      options: [
        opt.texto('contexto', 'Situação que motivou a decisão', true, { max: 800 }),
        opt.texto('decisao', 'Decisão tomada ou recomendada', true, { max: 800 }),
        opt.texto('impacto', 'Resultado ou efeito esperado', true, { max: 800 }),
        opt.texto('proximos-passos', 'Ações separadas por ponto e vírgula', true, { max: 1200 }),
      ],
      run: ({ contexto, decisao, impacto, 'proximos-passos': proximosPassos }) => [
        '## Resumo executivo',
        `**Contexto:** ${contexto}`,
        `**Decisão:** ${decisao}`,
        `**Impacto esperado:** ${impacto}`,
        `**Próximos passos**\n${listaMarcada(proximosPassos, '- [ ]')}`,
      ].join('\n\n'),
    },
    {
      name: 'plano-comunicacao',
      description: 'Organiza uma comunicação por público, canal e frequência.',
      options: [
        opt.texto('publico', 'Público da comunicação', true, { max: 300 }),
        opt.texto('mensagem', 'Mensagem principal', true, { max: 800 }),
        opt.texto('canal', 'Canal ou meio utilizado', true, { max: 200 }),
        opt.texto('frequencia', 'Quando ou com que frequência comunicar', true, { max: 200 }),
        opt.texto('responsavel', 'Pessoa responsável', false, { max: 200 }),
      ],
      run: ({ publico, mensagem, canal, frequencia, responsavel }) => [
        '## Plano de comunicação',
        `**Público:** ${publico}`,
        `**Mensagem principal:** ${mensagem}`,
        `**Canal:** ${canal}`,
        `**Frequência:** ${frequencia}`,
        `**Responsável:** ${responsavel || 'a definir'}`,
      ].join('\n'),
    },
  ],
});
