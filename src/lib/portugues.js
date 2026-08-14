/** Escolhe a forma correta no singular ou no plural. */
export function plural(valor, singular, pluralForma = `${singular}s`) {
  return Number(valor) === 1 ? singular : pluralForma;
}

/** Formata quantidade e substantivo em português brasileiro. */
export function quantidade(valor, singular, pluralForma = `${singular}s`) {
  const numero = Number(valor);
  return `${numero.toLocaleString('pt-BR')} ${plural(numero, singular, pluralForma)}`;
}
