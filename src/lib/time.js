const UNITS = {
  s: 1000,
  seg: 1000,
  segundo: 1000,
  segundos: 1000,
  m: 60_000,
  min: 60_000,
  minuto: 60_000,
  minutos: 60_000,
  h: 3_600_000,
  hora: 3_600_000,
  horas: 3_600_000,
  d: 86_400_000,
  dia: 86_400_000,
  dias: 86_400_000,
  sem: 604_800_000,
  semana: 604_800_000,
  semanas: 604_800_000,
  w: 604_800_000,
  mes: 2_592_000_000,
  meses: 2_592_000_000,
  a: 31_536_000_000,
  ano: 31_536_000_000,
  anos: 31_536_000_000,
};

/**
 * Converte texto como "10m", "1h30m", "2 dias" em milissegundos.
 * Retorna null quando não consegue interpretar.
 */
export function parseDuration(input) {
  if (!input) return null;
  const normalized = String(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');

  const matches = normalized.matchAll(/(\d+(?:[.,]\d+)?)([a-z]+)/g);
  let total = 0;
  let found = false;

  for (const [, rawAmount, unit] of matches) {
    const multiplier = UNITS[unit];
    if (!multiplier) return null;
    total += Number(rawAmount.replace(',', '.')) * multiplier;
    found = true;
  }

  return found && total > 0 ? Math.round(total) : null;
}

/** Formata milissegundos em texto legível: "2d 4h 10min". */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 1000) return 'menos de 1 segundo';

  const parts = [];
  const units = [
    ['d', 86_400_000],
    ['h', 3_600_000],
    ['min', 60_000],
    ['s', 1000],
  ];

  let remaining = Math.floor(ms);
  for (const [label, size] of units) {
    const amount = Math.floor(remaining / size);
    if (amount > 0) {
      parts.push(`${amount}${label}`);
      remaining -= amount * size;
    }
    if (parts.length === 2) break;
  }

  return parts.join(' ');
}

/** Timestamp dinâmico do Discord. Estilos: t T d D f F R */
export function timestamp(date, style = 'f') {
  const seconds = Math.floor(new Date(date).getTime() / 1000);
  return `<t:${seconds}:${style}>`;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
