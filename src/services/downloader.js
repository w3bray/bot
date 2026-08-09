import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { logger } from '../lib/logger.js';

/**
 * Wrapper em volta do yt-dlp para baixar vídeos a partir de um link.
 *
 * Decisões de segurança importantes:
 * - o yt-dlp é chamado com `spawn` e lista de argumentos, NUNCA por shell,
 *   então a URL do usuário não pode virar comando;
 * - a URL é validada antes (só http/https, sem host privado), evitando SSRF;
 * - duração, tamanho e tempo de execução têm teto, e o processo é morto no timeout;
 * - cada job usa um diretório temporário próprio, removido no `finally`.
 *
 * O TikTok muda o site com frequência. Quando o extrator do yt-dlp quebra,
 * usamos a API pública do TikWM somente para links do TikTok e sem enviar
 * cookies, token do Discord ou qualquer outra credencial.
 */

export const MAX_DURATION_SECONDS = 15 * 60;
const METADATA_TIMEOUT = 25_000;
const DOWNLOAD_TIMEOUT = 180_000;
const FFMPEG_TIMEOUT = 90_000;
const SEGMENT_TIMEOUT = 180_000;
const MAX_CONCURRENT = 2;
const MIN_DISK_RESERVE_BYTES = 512 * 1024 * 1024;
const MAX_MESSAGE_PAYLOAD_BYTES = 24 * 1024 * 1024;
const TIKWM_API = 'https://www.tikwm.com/api/';
const TIKWM_CACHE_TTL = 5 * 60_000;
const HTTP_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

let running = 0;
const tikwmCache = new Map();

/** Verifica uma vez se o yt-dlp está instalado no PATH. */
function detectBinary() {
  const result = spawnSync('yt-dlp', ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

export const ytdlpVersion = detectBinary();
export const isEnabled = Boolean(ytdlpVersion);

if (!isEnabled) {
  logger.warn('yt-dlp não encontrado no PATH — o comando /baixar ficará desativado.');
}

const ffmpegAvailable = spawnSync('ffmpeg', ['-version']).status === 0;

/**
 * Valida a URL informada pelo usuário.
 * Retorna a URL normalizada ou lança com uma mensagem amigável.
 */
export function validateUrl(input) {
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Isso não parece um link válido.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Só aceito links `http://` ou `https://`.');
  }

  const host = url.hostname.toLowerCase();

  // Bloqueia alvos internos: sem isso, o bot viraria um proxy para a rede
  // onde ele está hospedado (SSRF).
  const isPrivate =
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) &&
      (/^10\./.test(host) ||
        /^127\./.test(host) ||
        /^0\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)));

  if (isPrivate) throw new Error('Esse endereço não é público.');

  return url.toString();
}

function isTikTokUrl(input) {
  try {
    const host = new URL(input).hostname.toLowerCase();
    return host === 'tiktok.com' || host.endsWith('.tiktok.com');
  } catch {
    return false;
  }
}

/** Executa o yt-dlp e devolve stdout, com timeout que mata o processo. */
function run(args, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      finished = true;
      child.kill('SIGKILL');
      reject(new Error('A operação demorou demais e foi cancelada.'));
    }, timeout);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      // Trava de segurança: metadados gigantes não podem estourar a memória.
      if (stdout.length > 8_000_000) child.kill('SIGKILL');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      if (finished) return;
      finished = true;
      reject(new Error(`Não consegui executar o yt-dlp: ${error.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (finished) return;
      finished = true;
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(friendlyError(stderr));
      // Guardamos o erro original apenas em memória para decidir se há fallback.
      // Ele nunca é mostrado ao usuário nem inclui credenciais do bot.
      error.stderr = stderr;
      error.exitCode = code;
      reject(error);
    });
  });
}

/** Traduz os erros mais comuns do yt-dlp para algo que o usuário entenda. */
function friendlyError(stderr) {
  const text = stderr.toLowerCase();

  if (text.includes('unsupported url')) return 'Não sei baixar vídeos desse site.';
  if (text.includes('private') || text.includes('login required') || text.includes('sign in')) {
    return 'Esse conteúdo é privado ou exige login.';
  }
  if (text.includes('not available') || text.includes('404') || text.includes('removed')) {
    return 'Esse vídeo não existe mais ou não está disponível na minha região.';
  }
  if (text.includes('age')) return 'Esse vídeo tem restrição de idade.';
  if (text.includes('file is larger') || text.includes('max-filesize')) {
    return 'O arquivo é maior que o espaço temporário disponível na VPS.';
  }
  if (text.includes('geo')) return 'Esse vídeo está bloqueado na região do servidor.';

  logger.debug('Erro bruto do yt-dlp:', stderr.slice(0, 800));
  return 'Não consegui baixar esse vídeo.';
}

/**
 * Seletor de formato.
 *
 * Em plataformas como o TikTok, o yt-dlp expõe tanto a versão com a marca
 * d'água da rede (normalmente sob `download_addr`) quanto a original limpa.
 * Preferimos explicitamente a versão sem marca d'água, com fallback para
 * qualquer formato caso a plataforma só ofereça a marcada.
 */
function formatSelector(maxBytes, audioOnly) {
  if (audioOnly) return 'ba/b';

  const clean = '[format_id!*=watermark][format_id!*=download_addr]';
  return [
    `bv*${clean}[filesize<${maxBytes}]+ba/b${clean}[filesize<${maxBytes}]`,
    `b${clean}`,
    `bv*[filesize<${maxBytes}]+ba/b[filesize<${maxBytes}]`,
    'b',
  ].join('/');
}

function cachedTikwm(url) {
  const cached = tikwmCache.get(url);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    tikwmCache.delete(url);
    return null;
  }
  return cached.data;
}

function rememberTikwm(url, data) {
  tikwmCache.set(url, { data, expiresAt: Date.now() + TIKWM_CACHE_TTL });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Consulta a API reserva do TikTok, com uma repetição para links curtos novos. */
async function fetchTikwm(url) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await wait(1_500);

    const endpoint = new URL(TIKWM_API);
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('hd', '1');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), METADATA_TIMEOUT);

    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json', 'User-Agent': HTTP_USER_AGENT },
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const raw = await response.text();
      if (raw.length > 2_000_000) throw new Error('resposta de metadados grande demais');

      const payload = JSON.parse(raw);
      if (payload.code !== 0 || !payload.data) {
        throw new Error(payload.msg || `resposta inválida (${payload.code})`);
      }

      const data = payload.data;
      if (!data.hdplay && !data.play && !data.wmplay) {
        if (Array.isArray(data.images) && data.images.length > 0) {
          throw new Error('Essa publicação contém fotos, não um vídeo.');
        }
        throw new Error('A resposta não contém um vídeo para baixar.');
      }

      rememberTikwm(url, data);
      return data;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  logger.debug('Erro bruto do extrator reserva do TikTok:', lastError?.message);
  throw new Error(
    lastError?.message?.includes('publicação contém fotos')
      ? lastError.message
      : 'O TikTok não entregou esse vídeo agora. Tente novamente em alguns instantes.',
  );
}

function resolveTikwmUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const url = new URL(value, TIKWM_API);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function tikwmCandidates(data) {
  const raw = [
    { url: data.hdplay, size: Number(data.hd_size) || 0 },
    { url: data.play, size: Number(data.size) || 0 },
    { url: data.wmplay, size: Number(data.wm_size) || 0 },
  ];
  const seen = new Set();

  return raw
    .map((candidate) => ({ ...candidate, url: resolveTikwmUrl(candidate.url) }))
    .filter((candidate) => candidate.url && !seen.has(candidate.url) && seen.add(candidate.url));
}

/** Faz streaming do arquivo e interrompe imediatamente se ultrapassar o limite. */
async function fetchToFile(url, file, maxBytes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);
  let size = 0;

  try {
    const response = await fetch(url, {
      headers: { Referer: 'https://www.tikwm.com/', 'User-Agent': HTTP_USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const announcedSize = Number(response.headers.get('content-length')) || 0;
    if (announcedSize > maxBytes) {
      throw new Error('O vídeo é grande demais para o limite de upload deste servidor.');
    }

    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        size += chunk.length;
        if (size > maxBytes) {
          callback(new Error('O vídeo é grande demais para o limite de upload deste servidor.'));
          return;
        }
        callback(null, chunk);
      },
    });

    await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(file));
    return size;
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function extractAudio(input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        input,
        '-vn',
        '-codec:a',
        'libmp3lame',
        '-q:a',
        '4',
        output,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );

    let stderr = '';
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      child.kill('SIGKILL');
      reject(new Error('A conversão do áudio demorou demais e foi cancelada.'));
    }, FFMPEG_TIMEOUT);

    child.stderr.on('data', (chunk) => {
      if (stderr.length < 200_000) stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (finished) return;
      finished = true;
      reject(new Error(`Não consegui converter o áudio: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (finished) return;
      finished = true;
      if (code === 0) resolve();
      else {
        logger.debug('Erro bruto do ffmpeg:', stderr.slice(0, 800));
        reject(new Error('Não consegui converter o áudio deste vídeo.'));
      }
    });
  });
}

async function downloadTikwm(data, directory, { maxBytes, audioOnly }) {
  const source = path.join(directory, 'tiktok.mp4');
  const output = audioOnly ? path.join(directory, 'audio.mp3') : source;
  const candidates = tikwmCandidates(data);
  let lastError = new Error('O extrator reserva não encontrou um arquivo para baixar.');
  let skippedForSize = false;

  for (const candidate of candidates) {
    if (candidate.size > maxBytes) {
      skippedForSize = true;
      continue;
    }

    await fs.rm(source, { force: true }).catch(() => null);
    await fs.rm(output, { force: true }).catch(() => null);

    try {
      await fetchToFile(candidate.url, source, maxBytes);

      if (audioOnly) {
        await extractAudio(source, output);
        await fs.rm(source, { force: true }).catch(() => null);
      }

      const { size } = await fs.stat(output);
      if (size > maxBytes) {
        throw new Error('O arquivo ficou maior que o limite de upload deste servidor.');
      }
      return { file: output, size };
    } catch (error) {
      lastError = error;
    }
  }

  if (skippedForSize && candidates.every((candidate) => candidate.size > maxBytes)) {
    throw new Error('O vídeo é grande demais para o limite de upload deste servidor.');
  }
  throw lastError;
}

function tikwmInfo(data, url) {
  return {
    title: data.title || 'Vídeo do TikTok',
    uploader: data.author?.nickname ?? data.author?.unique_id ?? null,
    duration: Number(data.duration) || null,
    extractor: 'TikTok (reserva)',
    thumbnail: resolveTikwmUrl(data.cover ?? data.origin_cover),
    webpage: url,
    isLive: false,
  };
}

/** Busca os metadados sem baixar nada. */
export async function probe(url) {
  try {
    const { stdout } = await run(
      ['--dump-single-json', '--no-playlist', '--no-warnings', '--skip-download', url],
      METADATA_TIMEOUT,
    );

    const info = JSON.parse(stdout);
    return {
      title: info.title ?? 'sem título',
      uploader: info.uploader ?? info.channel ?? null,
      duration: info.duration ?? null,
      extractor: info.extractor_key ?? info.extractor ?? 'desconhecido',
      thumbnail: info.thumbnail ?? null,
      webpage: info.webpage_url ?? url,
      isLive: Boolean(info.is_live),
    };
  } catch (error) {
    if (!isTikTokUrl(url)) throw error;

    logger.warn('O yt-dlp falhou no TikTok; tentando o extrator reserva.');
    const data = cachedTikwm(url) ?? (await fetchTikwm(url));
    return tikwmInfo(data, url);
  }
}

/**
 * Baixa o vídeo (ou só o áudio) para um diretório temporário.
 * Quem chama é responsável por invocar `cleanup()` no final.
 */
export async function download(url, { maxBytes, audioOnly = false }) {
  if (!isEnabled) throw new Error('O yt-dlp não está instalado no servidor do bot.');
  if (audioOnly && !ffmpegAvailable) {
    throw new Error('Extrair áudio precisa do ffmpeg, que não está instalado no servidor do bot.');
  }
  if (running >= MAX_CONCURRENT) {
    throw new Error('Já estou baixando outros vídeos agora. Tente de novo em instantes.');
  }

  // Não existe teto artificial de download. Reservamos apenas 512 MiB para o
  // sistema operacional, evitando que um arquivo ocupe 100% do disco da VPS.
  const diskLimit = await availableDownloadLimit();
  const requestedLimit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : Infinity;
  const effectiveMaxBytes = Math.min(requestedLimit, diskLimit);

  running += 1;
  let directory;
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bot-baixar-'));
  } catch (error) {
    running = Math.max(0, running - 1);
    throw error;
  }

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    running = Math.max(0, running - 1);
    await fs.rm(directory, { recursive: true, force: true }).catch(() => null);
  };

  try {
    const cached = isTikTokUrl(url) ? cachedTikwm(url) : null;
    if (cached) {
      const result = await downloadTikwm(cached, directory, {
        maxBytes: effectiveMaxBytes,
        audioOnly,
      });
      return { ...result, cleanup };
    }

    const args = [
      '--no-playlist',
      '--no-warnings',
      '--no-progress',
      '--no-continue',
      '--max-filesize',
      String(effectiveMaxBytes),
      '-f',
      formatSelector(effectiveMaxBytes, audioOnly),
      '-o',
      path.join(directory, 'video.%(ext)s'),
    ];

    if (audioOnly) args.push('--extract-audio', '--audio-format', 'mp3');
    else if (ffmpegAvailable) args.push('--merge-output-format', 'mp4');

    args.push(url);

    try {
      await run(args, DOWNLOAD_TIMEOUT);
    } catch (error) {
      if (!isTikTokUrl(url)) throw error;

      logger.warn('O download do TikTok pelo yt-dlp falhou; usando o extrator reserva.');
      const data = await fetchTikwm(url);
      const result = await downloadTikwm(data, directory, {
        maxBytes: effectiveMaxBytes,
        audioOnly,
      });
      return { ...result, cleanup };
    }

    const files = await fs.readdir(directory);
    if (files.length === 0) throw new Error('O download terminou sem gerar arquivo.');

    const file = path.join(directory, files[0]);
    const { size } = await fs.stat(file);

    if (size > effectiveMaxBytes) {
      throw new Error('O arquivo ficou maior que o espaço temporário disponível na VPS.');
    }

    return { file, size, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function availableDownloadLimit() {
  try {
    const stats = await fs.statfs(os.tmpdir());
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const available = freeBytes - MIN_DISK_RESERVE_BYTES;
    if (available < 20 * 1024 * 1024) {
      throw new Error('A VPS está sem espaço livre suficiente para fazer este download.');
    }
    return available;
  } catch (error) {
    if (error.message.includes('sem espaço livre')) throw error;
    logger.warn('Não consegui medir o espaço livre da VPS; usando teto de segurança de 1 GiB.');
    return 1024 * 1024 * 1024;
  }
}

function runSegmenter(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      finished = true;
      child.kill('SIGKILL');
      reject(new Error('A divisão do arquivo demorou demais e foi cancelada.'));
    }, SEGMENT_TIMEOUT);

    child.stderr.on('data', (chunk) => {
      if (stderr.length < 200_000) stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (finished) return;
      finished = true;
      reject(new Error(`Não consegui dividir o arquivo: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (finished) return;
      finished = true;
      if (code === 0) resolve();
      else {
        logger.debug('Erro bruto do segmentador ffmpeg:', stderr.slice(0, 800));
        reject(new Error('Não consegui dividir este arquivo como mídia reproduzível.'));
      }
    });
  });
}

async function generatedParts(directory) {
  const names = (await fs.readdir(directory))
    .filter((name) => name.startsWith('discord-part-'))
    .sort();
  return names.map((name) => path.join(directory, name));
}

async function clearGeneratedParts(directory) {
  const parts = await generatedParts(directory);
  await Promise.all(parts.map((file) => fs.rm(file, { force: true })));
}

async function splitBinary(file, maxBytes) {
  const directory = path.dirname(file);
  await clearGeneratedParts(directory);

  const { size } = await fs.stat(file);
  const chunkSize = Math.max(1, Math.floor(maxBytes * 0.95));
  const count = Math.ceil(size / chunkSize);
  const width = Math.max(3, String(count).length);
  const parts = [];

  for (let index = 0, start = 0; start < size; index += 1, start += chunkSize) {
    const end = Math.min(size - 1, start + chunkSize - 1);
    const output = path.join(
      directory,
      `discord-part-${String(index + 1).padStart(width, '0')}.bin`,
    );
    await pipeline(createReadStream(file, { start, end }), createWriteStream(output));
    parts.push(output);
  }

  return { parts, playable: false };
}

/**
 * Divide arquivos acima do teto obrigatório do Discord.
 * Primeiro tenta gerar partes de mídia reproduzíveis; se o contêiner/codecs não
 * permitirem, produz partes binárias que podem ser concatenadas sem perda.
 */
export async function splitForUpload(file, { maxBytes, duration, audioOnly = false }) {
  const { size } = await fs.stat(file);
  if (size <= maxBytes) return { parts: [file], playable: true };
  if (!ffmpegAvailable || !duration || duration <= 0) return splitBinary(file, maxBytes);

  const directory = path.dirname(file);
  const extension = audioOnly ? 'mp3' : 'mp4';
  const targetBytes = Math.floor(maxBytes * 0.82);
  const estimatedParts = Math.max(2, Math.ceil(size / targetBytes));
  let segmentTime = Math.max(0.5, (duration / estimatedParts) * 0.82);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await clearGeneratedParts(directory);
    const pattern = path.join(directory, `discord-part-%03d.${extension}`);

    try {
      await runSegmenter([
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        file,
        '-map',
        '0:v?',
        '-map',
        '0:a?',
        '-c',
        'copy',
        '-f',
        'segment',
        '-segment_time',
        String(segmentTime),
        '-reset_timestamps',
        '1',
        pattern,
      ]);
    } catch {
      break;
    }

    const parts = await generatedParts(directory);
    if (parts.length === 0) break;

    const sizes = await Promise.all(parts.map(async (part) => (await fs.stat(part)).size));
    const largest = Math.max(...sizes);
    if (largest <= maxBytes) return { parts, playable: true };

    const reduction = Math.max(0.2, Math.min(0.75, (maxBytes / largest) * 0.75));
    segmentTime = Math.max(0.1, segmentTime * reduction);
  }

  return splitBinary(file, maxBytes);
}

/** Limite real calculado pelo Discord para esta interação. */
export function uploadLimitFor(interactionOrGuild) {
  const interactionLimit = Number(interactionOrGuild?.attachmentSizeLimit);
  if (Number.isFinite(interactionLimit) && interactionLimit > 0) {
    return Math.min(interactionLimit, MAX_MESSAGE_PAYLOAD_BYTES);
  }

  const guild = interactionOrGuild?.guild ?? interactionOrGuild;
  const byTier = { 0: 10, 1: 10, 2: 50, 3: 100 };
  const megabytes = byTier[guild?.premiumTier ?? 0] ?? 10;
  return Math.min(megabytes * 1024 * 1024, MAX_MESSAGE_PAYLOAD_BYTES);
}
