import { aviso, familia, opt } from '../../lib/familia.js';
import { rotuloPtBr } from '../../lib/localizacao.js';

/**
 * Conversão por fator para uma unidade de referência.
 *
 * Guardar só o fator até a unidade-base transforma N×N pares possíveis em N
 * números: converter é dividir pelo fator da origem e multiplicar pelo do
 * destino. Temperatura fica de fora dessa regra porque as escalas têm zeros
 * diferentes, então ela tem função própria.
 */
const TABELAS = {
  distancia: {
    base: 'metro',
    unidades: {
      milimetro: 0.001, centimetro: 0.01, metro: 1, quilometro: 1000,
      polegada: 0.0254, pe: 0.3048, jarda: 0.9144, milha: 1609.344, milha_nautica: 1852,
    },
  },
  peso: {
    base: 'grama',
    unidades: {
      miligrama: 0.001, grama: 1, quilograma: 1000, tonelada: 1e6,
      onca: 28.349523125, libra: 453.59237, arroba: 15000,
    },
  },
  volume: {
    base: 'litro',
    unidades: {
      mililitro: 0.001, litro: 1, metro_cubico: 1000,
      galao_us: 3.785411784, galao_uk: 4.54609, xicara: 0.24, colher_sopa: 0.015,
    },
  },
  area: {
    base: 'metro_quadrado',
    unidades: {
      centimetro_quadrado: 0.0001, metro_quadrado: 1, quilometro_quadrado: 1e6,
      hectare: 10000, acre: 4046.8564224, alqueire_paulista: 24200,
    },
  },
  velocidade: {
    base: 'metro_por_segundo',
    unidades: {
      metro_por_segundo: 1, quilometro_por_hora: 1 / 3.6, milha_por_hora: 0.44704,
      no: 0.514444, mach: 343,
    },
  },
  tempo: {
    base: 'segundo',
    unidades: {
      milissegundo: 0.001, segundo: 1, minuto: 60, hora: 3600,
      dia: 86400, semana: 604800, mes: 2629800, ano: 31557600,
    },
  },
  dados: {
    base: 'byte',
    unidades: {
      bit: 0.125, byte: 1, kilobyte: 1000, megabyte: 1e6, gigabyte: 1e9, terabyte: 1e12,
      kibibyte: 1024, mebibyte: 1024 ** 2, gibibyte: 1024 ** 3, tebibyte: 1024 ** 4,
    },
  },
  energia: {
    base: 'joule',
    unidades: {
      joule: 1, quilojoule: 1000, caloria: 4.184, quilocaloria: 4184,
      watt_hora: 3600, quilowatt_hora: 3.6e6,
    },
  },
  angulo: {
    base: 'grau',
    unidades: { grau: 1, radiano: 57.29577951308232, grado: 0.9, volta: 360, minuto_de_arco: 1 / 60 },
  },
  frequencia: {
    base: 'hertz',
    unidades: { hertz: 1, quilohertz: 1000, megahertz: 1e6, gigahertz: 1e9, rpm: 1 / 60 },
  },
  taxa: {
    base: 'bit_por_segundo',
    unidades: {
      bit_por_segundo: 1, kilobit_por_segundo: 1000, megabit_por_segundo: 1e6,
      gigabit_por_segundo: 1e9, megabyte_por_segundo: 8e6,
    },
  },
  cozinha: {
    base: 'mililitro',
    unidades: {
      mililitro: 1, colher_de_cha: 5, colher_de_sopa: 15, xicara: 240,
      copo_americano: 200, litro: 1000,
    },
  },
  pressao: {
    base: 'pascal',
    unidades: { pascal: 1, quilopascal: 1000, bar: 100000, atmosfera: 101325, psi: 6894.757, mmhg: 133.322 },
  },
};

const rotulo = (nome) => rotuloPtBr(nome);

const escolhas = (categoria) =>
  Object.keys(TABELAS[categoria].unidades)
    .slice(0, 25)
    .map((u) => ({ name: rotulo(u), value: u }));

const formatar = (n) => {
  if (!Number.isFinite(n)) throw aviso('O resultado não é um número válido.');
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 0.001 || abs >= 1e15)) return n.toExponential(6);
  return Number(n.toFixed(6)).toLocaleString('pt-BR', { maximumFractionDigits: 6 });
};

function conversor(categoria, descricao) {
  return {
    name: categoria,
    description: descricao,
    options: [
      opt.numero('valor', 'O valor a converter'),
      { kind: 'string', name: 'de', description: 'Unidade de origem', required: true, choices: escolhas(categoria) },
      { kind: 'string', name: 'para', description: 'Unidade de destino', required: true, choices: escolhas(categoria) },
    ],
    run: ({ valor, de, para }) => {
      const { unidades } = TABELAS[categoria];
      const resultado = (valor * unidades[de]) / unidades[para];
      return `**${formatar(valor)}** ${rotulo(de)} = **${formatar(resultado)}** ${rotulo(para)}`;
    },
  };
}

const ROMANOS = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];


const CONSUMO = [
  { name: 'km por litro', value: 'kml' },
  { name: 'milhas por galão (mpg)', value: 'mpg' },
  { name: 'litros por 100 km', value: 'l100' },
];

const SAPATO = [
  { name: 'Brasil', value: 'br' },
  { name: 'Europa', value: 'eu' },
  { name: 'Estados Unidos', value: 'us' },
];

const UNIDADES_EXTENSO = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez',
  'onze','doze','treze','catorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
const DEZENAS_EXTENSO = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
const CENTENAS_EXTENSO = ['','cento','duzentos','trezentos','quatrocentos','quinhentos',
  'seiscentos','setecentos','oitocentos','novecentos'];

/** Número por extenso em português, até a casa dos milhões. */
function porExtenso(n) {
  if (n < 20) return UNIDADES_EXTENSO[n];
  if (n < 100) {
    const dezena = DEZENAS_EXTENSO[Math.floor(n / 10)];
    return n % 10 === 0 ? dezena : `${dezena} e ${UNIDADES_EXTENSO[n % 10]}`;
  }
  if (n === 100) return 'cem';
  if (n < 1000) {
    const centena = CENTENAS_EXTENSO[Math.floor(n / 100)];
    return n % 100 === 0 ? centena : `${centena} e ${porExtenso(n % 100)}`;
  }
  for (const [limite, singular, plural] of [[1e6, 'um milhão', 'milhões'], [1000, 'mil', 'mil']]) {
    if (n >= limite) {
      const quantos = Math.floor(n / limite);
      const resto = n % limite;
      const cabeca = limite === 1000
        ? (quantos === 1 ? 'mil' : `${porExtenso(quantos)} mil`)
        : (quantos === 1 ? singular : `${porExtenso(quantos)} ${plural}`);
      if (resto === 0) return cabeca;
      // "e" antes de resto menor que 100 ou múltiplo de 100; vírgula no resto.
      const ligacao = resto < 100 || resto % 100 === 0 ? ' e ' : ' ';
      return `${cabeca}${ligacao}${porExtenso(resto)}`;
    }
  }
  return String(n);
}

export default familia({
  name: 'converter',
  // Promovidos a comando de topo: saem da família e viram /nome direto.
  atalhos: ['temperatura', 'distancia', 'peso', 'romano', 'extenso', 'dinheiro'],
  description: 'Converte unidades de medida, bases numéricas e formatos.',
  cooldown: 3,
  subs: [
    conversor('distancia', 'Converte distâncias entre metros, milhas, pés e polegadas.'),
    conversor('peso', 'Converte massas entre gramas, quilos, libras e arrobas.'),
    conversor('volume', 'Litros, galões, xícaras…'),
    conversor('area', 'Metros quadrados, hectares, acres, alqueires…'),
    conversor('velocidade', 'Converte km/h, m/s, milhas por hora, nós e mach.'),
    conversor('tempo', 'Segundos, horas, dias, meses, anos…'),
    conversor('dados', 'Bytes, megabytes, gibibytes…'),
    conversor('energia', 'Joules, calorias, quilowatt-hora…'),
    conversor('pressao', 'Pascal, bar, atmosfera, psi…'),
    {
      name: 'temperatura',
      description: 'Converte temperaturas entre Celsius, Fahrenheit e Kelvin.',
      options: [
        opt.numero('valor', 'O valor a converter'),
        {
          kind: 'string', name: 'de', description: 'Escala de origem', required: true,
          choices: [
            { name: 'Celsius', value: 'c' },
            { name: 'Fahrenheit', value: 'f' },
            { name: 'Kelvin', value: 'k' },
          ],
        },
        {
          kind: 'string', name: 'para', description: 'Escala de destino', required: true,
          choices: [
            { name: 'Celsius', value: 'c' },
            { name: 'Fahrenheit', value: 'f' },
            { name: 'Kelvin', value: 'k' },
          ],
        },
      ],
      run: ({ valor, de, para }) => {
        // Passa por Celsius como pivô: as escalas têm zeros diferentes, então
        // não dá para usar a tabela de fatores das outras conversões.
        const celsius = de === 'c' ? valor : de === 'f' ? (valor - 32) / 1.8 : valor - 273.15;
        if (celsius < -273.15) throw aviso('Isso está abaixo do zero absoluto (−273,15 °C).');
        const saida = para === 'c' ? celsius : para === 'f' ? celsius * 1.8 + 32 : celsius + 273.15;
        const nome = { c: '°C', f: '°F', k: 'K' };
        return `**${formatar(valor)}${nome[de]}** = **${formatar(saida)}${nome[para]}**`;
      },
    },
    {
      name: 'base',
      description: 'Converte um número entre bases (2 a 36).',
      options: [
        opt.texto('numero', 'O número', true, { max: 60 }),
        opt.inteiro('de', 'Base de origem', true, { min: 2, max: 36 }),
        opt.inteiro('para', 'Base de destino', true, { min: 2, max: 36 }),
      ],
      run: ({ numero, de, para }) => {
        const valor = parseInt(numero.trim(), de);
        if (Number.isNaN(valor)) throw aviso(`\`${numero}\` não é um número válido na base ${de}.`);
        return `\`${numero.trim().toUpperCase()}\` (base ${de}) = \`${valor.toString(para).toUpperCase()}\` (base ${para})\n\nEm decimal: **${valor.toLocaleString('pt-BR')}**`;
      },
    },
    {
      name: 'romano',
      description: 'Converte um número decimal em algarismo romano.',
      options: [opt.inteiro('numero', 'De 1 a 3999', true, { min: 1, max: 3999 })],
      run: ({ numero }) => {
        let resto = numero;
        let saida = '';
        for (const [valor, letra] of ROMANOS) {
          while (resto >= valor) {
            saida += letra;
            resto -= valor;
          }
        }
        return `**${numero}** = **${saida}**`;
      },
    },
    {
      name: 'romano-inverso',
      description: 'Algarismo romano para número comum.',
      options: [opt.texto('romano', 'Ex.: MCMXCIV', true, { max: 20 })],
      run: ({ romano }) => {
        const texto = romano.trim().toUpperCase();
        if (!/^[MDCLXVI]+$/.test(texto)) throw aviso('Use só as letras M, D, C, L, X, V e I.');
        const valores = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        let total = 0;
        for (let i = 0; i < texto.length; i += 1) {
          const atual = valores[texto[i]];
          const proximo = valores[texto[i + 1]] ?? 0;
          total += atual < proximo ? -atual : atual;
        }
        return `**${texto}** = **${total.toLocaleString('pt-BR')}**`;
      },
    },
    conversor('angulo', 'Graus, radianos e grados.'),
    conversor('frequencia', 'Hertz, quilohertz, megahertz, gigahertz.'),
    conversor('taxa', 'Velocidade de conexão: bps, Kbps, Mbps, Gbps.'),
    conversor('cozinha', 'Xícaras, colheres, mililitros — medidas de receita.'),
    {
      name: 'combustivel',
      description: 'Converte km/l, milhas por galão e litros por 100 km.',
      options: [
        opt.numero('valor', 'O consumo'),
        { kind: 'string', name: 'de', description: 'Unidade de origem', required: true, choices: CONSUMO },
        { kind: 'string', name: 'para', description: 'Unidade de destino', required: true, choices: CONSUMO },
      ],
      run: ({ valor, de, para }) => {
        if (valor <= 0) throw aviso('O consumo precisa ser maior que zero.');
        // km/l é o pivô. l/100km é inverso, então a conversão não é um fator
        // simples: precisa dividir em vez de multiplicar nos dois sentidos.
        const kmPorLitro = de === 'kml' ? valor : de === 'mpg' ? valor * 0.425144 : 100 / valor;
        const saida = para === 'kml' ? kmPorLitro : para === 'mpg' ? kmPorLitro / 0.425144 : 100 / kmPorLitro;
        const nome = { kml: 'km/l', mpg: 'mpg', l100: 'l/100km' };
        return `**${formatar(valor)} ${nome[de]}** = **${formatar(saida)} ${nome[para]}**`;
      },
    },
    {
      name: 'sapato',
      description: 'Converte numeração de calçado entre BR, EU e US.',
      options: [
        opt.numero('numero', 'O número do calçado', true, { min: 15, max: 60 }),
        { kind: 'string', name: 'de', description: 'Tabela de origem', required: true, choices: SAPATO },
        { kind: 'string', name: 'para', description: 'Tabela de destino', required: true, choices: SAPATO },
      ],
      run: ({ numero, de, para }) => {
        // BR e EU diferem por uma constante; US masculino fica ~31 abaixo do EU.
        const emEu = de === 'eu' ? numero : de === 'br' ? numero + 1 : numero + 31;
        const saida = para === 'eu' ? emEu : para === 'br' ? emEu - 1 : emEu - 31;
        const nome = { br: 'BR', eu: 'EU', us: 'US' };
        return `**${formatar(numero)} ${nome[de]}** ≈ **${formatar(saida)} ${nome[para]}**\n\n_Tabelas de calçado variam por fabricante — use como referência._`;
      },
    },
    {
      name: 'notacao-cientifica',
      description: 'Escreve um número em notação científica.',
      options: [opt.numero('numero', 'O número')],
      run: ({ numero }) => {
        if (numero === 0) return '**0** = **0 × 10⁰**';
        const expoente = Math.floor(Math.log10(Math.abs(numero)));
        const mantissa = numero / 10 ** expoente;
        return `**${numero.toLocaleString('pt-BR')}** = **${Number(mantissa.toFixed(6))} × 10^${expoente}**`;
      },
    },
    {
      name: 'fracao',
      description: 'Transforma um decimal na fração mais simples.',
      options: [opt.numero('numero', 'O decimal, ex.: 0.375')],
      run: ({ numero }) => {
        if (!Number.isFinite(numero)) throw aviso('Número inválido.');
        // Denominador de 1e6 e depois simplifica pelo MDC: suficiente para
        // decimais digitados à mão, sem precisar de frações contínuas.
        const denominador = 1_000_000;
        let numerador = Math.round(numero * denominador);
        const mdc = (a, b) => (b === 0 ? Math.abs(a) : mdc(b, a % b));
        const divisor = mdc(numerador, denominador) || 1;
        numerador /= divisor;
        return `**${numero}** = **${numerador}/${denominador / divisor}**`;
      },
    },
    {
      name: 'bytes',
      description: 'Escreve um número de bytes de forma legível.',
      options: [opt.numero('bytes', 'Quantidade de bytes', true, { min: 0 })],
      run: ({ bytes }) => {
        const unidades = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
        let valor = bytes;
        let i = 0;
        while (valor >= 1024 && i < unidades.length - 1) {
          valor /= 1024;
          i += 1;
        }
        return `**${bytes.toLocaleString('pt-BR')}** bytes = **${Number(valor.toFixed(2))} ${unidades[i]}**`;
      },
    },
    {
      name: 'dinheiro',
      description: 'Formata um número como valor em reais.',
      options: [opt.numero('valor', 'O valor')],
      run: ({ valor }) => {
        const formatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const inteiro = Math.floor(Math.abs(valor));
        const centavos = Math.round((Math.abs(valor) - inteiro) * 100);
        return [
          `**${formatado}**`,
          `Por extenso: **${porExtenso(inteiro)} rea${inteiro === 1 ? 'l' : 'is'}${centavos > 0 ? ` e ${porExtenso(centavos)} centavos` : ''}**`,
        ].join('\n');
      },
    },
    {
      name: 'extenso',
      description: 'Escreve um número por extenso, em português.',
      options: [opt.inteiro('numero', 'De 0 a 999.999.999', true, { min: 0, max: 999_999_999 })],
      run: ({ numero }) => `**${numero.toLocaleString('pt-BR')}** = **${porExtenso(numero)}**`,
    },
    {
      name: 'graus-dms',
      description: 'Converte latitude e longitude decimais para graus, minutos e segundos.',
      options: [
        opt.numero('latitude', 'Latitude decimal, de -90 a 90', true, { min: -90, max: 90 }),
        opt.numero('longitude', 'Longitude decimal, de -180 a 180', true, { min: -180, max: 180 }),
      ],
      run: ({ latitude, longitude }) => {
        const dms = (valor, positivo, negativo) => {
          const absoluto = Math.abs(valor);
          const graus = Math.floor(absoluto);
          const minutosDecimais = (absoluto - graus) * 60;
          const minutos = Math.floor(minutosDecimais);
          const segundos = (minutosDecimais - minutos) * 60;
          const hemisferio = valor >= 0 ? positivo : negativo;
          return `${graus}° ${minutos}′ ${segundos.toFixed(2)}″ ${hemisferio}`;
        };

        return [
          `**Latitude:** ${dms(latitude, 'N', 'S')}`,
          `**Longitude:** ${dms(longitude, 'L', 'O')}`,
          '',
          `Mapa: https://www.google.com/maps?q=${latitude},${longitude}`,
        ].join('\n');
      },
    },
  ],
});
