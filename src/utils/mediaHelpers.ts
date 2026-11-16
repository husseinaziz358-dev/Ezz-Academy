import type { LessonAttachment } from '../data/academyData';

export interface ParsedYouTubeVideo {
  id: string;
  embedUrl: string;
  watchUrl: string;
  thumbnailUrl: string;
  startSeconds: number;
}

function parseStartTimeSeconds(raw: string | null): number {
  if (!raw) return 0;
  const trimmed = raw.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  let total = 0;
  const hours = trimmed.match(/(\d+)h/);
  const mins = trimmed.match(/(\d+)m/);
  const secs = trimmed.match(/(\d+)s/);
  if (hours) total += Number(hours[1]) * 3600;
  if (mins) total += Number(mins[1]) * 60;
  if (secs) total += Number(secs[1]);
  return total;
}

export function extractCleanVideoUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  // Support pasting full YouTube/Vimeo <iframe src="..."> embed snippets
  const iframeSrcMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  let candidate = iframeSrcMatch ? iframeSrcMatch[1].trim() : trimmed;

  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`;
  } else if (
    !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate) &&
    !candidate.startsWith('/') &&
    /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com|drive\.google\.com)\//i.test(
      candidate
    )
  ) {
    candidate = `https://${candidate}`;
  }

  return candidate;
}

export function parseYouTubeVideo(rawInput: string): ParsedYouTubeVideo | null {
  const cleaned = extractCleanVideoUrl(rawInput);
  if (!cleaned) return null;

  // Bare 11-character YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) {
    const id = cleaned;
    return {
      id,
      embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      startSeconds: 0,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^(?:www\.|m\.|music\.)/, '').toLowerCase();
  let id: string | null = null;

  if (host === 'youtu.be') {
    const seg = parsed.pathname.split('/').filter(Boolean)[0];
    if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) {
      id = seg;
    }
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch' || parsed.searchParams.has('v')) {
      const v = parsed.searchParams.get('v')?.trim();
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) id = v;
    } else if (
      parts[0] === 'embed' ||
      parts[0] === 'shorts' ||
      parts[0] === 'live' ||
      parts[0] === 'v' ||
      parts[0] === 'e'
    ) {
      const candidate = parts[1]?.trim();
      if (candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate)) id = candidate;
    } else if (parts[0] === 'attribution_link') {
      const inner = parsed.searchParams.get('u');
      if (inner) {
        const innerParsed = parseYouTubeVideo(`https://www.youtube.com${inner}`);
        if (innerParsed) return innerParsed;
      }
    }
  }

  if (!id) return null;

  const startSeconds = parseStartTimeSeconds(
    parsed.searchParams.get('t') || parsed.searchParams.get('start')
  );
  const startParam = startSeconds > 0 ? `&start=${startSeconds}` : '';

  return {
    id,
    embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${startParam}`,
    watchUrl: `https://www.youtube.com/watch?v=${id}${startSeconds > 0 ? `&t=${startSeconds}s` : ''}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    startSeconds,
  };
}

export function isExternalEmbedPlatformUrl(rawInput: string): boolean {
  if (parseYouTubeVideo(rawInput)) return true;
  const cleaned = extractCleanVideoUrl(rawInput);
  try {
    const parsed = new URL(cleaned);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    return (
      host === 'vimeo.com' ||
      host === 'player.vimeo.com' ||
      host === 'drive.google.com' ||
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host === 'youtube-nocookie.com'
    );
  } catch {
    return false;
  }
}

export function normalizeExternalUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';
  const iframeSrcMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const candidate = iframeSrcMatch ? iframeSrcMatch[1].trim() : trimmed;
  if (candidate.startsWith('//')) return `https:${candidate}`;
  if (
    !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate) &&
    !candidate.startsWith('/') &&
    !candidate.startsWith('data:') &&
    !candidate.startsWith('blob:') &&
    candidate.includes('.')
  ) {
    return `https://${candidate}`;
  }
  return candidate;
}

function extractGoogleDriveFileId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host !== 'drive.google.com' && host !== 'docs.google.com') return null;

    const pathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (pathMatch?.[1]) return pathMatch[1];

    const idParam = parsed.searchParams.get('id');
    if (idParam) return idParam;
  } catch {
    // ignore
  }
  return null;
}

export interface ResolvedPdfAttachment {
  isPdf: boolean;
  canEmbedPreview: boolean;
  previewSrc: string;
  downloadSrc: string;
  openSrc: string;
  isGoogleDrive: boolean;
}

export function isPdfAttachment(att: Pick<LessonAttachment, 'url' | 'fileName' | 'fileType' | 'mimeType'>): boolean {
  if (att.fileType === 'pdf') return true;
  if (att.mimeType?.toLowerCase() === 'application/pdf') return true;

  const url = (att.url || '').trim();
  const fileName = (att.fileName || '').trim();
  if (url.startsWith('data:application/pdf')) return true;

  const cleanUrlPath = url.split(/[?#]/)[0].toLowerCase();
  if (cleanUrlPath.endsWith('.pdf') || fileName.toLowerCase().endsWith('.pdf')) {
    return true;
  }
  return false;
}

export function resolvePdfAttachment(att: LessonAttachment): ResolvedPdfAttachment {
  const rawUrl = (att.url || '').trim();
  const driveId = extractGoogleDriveFileId(rawUrl);
  const pdfFlag = isPdfAttachment(att);

  if (driveId) {
    return {
      isPdf: pdfFlag || true,
      canEmbedPreview: true,
      previewSrc: `https://drive.google.com/file/d/${driveId}/preview`,
      downloadSrc: `https://drive.google.com/uc?export=download&id=${driveId}`,
      openSrc: `https://drive.google.com/file/d/${driveId}/view`,
      isGoogleDrive: true,
    };
  }

  let previewSrc = rawUrl;
  let downloadSrc = rawUrl;

  if (/dropbox\.com/i.test(rawUrl)) {
    try {
      const u = new URL(rawUrl);
      u.searchParams.delete('dl');
      u.searchParams.set('raw', '1');
      previewSrc = u.toString();

      const dl = new URL(rawUrl);
      dl.searchParams.delete('raw');
      dl.searchParams.set('dl', '1');
      downloadSrc = dl.toString();
    } catch {
      // keep original
    }
  } else if (rawUrl.startsWith('/uploads/') && pdfFlag) {
    downloadSrc = `${rawUrl}?download=1`;
  }

  return {
    isPdf: pdfFlag,
    canEmbedPreview: pdfFlag,
    previewSrc,
    downloadSrc,
    openSrc: rawUrl,
    isGoogleDrive: false,
  };
}

export interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  getDuration: () => number;
  getCurrentTime: () => number;
  getPlaybackRate: () => number;
  setPlaybackRate: (rate: number) => void;
  getAvailableQualityLevels: () => string[];
  getPlaybackQuality: () => string;
  setPlaybackQuality: (quality: string) => void;
  getPlayerState: () => number;
  unloadModule?: (moduleName: string) => void;
  setOption?: (module: string, option: string, value: unknown) => void;
  destroy: () => void;
}

export interface YTNamespace {
  Player: new (
    elementId: string | HTMLElement,
    options: {
      videoId: string;
      host?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number | undefined>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
        onPlaybackQualityChange?: (event: { data: string; target: YTPlayerInstance }) => void;
        onApiChange?: (event: { target: YTPlayerInstance }) => void;
        onError?: (event: { data: number }) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState?: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window unavailable'));
  }
  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve(window.YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') prevReady();
      if (window.YT && typeof window.YT.Player === 'function') {
        resolve(window.YT);
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        ytApiPromise = null;
        reject(new Error('Failed to load YouTube IFrame API'));
      };
      document.head.appendChild(script);
    }

    const pollInterval = window.setInterval(() => {
      if (window.YT && typeof window.YT.Player === 'function') {
        window.clearInterval(pollInterval);
        resolve(window.YT);
      }
    }, 100);

    window.setTimeout(() => {
      window.clearInterval(pollInterval);
      if (!window.YT || typeof window.YT.Player !== 'function') {
        ytApiPromise = null;
        reject(new Error('Timed out loading YouTube IFrame API'));
      }
    }, 12000);
  });

  return ytApiPromise;
}

export async function readYouTubeDurationSeconds(
  videoId: string,
  timeoutMs = 6000
): Promise<number> {
  if (typeof window === 'undefined' || !videoId) return 0;
  try {
    const YT = await loadYouTubeIframeApi();
    return await new Promise<number>((resolve) => {
      const hostEl = document.createElement('div');
      hostEl.style.position = 'fixed';
      hostEl.style.left = '-9999px';
      hostEl.style.top = '-9999px';
      hostEl.style.width = '1px';
      hostEl.style.height = '1px';
      hostEl.style.opacity = '0';
      hostEl.style.pointerEvents = 'none';
      const innerEl = document.createElement('div');
      hostEl.appendChild(innerEl);
      document.body.appendChild(hostEl);

      let player: YTPlayerInstance | null = null;
      let settled = false;
      let retryPoll: number | null = null;

      const cleanup = () => {
        if (retryPoll !== null) window.clearInterval(retryPoll);
        window.clearTimeout(hardTimer);
        if (player) {
          try {
            player.destroy();
          } catch {
            // ignore
          }
          player = null;
        }
        hostEl.remove();
      };

      const finish = (seconds: number) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0);
      };

      const hardTimer = window.setTimeout(() => finish(0), timeoutMs);

      player = new YT.Player(innerEl, {
        videoId,
        host: 'https://www.youtube.com',
        width: 1,
        height: 1,
        playerVars: {
          controls: 0,
          enablejsapi: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            const d = e.target.getDuration();
            if (Number.isFinite(d) && d > 0) {
              finish(d);
              return;
            }
            let attempts = 0;
            retryPoll = window.setInterval(() => {
              attempts += 1;
              const retried = e.target.getDuration();
              if (Number.isFinite(retried) && retried > 0) {
                finish(retried);
              } else if (attempts >= 8) {
                finish(0);
              }
            }, 200);
          },
          onError: () => finish(0),
        },
      });
    });
  } catch {
    return 0;
  }
}
