import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { logger } from '../lib/logger.js';

/**
 * Baixador multimídia.
 *
 * - yt-dlp busca o melhor vídeo e o melhor áudio disponíveis;
 * - gallery-dl busca galerias e carrosséis no tamanho original;
 * - TikWM é a reserva do TikTok quando o extrator oficial quebra;
 * - arquivos maiores que o Discord são divididos depois do download, sem
 *   reduzir qualidade;
 * - toda URL entra nos processos como argumento (nunca por shell) e destinos
 *   internos/privados são bloqueados para evitar SSRF direto.
 */

export const DOWNLOAD_MODES = Object.freeze({
  ALL: 'all',
  VIDEO: 'video',
  AUDIO: 'audio',
  IMAGES: 'images',
});

const METADATA_TIMEOUT = 30_000;
const FETCH_IDLE_TIMEOUT = 90_000;
const FFMPEG_TIMEOUT = 30 * 60_000;
const SEGMENT_TIMEOUT = 30 * 60_000;
const MAX_CONCURRENT = 2;
const MIN_DISK_RESERVE_BYTES = 512 * 1024 * 1024;
const MAX_MESSAGE_PAYLOAD_BYTES = 24 * 1024 * 1024;
const TIKWM_API = 'https://www.tikwm.com/api/';
const TIKWM_CACHE_TTL = 5 * 60_000;
const HTTP_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

const IMAGE_EXTENSIONS = new Set([
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'jpeg',
  'jpg',
  'jxl',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
]);
const VIDEO_EXTENSIONS = new Set([
  '3gp',
  'avi',
  'flv',
  'm4v',
  'mkv',
  'mov',
  'mp4',
  'mpeg',
  'mpg',
  'ts',
  'webm',
]);
const AUDIO_EXTENSIONS = new Set([
  'aac',
  'alac',
  'flac',
  'm4a',
  'mka',
  'mp3',
  'oga',
  'ogg',
  'opus',
  'wav',
  'weba',
  'wma',
]);

let running = 0;
const tikwmCache = new Map();

function detectBinary(binary) {
  const result = spawnSync(binary, ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim().split(/\r?\n/, 1)[0];
}

export const ytdlpVersion = detectBinary('yt-dlp');
export const galleryDlVersion = detectBinary('gallery-dl');
export const isEnabled = Boolean(ytdlpVersion || galleryDlVersion);

if (!ytdlpVersion) {
  logger.warn('yt-dlp não encontrado — vídeo e áudio do /baixar podem ficar indisponíveis.');
}
if (!galleryDlVersion) {
  logger.warn('gallery-dl não encontrado — galerias do /baixar podem ficar indisponíveis.');
}

const ffmpegAvailable = spawnSync('ffmpeg', ['-version']).status === 0;

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

function normalizeMode(mode) {
  const normalized = mode === 'tudo' ? DOWNLOAD_MODES.ALL : mode;
  if (!Object.values(DOWNLOAD_MODES).includes(normalized)) {
    throw new Error('Tipo de download inválido.');
  }
  return normalized;
}

function wants(mode, kind) {
  if (mode === DOWNLOAD_MODES.ALL) return true;
  if (kind === 'image') return mode === DOWNLOAD_MODES.IMAGES;
  return mode === kind;
}

function runYtdlp(args, timeout = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let finished = false;
    let forcedError = null;

    const timer = timeout
      ? setTimeout(() => {
          forcedError = new Error('A leitura dos metadados demorou demais e foi cancelada.');
          child.kill('SIGKILL');
        }, timeout)
      : null;

    const append = (current, chunk, limit) => {
      if (current.length >= limit) return current;
      return current + chunk.toString().slice(0, limit - current.length);
    };

    child.stdout.on('data', (chunk) => {
      stdout = append(stdout, chunk, 8_000_000);
    });
    child.stderr.on('data', (chunk) => {
      stderr = append(stderr, chunk, 1_000_000);
    });
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if (finished) return;
      finished = true;
      reject(new Error(`Não consegui executar o yt-dlp: ${error.message}`));
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (finished) return;
      finished = true;

      if (forcedError) return reject(forcedError);
      if (code === 0) return resolve({ stdout, stderr });

      const error = new Error(friendlyError(stderr));
      error.stderr = stderr;
      error.exitCode = code;
      reject(error);
    });
  });
}

function runGallery(args, timeout = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn('gallery-dl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let finished = false;
    let forcedError = null;
    let checkingDisk = false;

    const timer = timeout
      ? setTimeout(() => {
          forcedError = new Error('A leitura da galeria demorou demais e foi cancelada.');
          child.kill('SIGKILL');
        }, timeout)
      : null;

    // gallery-dl pode baixar centenas de imagens. A única trava de volume é o
    // espaço físico: interrompemos antes de consumir a reserva do sistema.
    const diskTimer = setInterval(async () => {
      if (checkingDisk || finished) return;
      checkingDisk = true;
      try {
        const stats = await fs.statfs(os.tmpdir());
        const free = Number(stats.bavail) * Number(stats.bsize);
        if (free <= MIN_DISK_RESERVE_BYTES) {
          forcedError = new Error('A VPS ficou sem espaço temporário para concluir a galeria.');
          child.kill('SIGKILL');
        }
      } catch {
        // A verificação inicial de espaço ainda protege o job se statfs falhar aqui.
      } finally {
        checkingDisk = false;
      }
    }, 1_000);

    const append = (current, chunk, limit) => {
      if (current.length >= limit) return current;
      return current + chunk.toString().slice(0, limit - current.length);
    };

    child.stdout.on('data', (chunk) => {
      stdout = append(stdout, chunk, 1_000_000);
    });
    child.stderr.on('data', (chunk) => {
      stderr = append(stderr, chunk, 1_000_000);
    });
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      clearInterval(diskTimer);
      if (finished) return;
      finished = true;
      reject(new Error(`Não consegui executar o gallery-dl: ${error.message}`));
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      clearInterval(diskTimer);
      if (finished) return;
      finished = true;

      if (forcedError) return reject(forcedError);
      if (code === 0) return resolve({ stdout, stderr });

      const error = new Error(friendlyGalleryError(stderr));
      error.stderr = stderr;
      error.exitCode = code;
      reject(error);
    });
  });
}

function friendlyError(stderr) {
  const text = stderr.toLowerCase();
  if (text.includes('unsupported url')) return 'Não sei baixar mídia desse site.';
  if (text.includes('private') || text.includes('login required') || text.includes('sign in')) {
    return 'Esse conteúdo é privado ou exige login.';
  }
  if (text.includes('not available') || text.includes('404') || text.includes('removed')) {
    return 'Esse conteúdo não existe mais ou não está disponível na região da VPS.';
  }
  if (text.includes('age')) return 'Esse conteúdo tem restrição de idade.';
  if (text.includes('file is larger') || text.includes('max-filesize')) {
    return 'A mídia é maior que o espaço temporário disponível na VPS.';
  }
  if (text.includes('geo')) return 'Esse conteúdo está bloqueado na região da VPS.';
  logger.debug('Erro bruto do yt-dlp:', stderr.slice(0, 800));
  return 'Não consegui extrair essa mídia.';
}

function friendlyGalleryError(stderr) {
  const text = stderr.toLowerCase();
  if (text.includes('unsupported url') || text.includes('no suitable extractor')) {
    return 'Esse site não fornece uma galeria compatível.';
  }
  if (text.includes('authentication') || text.includes('login') || text.includes('private')) {
    return 'Essa galeria é privada ou exige login.';
  }
  if (text.includes('404') || text.includes('not found')) return 'Essa galeria não existe mais.';
  logger.debug('Erro bruto do gallery-dl:', stderr.slice(0, 800));
  return 'Não consegui extrair imagens dessa página.';
}

function formatSelector() {
  const clean = '[format_id!*=watermark][format_id!*=download_addr]';
  return `bv*${clean}+ba/b${clean}/bv*+ba/b`;
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
      const hasVideo = Boolean(data.hdplay || data.play || data.wmplay);
      const hasImages = Array.isArray(data.images) && data.images.length > 0;
      if (!hasVideo && !hasImages) throw new Error('A resposta não contém mídia para baixar.');

      rememberTikwm(url, data);
      return data;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  logger.debug('Erro bruto do extrator reserva do TikTok:', lastError?.message);
  throw new Error('O TikTok não entregou essa publicação agora. Tente novamente em instantes.');
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

function extensionFromResponse(contentType, url, fallback) {
  const type = contentType?.split(';', 1)[0].trim().toLowerCase();
  const byType = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  if (byType[type]) return byType[type];

  try {
    const extension = path.extname(new URL(url).pathname).slice(1).toLowerCase();
    if (/^[a-z0-9]{1,8}$/.test(extension)) return extension;
  } catch {
    // Usa o fallback abaixo.
  }
  return fallback;
}

async function fetchToFile(url, file, maxBytes) {
  const controller = new AbortController();
  let idleTimer = setTimeout(() => controller.abort(), FETCH_IDLE_TIMEOUT);
  let size = 0;

  const touch = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), FETCH_IDLE_TIMEOUT);
  };

  try {
    const response = await fetch(url, {
      headers: { Referer: 'https://www.tikwm.com/', 'User-Agent': HTTP_USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const announcedSize = Number(response.headers.get('content-length')) || 0;
    if (announcedSize > maxBytes) {
      throw new Error('A mídia é maior que o espaço temporário disponível na VPS.');
    }

    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        touch();
        size += chunk.length;
        if (size > maxBytes) {
          callback(new Error('A mídia é maior que o espaço temporário disponível na VPS.'));
          return;
        }
        callback(null, chunk);
      },
    });

    await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(file));
    return {
      size,
      contentType: response.headers.get('content-type'),
      finalUrl: response.url || url,
    };
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    clearTimeout(idleTimer);
  }
}

async function fetchPublicResponse(input, signal) {
  let current = validateUrl(input);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const response = await fetch(current, {
      headers: { 'User-Agent': HTTP_USER_AGENT },
      redirect: 'manual',
      signal,
    });
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get('location');
    if (!location) return response;
    current = validateUrl(new URL(location, current).toString());
  }
  throw new Error('Esse link redirecionou vezes demais.');
}

async function downloadDirectAsset(url, directory, mode) {
  const controller = new AbortController();
  let idleTimer = setTimeout(() => controller.abort(), FETCH_IDLE_TIMEOUT);
  const touch = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), FETCH_IDLE_TIMEOUT);
  };

  try {
    const response = await fetchPublicResponse(url, controller.signal);
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type')?.split(';', 1)[0].toLowerCase();
    const kind = contentType?.startsWith('image/')
      ? 'image'
      : contentType?.startsWith('video/')
        ? 'video'
        : contentType?.startsWith('audio/')
          ? 'audio'
          : null;
    const accepted =
      kind && (wants(mode, kind) || (mode === DOWNLOAD_MODES.AUDIO && kind === 'video'));
    if (!accepted) {
      throw new Error('Esse link direto não aponta para o tipo de mídia solicitado.');
    }

    const maxBytes = await availableDownloadLimit();
    const announcedSize = Number(response.headers.get('content-length')) || 0;
    if (announcedSize > maxBytes) {
      throw new Error('A mídia é maior que o espaço temporário disponível na VPS.');
    }

    let size = 0;
    const extension = extensionFromResponse(contentType, response.url || url, kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : 'mka');
    const file = path.join(directory, `direto.${extension}`);
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        touch();
        size += chunk.length;
        if (size > maxBytes) {
          callback(new Error('A mídia é maior que o espaço temporário disponível na VPS.'));
          return;
        }
        callback(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(file));
    return { file, size, kind, source: 'link direto' };
  } finally {
    clearTimeout(idleTimer);
    controller.abort();
  }
}

function runFfmpeg(args, failureMessage) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let finished = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, FFMPEG_TIMEOUT);

    child.stderr.on('data', (chunk) => {
      if (stderr.length < 200_000) stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (finished) return;
      finished = true;
      reject(new Error(`${failureMessage}: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (finished) return;
      finished = true;
      if (code === 0) resolve();
      else {
        logger.debug('Erro bruto do ffmpeg:', stderr.slice(0, 800));
        reject(new Error(failureMessage));
      }
    });
  });
}

async function extractTikwmAudio(input, directory) {
  await fs.mkdir(directory, { recursive: true });
  const losslessOutput = path.join(directory, 'audio.mka');
  try {
    await runFfmpeg(
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        input,
        '-map',
        '0:a:0',
        '-vn',
        '-c:a',
        'copy',
        losslessOutput,
      ],
      'Não consegui separar o áudio original deste vídeo.',
    );
    return losslessOutput;
  } catch {
    const fallback = path.join(directory, 'audio.m4a');
    await runFfmpeg(
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        input,
        '-map',
        '0:a:0',
        '-vn',
        '-c:a',
        'aac',
        '-b:a',
        '320k',
        fallback,
      ],
      'Não consegui extrair o áudio deste vídeo.',
    );
    return fallback;
  }
}

async function downloadTikwmAssets(data, directory, mode, onlyKinds = null) {
  const assets = [];
  let sourceVideo = null;
  const requested = onlyKinds ? new Set(onlyKinds) : null;
  const shouldDownload = (kind) => requested?.has(kind) ?? wants(mode, kind);

  if (shouldDownload('video') || shouldDownload('audio')) {
    const candidates = tikwmCandidates(data);
    let lastError = new Error('Essa publicação do TikTok não contém vídeo.');
    for (const [index, candidate] of candidates.entries()) {
      const maxBytes = await availableDownloadLimit();
      if (candidate.size && candidate.size > maxBytes) continue;

      const temporary = path.join(directory, `tiktok-video-${index + 1}.download`);
      try {
        const downloaded = await fetchToFile(candidate.url, temporary, maxBytes);
        const extension = extensionFromResponse(
          downloaded.contentType,
          downloaded.finalUrl,
          'mp4',
        );
        sourceVideo = path.join(directory, `video.${extension}`);
        await fs.rename(temporary, sourceVideo);
        break;
      } catch (error) {
        lastError = error;
        await fs.rm(temporary, { force: true }).catch(() => null);
      }
    }

    if (!sourceVideo && mode !== DOWNLOAD_MODES.ALL) throw lastError;
    if (sourceVideo && shouldDownload('video')) {
      const { size } = await fs.stat(sourceVideo);
      assets.push({ file: sourceVideo, size, kind: 'video', source: 'TikTok (reserva)' });
    }
    if (sourceVideo && shouldDownload('audio')) {
      if (!ffmpegAvailable) throw new Error('Extrair áudio precisa do ffmpeg na VPS.');
      const audio = await extractTikwmAudio(sourceVideo, directory);
      const { size } = await fs.stat(audio);
      assets.push({ file: audio, size, kind: 'audio', source: 'TikTok (reserva)' });
    }
  }

  if (shouldDownload('image')) {
    const gallery = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : [data.origin_cover, data.cover, data.dynamic_cover];
    const seen = new Set();
    const urls = gallery
      .map(resolveTikwmUrl)
      .filter((url) => url && !seen.has(url) && seen.add(url));

    for (const [index, imageUrl] of urls.entries()) {
      const maxBytes = await availableDownloadLimit();
      const temporary = path.join(directory, `image-${String(index + 1).padStart(3, '0')}.download`);
      const downloaded = await fetchToFile(imageUrl, temporary, maxBytes);
      const extension = extensionFromResponse(
        downloaded.contentType,
        downloaded.finalUrl,
        'jpg',
      );
      const output = path.join(
        directory,
        `image-${String(index + 1).padStart(3, '0')}.${extension}`,
      );
      await fs.rename(temporary, output);
      assets.push({
        file: output,
        size: downloaded.size,
        kind: 'image',
        source: 'TikTok (reserva)',
      });
    }
  }

  // Quando só o áudio foi solicitado, o vídeo era apenas intermediário.
  if (!shouldDownload('video') && shouldDownload('audio') && sourceVideo) {
    await fs.rm(sourceVideo, { force: true }).catch(() => null);
  }
  return assets;
}

async function deriveAudioFromBestVideo(assets, directory) {
  if (assets.some((asset) => asset.kind === 'audio')) return;
  const video = assets
    .filter((asset) => asset.kind === 'video')
    .sort((a, b) => b.size - a.size)[0];
  if (!video || !ffmpegAvailable) return;

  const audio = await extractTikwmAudio(video.file, path.join(directory, 'derived-audio'));
  const { size } = await fs.stat(audio);
  assets.push({
    file: audio,
    size,
    kind: 'audio',
    source: `${video.source} (áudio separado sem perda quando possível)`,
  });
}

function tikwmInfo(data, url) {
  const imageCount = Array.isArray(data.images) ? data.images.length : 0;
  return {
    title: data.title || (imageCount ? 'Publicação com imagens do TikTok' : 'Vídeo do TikTok'),
    uploader: data.author?.nickname ?? data.author?.unique_id ?? null,
    duration: Number(data.duration) || null,
    extractor: 'TikTok (reserva)',
    thumbnail: resolveTikwmUrl(data.cover ?? data.origin_cover),
    webpage: url,
    isLive: false,
    imageCount,
  };
}

async function galleryCanHandle(url) {
  await runGallery(
    ['--no-input', '--config-ignore', '--no-colors', '--simulate', url],
    METADATA_TIMEOUT,
  );
}

async function probeDirectMedia(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METADATA_TIMEOUT);
  try {
    const response = await fetchPublicResponse(url, controller.signal);
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].toLowerCase();
    const isMedia = ['image/', 'video/', 'audio/'].some((prefix) =>
      contentType?.startsWith(prefix),
    );
    await response.body?.cancel().catch(() => null);
    if (!response.ok || !isMedia) throw new Error('O link não aponta para uma mídia pública.');
    return {
      title: path.basename(new URL(response.url || url).pathname) || 'Mídia direta',
      uploader: null,
      duration: null,
      extractor: 'link direto',
      thumbnail: contentType.startsWith('image/') ? response.url || url : null,
      webpage: url,
      isLive: false,
      imageCount: contentType.startsWith('image/') ? 1 : 0,
    };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export async function probe(url, { mode = DOWNLOAD_MODES.ALL } = {}) {
  mode = normalizeMode(mode);
  let ytError = null;
  let galleryError = null;

  if (ytdlpVersion) {
    try {
      const { stdout } = await runYtdlp(
        [
          '--dump-single-json',
          '--no-playlist',
          '--no-warnings',
          '--ignore-no-formats-error',
          '--skip-download',
          url,
        ],
        METADATA_TIMEOUT,
      );
      const info = JSON.parse(stdout);
      return {
        title: info.title ?? 'Mídia sem título',
        uploader: info.uploader ?? info.channel ?? null,
        duration: info.duration ?? null,
        extractor: info.extractor_key ?? info.extractor ?? 'yt-dlp',
        thumbnail: info.thumbnail ?? null,
        webpage: info.webpage_url ?? url,
        isLive: Boolean(info.is_live),
        imageCount: Array.isArray(info.thumbnails) ? info.thumbnails.length : 0,
      };
    } catch (error) {
      ytError = error;
    }
  }

  if (isTikTokUrl(url)) {
    logger.warn('O yt-dlp falhou no TikTok; tentando o extrator reserva.');
    const data = cachedTikwm(url) ?? (await fetchTikwm(url));
    return tikwmInfo(data, url);
  }

  if (galleryDlVersion) {
    try {
      await galleryCanHandle(url);
      return {
        title: 'Galeria de mídia',
        uploader: null,
        duration: null,
        extractor: 'gallery-dl',
        thumbnail: null,
        webpage: url,
        isLive: false,
        imageCount: null,
      };
    } catch (error) {
      galleryError = error;
    }
  }

  try {
    return await probeDirectMedia(url);
  } catch {
    // Mantém abaixo a mensagem mais útil produzida por um extrator completo.
  }

  if (mode === DOWNLOAD_MODES.IMAGES && galleryError) throw galleryError;
  throw ytError ?? galleryError ?? new Error('Nenhum extrator de mídia está disponível na VPS.');
}

async function walkFiles(directory) {
  const found = [];
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return found;
    throw error;
  }

  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await walkFiles(file)));
    else if (entry.isFile() && !entry.name.endsWith('.part')) found.push(file);
  }
  return found;
}

function kindForFile(file) {
  const extension = path.extname(file).slice(1).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  return null;
}

async function collectAssets(directory, source, acceptedKinds = null) {
  const assets = [];
  for (const file of await walkFiles(directory)) {
    const kind = kindForFile(file);
    if (!kind || (acceptedKinds && !acceptedKinds.has(kind))) continue;
    const { size } = await fs.stat(file);
    if (size > 0) assets.push({ file, size, kind, source });
  }
  return assets;
}

async function downloadYtdlpAsset(url, directory, kind) {
  const target = path.join(directory, `yt-${kind}`);
  await fs.mkdir(target, { recursive: true });
  const maxBytes = await availableDownloadLimit();
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--newline',
    '--progress',
    '--no-continue',
    '--max-filesize',
    String(maxBytes),
    '-o',
    path.join(target, 'media.%(ext)s'),
  ];

  if (kind === 'video') {
    args.push('-f', formatSelector());
  } else {
    if (!ffmpegAvailable) throw new Error('Extrair áudio precisa do ffmpeg na VPS.');
    args.push('-f', 'ba/b', '--extract-audio', '--audio-format', 'best', '--audio-quality', '0');
  }
  args.push(url);
  await runYtdlp(args);
  const assets = await collectAssets(target, 'yt-dlp', new Set([kind]));
  if (assets.length === 0) throw new Error(`O yt-dlp não gerou nenhum arquivo de ${kind}.`);
  return assets;
}

async function downloadYtdlpThumbnails(url, directory) {
  const target = path.join(directory, 'yt-images');
  await fs.mkdir(target, { recursive: true });
  await runYtdlp([
    '--no-playlist',
    '--no-warnings',
    '--skip-download',
    '--write-all-thumbnails',
    '--no-write-playlist-metafiles',
    '-o',
    path.join(target, 'thumbnail-%(id)s.%(ext)s'),
    url,
  ]);
  return collectAssets(target, 'yt-dlp (capas)', new Set(['image']));
}

async function downloadGallery(url, directory) {
  const target = path.join(directory, 'gallery');
  await fs.mkdir(target, { recursive: true });
  const maxBytes = await availableDownloadLimit();
  await runGallery([
    '--no-input',
    '--config-ignore',
    '--no-colors',
    '--no-mtime',
    '--retries',
    '4',
    '--filesize-max',
    String(maxBytes),
    '--directory',
    target,
    url,
  ]);
  return collectAssets(target, 'gallery-dl');
}

async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function deduplicateAssets(assets) {
  const unique = [];
  const bySize = new Map();

  for (const asset of assets) {
    const sameSize = bySize.get(asset.size) ?? [];
    let duplicate = false;
    if (sameSize.length > 0) {
      const digest = await hashFile(asset.file);
      for (const candidate of sameSize) {
        candidate.digest ??= await hashFile(candidate.file);
        if (candidate.digest === digest) {
          duplicate = true;
          break;
        }
      }
      asset.digest = digest;
    }

    if (!duplicate) {
      unique.push(asset);
      sameSize.push(asset);
      bySize.set(asset.size, sameSize);
    }
  }
  return unique.map(({ digest: _digest, ...asset }) => asset);
}

function missingWarning(kind) {
  return {
    video: 'vídeo não encontrado nessa página',
    audio: 'áudio não encontrado nessa página',
    image: 'imagens não encontradas nessa página',
  }[kind];
}

/**
 * Baixa todas as modalidades solicitadas para um diretório temporário.
 * Não há teto artificial de tamanho: o teto é o espaço realmente livre na VPS.
 */
export async function download(url, { mode = DOWNLOAD_MODES.ALL, audioOnly = false } = {}) {
  mode = audioOnly ? DOWNLOAD_MODES.AUDIO : normalizeMode(mode);
  if (!isEnabled && !isTikTokUrl(url)) {
    throw new Error('Nenhum extrator de mídia está instalado na VPS.');
  }
  if (running >= MAX_CONCURRENT) {
    throw new Error('Já estou baixando outras mídias agora. Tente de novo em instantes.');
  }

  await availableDownloadLimit();
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
    const assets = [];
    const warnings = [];
    const errors = new Map();
    const galleryAssets = [];
    let tikwmData = isTikTokUrl(url) ? cachedTikwm(url) : null;

    for (const kind of ['video', 'audio']) {
      if (!wants(mode, kind)) continue;
      if (ytdlpVersion) {
        try {
          assets.push(...(await downloadYtdlpAsset(url, directory, kind)));
          continue;
        } catch (error) {
          errors.set(kind, error);
        }
      }
    }

    const needsGallery =
      !isTikTokUrl(url) &&
      galleryDlVersion &&
      (wants(mode, 'image') ||
        ['video', 'audio'].some(
          (kind) => wants(mode, kind) && !assets.some((asset) => asset.kind === kind),
        ));
    if (needsGallery) {
      try {
        galleryAssets.push(...(await downloadGallery(url, directory)));
      } catch (error) {
        errors.set('gallery', error);
      }
    }

    for (const kind of ['video', 'audio']) {
      if (!wants(mode, kind) || assets.some((asset) => asset.kind === kind)) continue;
      assets.push(...galleryAssets.filter((asset) => asset.kind === kind));
    }

    if (wants(mode, 'image') && !isTikTokUrl(url)) {
      assets.push(...galleryAssets.filter((asset) => asset.kind === 'image'));
      if (ytdlpVersion) {
        try {
          assets.push(...(await downloadYtdlpThumbnails(url, directory)));
        } catch (error) {
          errors.set('image', error);
        }
      }
    }

    const missingBeforeTikwm = ['video', 'audio', 'image'].filter(
      (kind) => wants(mode, kind) && !assets.some((asset) => asset.kind === kind),
    );

    if (isTikTokUrl(url) && missingBeforeTikwm.length > 0) {
      try {
        tikwmData ??= await fetchTikwm(url);
        assets.push(
          ...(await downloadTikwmAssets(
            tikwmData,
            directory,
            DOWNLOAD_MODES.ALL,
            missingBeforeTikwm,
          )),
        );
      } catch (error) {
        errors.set('tiktok', error);
      }
    }

    if (assets.length === 0) {
      try {
        assets.push(await downloadDirectAsset(url, directory, mode));
      } catch (error) {
        errors.set('direct', error);
      }
    }

    if (wants(mode, 'audio') && !assets.some((asset) => asset.kind === 'audio')) {
      const galleryVideo = galleryAssets
        .filter((asset) => asset.kind === 'video')
        .sort((a, b) => b.size - a.size)[0];
      if (galleryVideo && !assets.includes(galleryVideo)) assets.push(galleryVideo);
      try {
        await deriveAudioFromBestVideo(assets, directory);
      } catch (error) {
        errors.set('derived-audio', error);
      }
    }

    if (mode === DOWNLOAD_MODES.AUDIO) {
      for (let index = assets.length - 1; index >= 0; index -= 1) {
        if (assets[index].kind !== 'audio') assets.splice(index, 1);
      }
    }

    const unique = await deduplicateAssets(assets);
    const requestedKinds = mode === DOWNLOAD_MODES.ALL
      ? ['video', 'audio', 'image']
      : [mode === DOWNLOAD_MODES.IMAGES ? 'image' : mode];
    const missing = requestedKinds.filter(
      (kind) => !unique.some((asset) => asset.kind === kind),
    );

    if (unique.length === 0) {
      const preferredError =
        errors.get(mode === DOWNLOAD_MODES.IMAGES ? 'image' : mode) ??
        errors.get('tiktok') ??
        errors.get('gallery') ??
        errors.get('direct') ??
        [...errors.values()][0];
      throw preferredError ?? new Error('Essa página não entregou nenhuma mídia para baixar.');
    }

    for (const kind of missing) warnings.push(missingWarning(kind));
    const totalSize = unique.reduce((sum, asset) => sum + asset.size, 0);
    return {
      assets: unique,
      file: unique[0].file,
      size: totalSize,
      warnings,
      cleanup,
    };
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
    const timer = setTimeout(() => child.kill('SIGKILL'), SEGMENT_TIMEOUT);

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
  const directory = `${file}.discord-parts`;
  await fs.mkdir(directory, { recursive: true });
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

/** Divide apenas para transporte. Nunca reduz resolução, bitrate ou qualidade. */
export async function splitForUpload(
  file,
  { maxBytes, duration, kind, extension, audioOnly = false },
) {
  const { size } = await fs.stat(file);
  if (size <= maxBytes) return { parts: [file], playable: true };

  const mediaKind = kind ?? (audioOnly ? 'audio' : 'video');
  if (!ffmpegAvailable || !duration || duration <= 0 || mediaKind === 'image') {
    return splitBinary(file, maxBytes);
  }

  const directory = `${file}.discord-parts`;
  await fs.mkdir(directory, { recursive: true });
  const safeExtension = /^[a-z0-9]{1,8}$/i.test(extension ?? '')
    ? extension.toLowerCase()
    : mediaKind === 'audio'
      ? 'mka'
      : 'mkv';
  const targetBytes = Math.floor(maxBytes * 0.82);
  const estimatedParts = Math.max(2, Math.ceil(size / targetBytes));
  let segmentTime = Math.max(0.5, (duration / estimatedParts) * 0.82);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await clearGeneratedParts(directory);
    const pattern = path.join(directory, `discord-part-%03d.${safeExtension}`);
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
