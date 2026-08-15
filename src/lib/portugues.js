const PLURAIS_IRREGULARES = new Map([
  ['servidor', 'servidores'],
]);

/** Escolhe a forma correta no singular ou no plural. */
export function plural(valor, singular, pluralForma) {
  if (Number(valor) === 1) return singular;
  return pluralForma ?? PLURAIS_IRREGULARES.get(singular) ?? `${singular}s`;
}

/** Formata quantidade e substantivo em português brasileiro. */
export function quantidade(valor, singular, pluralForma) {
  const numero = Number(valor);
  return `${numero.toLocaleString('pt-BR')} ${plural(numero, singular, pluralForma)}`;
}
