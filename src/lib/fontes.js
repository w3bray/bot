/**
 * "Fontes" de servidor.
 *
 * O Discord não tem seletor de fonte: aqueles nomes de canal em itálico que
 * aparecem em servidores grandes são caracteres Unicode do bloco Mathematical
 * Alphanumeric Symbols (U+1D400–U+1D7FF), que o Discord renderiza como letras
 * normais em outro estilo. Trocar a letra pelo caractere equivalente é a única
 * forma de reproduzir isso.
 *
 * Duas armadilhas conhecidas:
 *
 *   1. O itálico minúsculo tem um buraco: o "h" seria U+1D455, mas essa posição
 *      é reservada e não existe. O caractere certo é U+210E (ℎ, Planck).
 *   2. Não existe dígito itálico nem bold-itálico. Números e pontuação passam
 *      sem alteração de propósito — inventar substituto deixaria o nome ilegível.
 */

const A_MAIUSCULO = 0x41;
const Z_MAIUSCULO = 0x5a;
const A_MINUSCULO = 0x61;
const Z_MINUSCULO = 0x7a;

const H_ITALICO = 'ℎ'; // ℎ — a posição U+1D455 não existe

/** Converte usando as bases do bloco matemático, preservando o resto do texto. */
function converter(texto, baseMaiuscula, baseMinuscula, { buracoNoH = false } = {}) {
  let saida = '';

  for (const caractere of texto) {
    const codigo = caractere.codePointAt(0);

    if (codigo >= A_MAIUSCULO && codigo <= Z_MAIUSCULO) {
      saida += String.fromCodePoint(baseMaiuscula + (codigo - A_MAIUSCULO));
    } else if (codigo >= A_MINUSCULO && codigo <= Z_MINUSCULO) {
      saida += buracoNoH && caractere === 'h'
        ? H_ITALICO
        : String.fromCodePoint(baseMinuscula + (codigo - A_MINUSCULO));
    } else {
      saida += caractere;
    }
  }

  return saida;
}

/** 𝑖𝑡𝑎́𝑙𝑖𝑐𝑜 𝑠𝑒𝑟𝑖𝑓𝑎𝑑𝑜 — usado nos nomes de canal. */
export function italico(texto) {
  return converter(texto, 0x1d434, 0x1d44e, { buracoNoH: true });
}

/** 𝑵𝒆𝒈𝒓𝒊𝒕𝒐 𝒊𝒕𝒂́𝒍𝒊𝒄𝒐 — usado nos nomes de categoria. */
export function negritoItalico(texto) {
  return converter(texto, 0x1d468, 0x1d482);
}

/** Desfaz a conversão: útil para comparar nomes estilizados com texto comum. */
export function semEstilo(texto) {
  let saida = '';

  for (const caractere of texto) {
    const codigo = caractere.codePointAt(0);

    if (caractere === H_ITALICO) {
      saida += 'h';
    } else if (codigo >= 0x1d434 && codigo <= 0x1d44d) {
      saida += String.fromCodePoint(A_MAIUSCULO + (codigo - 0x1d434));
    } else if (codigo >= 0x1d44e && codigo <= 0x1d467) {
      saida += String.fromCodePoint(A_MINUSCULO + (codigo - 0x1d44e));
    } else if (codigo >= 0x1d468 && codigo <= 0x1d481) {
      saida += String.fromCodePoint(A_MAIUSCULO + (codigo - 0x1d468));
    } else if (codigo >= 0x1d482 && codigo <= 0x1d49b) {
      saida += String.fromCodePoint(A_MINUSCULO + (codigo - 0x1d482));
    } else {
      saida += caractere;
    }
  }

  return saida;
}
