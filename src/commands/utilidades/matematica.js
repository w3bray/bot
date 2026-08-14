import { aviso, bloco, familia, opt } from '../../lib/familia.js';

const N = (name, description, extra = {}) => opt.numero(name, description, true, extra);
const I = (name, description, extra = {}) => opt.inteiro(name, description, true, extra);

const fmt = (n) => {
  if (!Number.isFinite(n)) throw aviso('O resultado não é um número válido.');
  return Number(n.toFixed(10)).toLocaleString('pt-BR', { maximumFractionDigits: 10 });
};

const lista = (texto) => {
  const numeros = texto
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((v) => Number(v.replace(',', '.')));
  if (numeros.length === 0 || numeros.some((n) => !Number.isFinite(n))) {
    throw aviso('Mande números separados por espaço ou vírgula. Ex.: `4 8 15 16 23 42`');
  }
  if (numeros.length > 500) throw aviso('São no máximo 500 números.');
  return numeros;
};

const NUMEROS = opt.texto('numeros', 'Números separados por espaço ou vírgula', true, { max: 1500 });

const mdc = (a, b) => (b === 0 ? Math.abs(a) : mdc(b, a % b));

const ehPrimo = (n) => {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
};

/**
 * Avaliador de expressão aritmética.
 *
 * Escrito à mão de propósito: `eval` numa string vinda do Discord executaria
 * qualquer coisa que um usuário digitasse dentro do processo do bot. Aqui só
 * existem números e cinco operadores — nada mais é sequer reconhecido.
 */
function avaliar(expressao) {
  const tokens = expressao.match(/\d+\.?\d*|[+\-*/%^()]|\s+/g);
  if (!tokens || tokens.join('') !== expressao) {
    throw aviso('Use apenas números e os operadores `+ - * / % ^ ( )`.');
  }

  const limpos = tokens.filter((t) => t.trim());
  let posicao = 0;
  const olhar = () => limpos[posicao];
  const consumir = () => limpos[posicao++];

  const primario = () => {
    const token = consumir();
    if (token === '(') {
      const valor = soma();
      if (consumir() !== ')') throw aviso('Faltou fechar um parêntese.');
      return valor;
    }
    if (token === '-') return -primario();
    const numero = Number(token);
    if (!Number.isFinite(numero)) throw aviso('Expressão malformada.');
    return numero;
  };

  const potencia = () => {
    const base = primario();
    if (olhar() === '^') {
      consumir();
      return base ** potencia(); // associativo à direita, como em matemática
    }
    return base;
  };

  const produto = () => {
    let valor = potencia();
    while (['*', '/', '%'].includes(olhar())) {
      const operador = consumir();
      const direita = potencia();
      if ((operador === '/' || operador === '%') && direita === 0) {
        throw aviso('Divisão por zero.');
      }
      valor = operador === '*' ? valor * direita : operador === '/' ? valor / direita : valor % direita;
    }
    return valor;
  };

  function soma() {
    let valor = produto();
    while (['+', '-'].includes(olhar())) {
      const operador = consumir();
      valor = operador === '+' ? valor + produto() : valor - produto();
    }
    return valor;
  }

  const resultado = soma();
  if (posicao !== limpos.length) throw aviso('Sobrou coisa na expressão. Confira os parênteses.');
  return resultado;
}

export default familia({
  name: 'matematica',
  description: 'Contas, estatística, números primos e conversões numéricas.',
  cooldown: 3,
  subs: [
    {
      name: 'calcular',
      description: 'Resolve uma expressão, como 2 + 3 × (4 - 1)².',
      options: [opt.texto('expressao', 'A conta', true, { max: 200 })],
      run: ({ expressao }) => `\`${expressao}\` = **${fmt(avaliar(expressao))}**`,
    },
    {
      name: 'porcentagem',
      description: 'Quanto é X% de Y.',
      options: [N('porcentagem', 'A porcentagem'), N('valor', 'O valor')],
      run: ({ porcentagem, valor }) =>
        `**${fmt(porcentagem)}%** de **${fmt(valor)}** = **${fmt((porcentagem / 100) * valor)}**`,
    },
    {
      name: 'porcentagem-de',
      description: 'X é quantos por cento de Y.',
      options: [N('parte', 'A parte'), N('total', 'O total')],
      run: ({ parte, total }) => {
        if (total === 0) throw aviso('O total não pode ser zero.');
        return `**${fmt(parte)}** é **${fmt((parte / total) * 100)}%** de **${fmt(total)}**`;
      },
    },
    {
      name: 'variacao',
      description: 'Variação percentual entre dois valores.',
      options: [N('de', 'Valor inicial'), N('para', 'Valor final')],
      run: ({ de, para }) => {
        if (de === 0) throw aviso('O valor inicial não pode ser zero.');
        const variacao = ((para - de) / Math.abs(de)) * 100;
        const seta = variacao > 0 ? '📈 aumento' : variacao < 0 ? '📉 queda' : '➡️ sem mudança';
        return `De **${fmt(de)}** para **${fmt(para)}**\n${seta} de **${fmt(Math.abs(variacao))}%**`;
      },
    },
    {
      name: 'media',
      description: 'Média, mediana, moda e desvio padrão.',
      options: [NUMEROS],
      run: ({ numeros }) => {
        const valores = lista(numeros);
        const n = valores.length;
        const soma = valores.reduce((a, b) => a + b, 0);
        const media = soma / n;
        const ordenados = [...valores].sort((a, b) => a - b);
        const meio = Math.floor(n / 2);
        const mediana = n % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;

        const contagem = new Map();
        for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1);
        const maior = Math.max(...contagem.values());
        const moda = maior === 1 ? 'nenhuma' : [...contagem.entries()].filter(([, c]) => c === maior).map(([v]) => fmt(v)).join(', ');

        const variancia = valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / n;

        return [
          `**${n}** números · soma **${fmt(soma)}**`,
          `Média: **${fmt(media)}**`,
          `Mediana: **${fmt(mediana)}**`,
          `Moda: **${moda}**`,
          `Desvio padrão: **${fmt(Math.sqrt(variancia))}**`,
          `Mínimo: **${fmt(ordenados[0])}** · Máximo: **${fmt(ordenados[n - 1])}**`,
        ].join('\n');
      },
    },
    {
      name: 'somar',
      description: 'Soma uma lista de números.',
      options: [NUMEROS],
      run: ({ numeros }) => {
        const valores = lista(numeros);
        return `Soma de **${valores.length}** números = **${fmt(valores.reduce((a, b) => a + b, 0))}**`;
      },
    },
    {
      name: 'raiz',
      description: 'Raiz de qualquer índice.',
      options: [N('numero', 'O número'), I('indice', 'Índice (2 = raiz quadrada)', { min: 2, max: 50 })],
      run: ({ numero, indice }) => {
        if (numero < 0 && indice % 2 === 0) throw aviso('Não existe raiz par de número negativo.');
        const resultado = numero < 0 ? -((-numero) ** (1 / indice)) : numero ** (1 / indice);
        return `Raiz de índice **${indice}** de **${fmt(numero)}** = **${fmt(resultado)}**`;
      },
    },
    {
      name: 'potencia',
      description: 'Eleva um número a um expoente.',
      options: [N('base', 'A base'), N('expoente', 'O expoente')],
      run: ({ base, expoente }) => `**${fmt(base)}** elevado a **${fmt(expoente)}** = **${fmt(base ** expoente)}**`,
    },
    {
      name: 'fatorial',
      description: 'Fatorial de um número.',
      options: [I('numero', 'De 0 a 170', { min: 0, max: 170 })],
      run: ({ numero }) => {
        let resultado = 1;
        for (let i = 2; i <= numero; i += 1) resultado *= i;
        return `**${numero}!** = **${resultado.toLocaleString('pt-BR')}**`;
      },
    },
    {
      name: 'primo',
      description: 'Diz se um número é primo e mostra seus divisores.',
      options: [I('numero', 'O número', { min: 1, max: 10_000_000 })],
      run: ({ numero }) => {
        if (ehPrimo(numero)) return `**${numero}** é **primo**. ✅`;
        const divisores = [];
        for (let i = 1; i * i <= numero; i += 1) {
          if (numero % i === 0) {
            divisores.push(i);
            if (i !== numero / i) divisores.push(numero / i);
          }
        }
        divisores.sort((a, b) => a - b);
        return `**${numero}** **não** é primo.\nDivisores (${divisores.length}): \`${divisores.slice(0, 40).join(', ')}${divisores.length > 40 ? '…' : ''}\``;
      },
    },
    {
      name: 'fatorar',
      description: 'Decompõe o número em fatores primos.',
      options: [I('numero', 'De 2 a 10 milhões', { min: 2, max: 10_000_000 })],
      run: ({ numero }) => {
        let resto = numero;
        const fatores = [];
        for (let divisor = 2; divisor * divisor <= resto; divisor += 1) {
          while (resto % divisor === 0) {
            fatores.push(divisor);
            resto /= divisor;
          }
        }
        if (resto > 1) fatores.push(resto);
        const agrupados = new Map();
        for (const f of fatores) agrupados.set(f, (agrupados.get(f) ?? 0) + 1);
        const texto = [...agrupados.entries()]
          .map(([base, exp]) => (exp === 1 ? `${base}` : `${base}^${exp}`))
          .join(' × ');
        return `**${numero}** = **${texto}**`;
      },
    },
    {
      name: 'mdc',
      description: 'Máximo divisor comum entre números.',
      options: [NUMEROS],
      run: ({ numeros }) => {
        const valores = lista(numeros).map((n) => Math.round(n));
        return `MDC(${valores.join(', ')}) = **${valores.reduce((a, b) => mdc(a, b))}**`;
      },
    },
    {
      name: 'mmc',
      description: 'Mínimo múltiplo comum entre números.',
      options: [NUMEROS],
      run: ({ numeros }) => {
        const valores = lista(numeros).map((n) => Math.round(n));
        if (valores.some((v) => v === 0)) throw aviso('O MMC não existe com zero na lista.');
        const resultado = valores.reduce((a, b) => Math.abs(a * b) / mdc(a, b));
        return `MMC(${valores.join(', ')}) = **${resultado.toLocaleString('pt-BR')}**`;
      },
    },
    {
      name: 'fibonacci',
      description: 'Mostra os N primeiros números de Fibonacci.',
      options: [I('quantidade', 'Até 60 termos', { min: 1, max: 60 })],
      run: ({ quantidade }) => {
        const serie = [0, 1].slice(0, quantidade);
        while (serie.length < quantidade) serie.push(serie.at(-1) + serie.at(-2));
        return bloco(serie.join(', '));
      },
    },
    {
      name: 'equacao-segundo-grau',
      description: 'Resolve ax² + bx + c = 0.',
      options: [N('a', 'Coeficiente a'), N('b', 'Coeficiente b'), N('c', 'Coeficiente c')],
      run: ({ a, b, c }) => {
        if (a === 0) throw aviso('Com a = 0 não é equação do segundo grau.');
        const delta = b * b - 4 * a * c;
        const cabecalho = `**${fmt(a)}x² + ${fmt(b)}x + ${fmt(c)} = 0**\nΔ = **${fmt(delta)}**`;
        if (delta < 0) return `${cabecalho}\n\nΔ < 0 — não há raízes reais.`;
        if (delta === 0) return `${cabecalho}\n\nUma raiz dupla: **x = ${fmt(-b / (2 * a))}**`;
        const raiz = Math.sqrt(delta);
        return `${cabecalho}\n\n**x₁ = ${fmt((-b + raiz) / (2 * a))}**\n**x₂ = ${fmt((-b - raiz) / (2 * a))}**`;
      },
    },
    {
      name: 'regra-de-tres',
      description: 'Se A está para B, C está para quanto.',
      options: [N('a', 'Valor A'), N('b', 'Valor B'), N('c', 'Valor C')],
      run: ({ a, b, c }) => {
        if (a === 0) throw aviso('O valor A não pode ser zero.');
        return `Se **${fmt(a)}** → **${fmt(b)}**, então **${fmt(c)}** → **${fmt((b * c) / a)}**`;
      },
    },
    {
      name: 'juros-simples',
      description: 'Calcula juros simples.',
      options: [
        N('capital', 'Valor inicial'),
        N('taxa', 'Taxa por período, em %'),
        I('periodos', 'Quantos períodos', { min: 1, max: 1200 }),
      ],
      run: ({ capital, taxa, periodos }) => {
        const juros = capital * (taxa / 100) * periodos;
        return `Capital **${fmt(capital)}** · **${fmt(taxa)}%** por período · **${periodos}** períodos\n\nJuros: **${fmt(juros)}**\nTotal: **${fmt(capital + juros)}**`;
      },
    },
    {
      name: 'juros-compostos',
      description: 'Calcula juros compostos.',
      options: [
        N('capital', 'Valor inicial'),
        N('taxa', 'Taxa por período, em %'),
        I('periodos', 'Quantos períodos', { min: 1, max: 1200 }),
      ],
      run: ({ capital, taxa, periodos }) => {
        const total = capital * (1 + taxa / 100) ** periodos;
        return `Capital **${fmt(capital)}** · **${fmt(taxa)}%** por período · **${periodos}** períodos\n\nJuros: **${fmt(total - capital)}**\nTotal: **${fmt(total)}**`;
      },
    },
    {
      name: 'arredondar',
      description: 'Arredonda com o número de casas que você quiser.',
      options: [N('numero', 'O número'), I('casas', 'Casas decimais', { min: 0, max: 10 })],
      run: ({ numero, casas }) =>
        `**${fmt(numero)}** → **${numero.toFixed(casas).replace('.', ',')}**`,
    },
    {
      name: 'combinacao',
      description: 'Quantas combinações e arranjos de N elementos tomados P a P.',
      options: [
        I('total', 'Total de elementos (n)', { min: 1, max: 170 }),
        I('escolhidos', 'Quantos escolher (p)', { min: 0, max: 170 }),
      ],
      run: ({ total, escolhidos }) => {
        if (escolhidos > total) throw aviso('Não dá para escolher mais elementos do que existem.');
        // Produto acumulado em vez de três fatoriais: n! estoura o ponto
        // flutuante bem antes de C(n,p), que costuma caber com folga.
        let combinacoes = 1;
        for (let i = 1; i <= escolhidos; i += 1) combinacoes = (combinacoes * (total - escolhidos + i)) / i;
        let arranjos = 1;
        for (let i = 0; i < escolhidos; i += 1) arranjos *= total - i;
        return [
          `**C(${total}, ${escolhidos})** = **${fmt(Math.round(combinacoes))}** combinações _(a ordem não importa)_`,
          `**A(${total}, ${escolhidos})** = **${fmt(Math.round(arranjos))}** arranjos _(a ordem importa)_`,
        ].join('\n');
      },
    },
    {
      name: 'imc',
      description: 'Índice de massa corporal.',
      options: [N('peso', 'Peso em kg', { min: 1, max: 500 }), N('altura', 'Altura em metros', { min: 0.5, max: 2.8 })],
      run: ({ peso, altura }) => {
        const imc = peso / altura ** 2;
        const faixa =
          imc < 18.5 ? 'abaixo do peso' :
          imc < 25 ? 'peso normal' :
          imc < 30 ? 'sobrepeso' :
          imc < 35 ? 'obesidade grau I' :
          imc < 40 ? 'obesidade grau II' : 'obesidade grau III';
        return `IMC: **${fmt(imc)}** — ${faixa}\n\n_O IMC é uma referência genérica e não substitui avaliação profissional._`;
      },
    },
  ],
});
