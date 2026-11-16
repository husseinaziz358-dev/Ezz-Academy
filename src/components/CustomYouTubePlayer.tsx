import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface YTPlayerInstance {
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

interface YTNamespace {
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

function loadYouTubeIframeApi(): Promise<YTNamespace> {
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

const QUALITY_LABELS: Record<string, string> = {
  auto: 'تلقائي (Auto)',
  highres: '2160p (4K)',
  hd2160: '2160p (4K)',
  hd1440: '1440p (HD)',
  hd1080: '1080p (FHD)',
  hd720: '720p (HD)',
  large: '480p',
  medium: '360p',
  small: '240p',
  tiny: '144p',
};

const DEFAULT_QUALITY_OPTIONS = ['auto', 'hd1080', 'hd720', 'large', 'medium', 'small'];
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const WATERMARK_POSITIONS: Array<{ top: string; left: string }> = [
  { top: '14%', left: '10%' },
  { top: '20%', left: '54%' },
  { top: '44%', left: '16%' },
  { top: '38%', left: '58%' },
  { top: '62%', left: '12%' },
  { top: '58%', left: '50%' },
];

function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
  const secs = Math.floor(totalSeconds);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stripYouTubeCaptions(p: YTPlayerInstance) {
  try {
    p.unloadModule?.('captions');
    p.unloadModule?.('cc');
    p.setOption?.('captions', 'track', {});
    p.setOption?.('cc', 'track', {});
  } catch {
    // Ignore when captions module is not loaded
  }
}

export interface CustomYouTubePlayerProps {
  videoId: string;
  title: string;
  startSeconds?: number;
  studentName?: string;
  studentEmail?: string;
  studentPhone?: string;
  onDurationDetected?: (seconds: number) => void;
  onProgressRatio?: (ratio: number) => void;
  onEnded?: () => void;
}

export function CustomYouTubePlayer({
  videoId,
  title,
  startSeconds = 0,
  studentName,
  studentEmail,
  studentPhone,
  onDurationDetected,
  onProgressRatio,
  onEnded,
}: CustomYouTubePlayerProps) {
  const reactId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const playerMountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const isSeekingRef = useRef<boolean>(false);

  const onDurationRef = useRef(onDurationDetected);
  onDurationRef.current = onDurationDetected;
  const onProgressRef = useRef(onProgressRatio);
  onProgressRef.current = onProgressRatio;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const [isReady, setIsReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [embedError, setEmbedError] = useState<string>('');

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [activeQuality, setActiveQuality] = useState<string>('auto');
  const [availableQualities, setAvailableQualities] = useState<string[]>(DEFAULT_QUALITY_OPTIONS);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed'>('main');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [watermarkIdx, setWatermarkIdx] = useState(0);

  const selectedQualityRef = useRef(selectedQuality);
  selectedQualityRef.current = selectedQuality;

  const revealControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = window.setTimeout(() => {
      if (playerRef.current?.getPlayerState() === 1 && !showSettings) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [showSettings]);

  // Move watermark smoothly across safe areas every 6.5s
  useEffect(() => {
    const id = window.setInterval(() => {
      setWatermarkIdx((prev) => (prev + 1) % WATERMARK_POSITIONS.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, []);

  // Track Fullscreen changes on the wrapper
  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement;
      setIsFullscreen(Boolean(fsEl && containerRef.current && fsEl === containerRef.current));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Initialize & clean up YouTube IFrame API player
  useEffect(() => {
    let cancelled = false;

    setIsReady(false);
    setHasStarted(false);
    setIsPlaying(false);
    setIsBuffering(false);
    setIsEnded(false);
    setEmbedError('');
    setCurrentTime(startSeconds || 0);
    setDuration(0);
    setShowSettings(false);
    setSettingsTab('main');

    const initPlayer = async () => {
      try {
        const YT = await loadYouTubeIframeApi();
        if (cancelled || !playerMountRef.current) return;

        // Ensure fresh mount node inside playerMountRef
        const targetEl = document.createElement('div');
        targetEl.id = `yt-wrap-${reactId}-${Date.now()}`;
        targetEl.className = 'w-full h-full';
        playerMountRef.current.innerHTML = '';
        playerMountRef.current.appendChild(targetEl);

        const instance = new YT.Player(targetEl, {
          videoId,
          host: 'https://www.youtube.com',
          width: '100%',
          height: '100%',
          playerVars: {
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            cc_load_policy: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            enablejsapi: 1,
            ...(startSeconds > 0 ? { start: startSeconds } : {}),
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              const p = e.target;
              playerRef.current = p;
              setIsReady(true);
              stripYouTubeCaptions(p);

              const dur = p.getDuration();
              if (Number.isFinite(dur) && dur > 0) {
                setDuration(dur);
                onDurationRef.current?.(Math.round(dur));
              }
              setVolume(p.getVolume());
              setIsMuted(p.isMuted());

              const iframeEl = playerMountRef.current?.querySelector('iframe');
              if (iframeEl) {
                iframeEl.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                iframeEl.setAttribute('tabindex', '-1');
                iframeEl.style.pointerEvents = 'none';
              }
            },
            onApiChange: (e) => {
              if (!cancelled) {
                stripYouTubeCaptions(e.target);
              }
            },
            onStateChange: (e) => {
              if (cancelled) return;
              const p = e.target;
              const st = e.data;
              stripYouTubeCaptions(p);
              // 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 3 = BUFFERING
              if (st === 1) {
                setHasStarted(true);
                setIsPlaying(true);
                setIsBuffering(false);
                setIsEnded(false);

                const dur = p.getDuration();
                if (Number.isFinite(dur) && dur > 0) {
                  setDuration(dur);
                  onDurationRef.current?.(Math.round(dur));
                }

                const levels = p.getAvailableQualityLevels();
                if (Array.isArray(levels) && levels.length > 0) {
                  const uniqueLevels = Array.from(new Set(['auto', ...levels]));
                  setAvailableQualities(uniqueLevels);
                }

                if (selectedQualityRef.current !== 'auto') {
                  p.setPlaybackQuality(selectedQualityRef.current);
                }
                const currentQ = p.getPlaybackQuality();
                if (currentQ) setActiveQuality(currentQ);
              } else if (st === 2) {
                setIsPlaying(false);
                setIsBuffering(false);
                setControlsVisible(true);
              } else if (st === 3) {
                setIsBuffering(true);
              } else if (st === 0) {
                setIsPlaying(false);
                setIsBuffering(false);
                setIsEnded(true);
                setControlsVisible(true);
                onProgressRef.current?.(1);
                onEndedRef.current?.();
              }
            },
            onPlaybackQualityChange: (e) => {
              if (!cancelled && e.data) {
                setActiveQuality(e.data);
              }
            },
            onError: (e) => {
              if (cancelled) return;
              if (e.data === 101 || e.data === 150 || e.data === 153) {
                setEmbedError(
                  'تعذر عرض الفيديو داخل المنصة لأن إعدادات الفيديو في يوتيوب تمنع التضمين الخارجي. يرجى تفعيل خيار «السماح بالتضمين» في استوديو يوتيوب.'
                );
              } else if (e.data === 100) {
                setEmbedError('الفيديو غير متاح أو تم حذفه من يوتيوب.');
              } else {
                setEmbedError('تعذر تشغيل فيديو يوتيوب حاليًا. يرجى التأكد من صحة الرابط.');
              }
            },
          },
        });

        playerRef.current = instance;
      } catch {
        if (!cancelled) {
          setEmbedError('تعذر تحميل مشغل الفيديو المخصص. تحقق من اتصال الإنترنت وأعد المحاولة.');
        }
      }
    };

    void initPlayer();

    return () => {
      cancelled = true;
      if (hideControlsTimerRef.current) window.clearTimeout(hideControlsTimerRef.current);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore destroy errors
        }
        playerRef.current = null;
      }
    };
  }, [videoId, startSeconds, reactId]);

  // Poll playback progress while playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || isSeekingRef.current) return;
      const cur = p.getCurrentTime();
      const dur = p.getDuration();
      if (Number.isFinite(cur)) setCurrentTime(cur);
      if (Number.isFinite(dur) && dur > 0) {
        setDuration(dur);
        onProgressRef.current?.(cur / dur);
      }
    }, 350);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p || !isReady) return;
    revealControlsTemporarily();
    if (isPlaying) {
      p.pauseVideo();
    } else {
      if (isEnded) {
        p.seekTo(0, true);
      }
      p.playVideo();
    }
  };

  const skipBy = (deltaSeconds: number) => {
    const p = playerRef.current;
    if (!p || !isReady) return;
    const dur = duration || p.getDuration() || 0;
    const next = Math.max(0, Math.min(dur || Number.MAX_SAFE_INTEGER, currentTime + deltaSeconds));
    setCurrentTime(next);
    p.seekTo(next, true);
    revealControlsTemporarily();
  };

  const handleSeekChange = (nextSeconds: number) => {
    setCurrentTime(nextSeconds);
    const p = playerRef.current;
    if (p && isReady) {
      p.seekTo(nextSeconds, true);
    }
  };

  const handleToggleMute = () => {
    const p = playerRef.current;
    if (!p || !isReady) return;
    if (isMuted || volume === 0) {
      p.unMute();
      const restored = volume > 0 ? volume : 80;
      p.setVolume(restored);
      setVolume(restored);
      setIsMuted(false);
    } else {
      p.mute();
      setIsMuted(true);
    }
    revealControlsTemporarily();
  };

  const handleVolumeChange = (nextVol: number) => {
    setVolume(nextVol);
    const p = playerRef.current;
    if (!p || !isReady) return;
    if (nextVol <= 0) {
      p.mute();
      setIsMuted(true);
    } else {
      if (isMuted) p.unMute();
      p.setVolume(nextVol);
      setIsMuted(false);
    }
    revealControlsTemporarily();
  };

  const handleSelectQuality = (q: string) => {
    setSelectedQuality(q);
    const p = playerRef.current;
    if (p && isReady) {
      p.setPlaybackQuality(q);
      if (q !== 'auto') {
        setActiveQuality(q);
      }
    }
    setSettingsTab('main');
    setShowSettings(false);
  };

  const handleSelectSpeed = (rate: number) => {
    setPlaybackRate(rate);
    const p = playerRef.current;
    if (p && isReady) {
      p.setPlaybackRate(rate);
    }
    setSettingsTab('main');
    setShowSettings(false);
  };

  const handleToggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen denial
    }
  };

  const watermarkCoords = WATERMARK_POSITIONS[watermarkIdx];
  const watermarkLabelPrimary = (studentName || '').trim() || 'طالب Ezz Academy';
  const watermarkLabelSecondary =
    (studentEmail || '').trim() || (studentPhone || '').trim() || 'Ezz Academy Student';

  const qualityDisplayLabel = useMemo(() => {
    if (selectedQuality === 'auto') {
      const actual = activeQuality && activeQuality !== 'auto' ? QUALITY_LABELS[activeQuality] : '';
      return actual ? `تلقائي (${actual.split(' ')[0]})` : 'تلقائي';
    }
    return (QUALITY_LABELS[selectedQuality] || selectedQuality).split(' ')[0];
  }, [selectedQuality, activeQuality]);

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragStart={(e) => e.preventDefault()}
      onMouseMove={revealControlsTemporarily}
      onMouseLeave={() => {
        if (isPlaying && !showSettings) setControlsVisible(false);
      }}
      onTouchStart={revealControlsTemporarily}
      className={`relative w-full bg-black select-none overflow-hidden group flex items-center justify-center ${
        isFullscreen ? 'w-screen h-screen' : 'aspect-video'
      }`}
    >
      {/* Centered 16:9 Stage (clips out YouTube's top channel/title bar & bottom logo/shelf even in fullscreen) */}
      <div
        className={`relative aspect-video overflow-hidden bg-black ${
          isFullscreen ? 'w-[min(100vw,calc(100vh*16/9))]' : 'w-full'
        }`}
      >
        {/* 1. Vertically padded IFrame Mount so YouTube chrome renders outside the clipped 16:9 stage */}
        <div
          ref={playerMountRef}
          style={{ top: '-76px', height: 'calc(100% + 152px)' }}
          className="absolute inset-x-0 w-full pointer-events-none"
        />

        {/* 2. Pre-Play & End-Screen Poster Curtain (completely hides YouTube pre-play UI, Share, Logo & related videos) */}
        {(!hasStarted || isEnded) && !embedError && (
          <div className="absolute inset-0 z-10 bg-slate-950">
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt={title}
              draggable={false}
              className="w-full h-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/55" />
          </div>
        )}

        {/* 3. Full Transparent Protection Overlay (blocks right-click & ALL outbound YouTube links/UI clicks) */}
        {!embedError && (
          <div
            role="button"
            tabIndex={0}
            aria-label={isPlaying ? 'إيقاف الفيديو مؤقتًا' : 'تشغيل الفيديو'}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => {
              if (showSettings) {
                setShowSettings(false);
                setSettingsTab('main');
                return;
              }
              togglePlay();
            }}
            onDoubleClick={() => void handleToggleFullscreen()}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                togglePlay();
              }
            }}
            className="absolute inset-0 z-20 cursor-pointer bg-transparent"
          />
        )}

        {/* 4. Center Play / Replay / Buffering Visual Indicator */}
        {!embedError && (!hasStarted || isEnded || isBuffering) && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
            {isBuffering ? (
              <div className="w-14 h-14 rounded-full bg-slate-950/80 border border-white/20 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-700/95 text-white shadow-xl border-2 border-white/25 flex items-center justify-center transition-transform group-hover:scale-105">
                {isEnded ? (
                  <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8" />
                ) : (
                  <Play className="w-7 h-7 sm:w-9 sm:h-9 translate-x-0.5 fill-current" />
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. Moving Light Watermark (Student Name + Registered Email/Identifier) */}
        {!embedError && (
          <div
            aria-hidden="true"
            style={{ top: watermarkCoords.top, left: watermarkCoords.left }}
            className="absolute z-20 pointer-events-none select-none transition-all duration-[2600ms] ease-in-out max-w-[42%]"
          >
            <div className="px-2.5 py-1 rounded bg-black/15 backdrop-blur-[1px] border border-white/10 text-white/45 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              <div className="text-[11px] sm:text-xs font-bold leading-tight truncate">
                {watermarkLabelPrimary}
              </div>
              <div
                dir="ltr"
                className="text-[10px] sm:text-[11px] font-mono leading-tight truncate opacity-90"
              >
                {watermarkLabelSecondary}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Embed Error Fallback (never leaks outbound link) */}
      {embedError && (
        <div className="absolute inset-0 z-30 bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-3">
          <AlertTriangle className="w-9 h-9 text-amber-400" />
          <p className="text-xs sm:text-sm text-slate-200 max-w-md leading-relaxed">{embedError}</p>
        </div>
      )}

      {/* 8. Custom Control Bar (Play/Pause, Seek, Volume, Settings Quality/Speed, Fullscreen) */}
      {!embedError && (
        <div
          dir="ltr"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-3 sm:px-4 pt-6 pb-2.5 transition-opacity duration-200 ${
            controlsVisible || !isPlaying || showSettings
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Progress / Seek Bar */}
          <div className="relative flex items-center mb-2 group/seek">
            <div className="w-full h-1.5 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-[width] duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <input
              type="range"
              aria-label="شريط تقديم الفيديو"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.5}
              value={duration > 0 ? currentTime : 0}
              onMouseDown={() => {
                isSeekingRef.current = true;
              }}
              onMouseUp={() => {
                isSeekingRef.current = false;
              }}
              onTouchStart={() => {
                isSeekingRef.current = true;
              }}
              onTouchEnd={() => {
                isSeekingRef.current = false;
              }}
              onChange={(e) => handleSeekChange(Number(e.target.value))}
              className="absolute inset-0 w-full h-4 -top-1 opacity-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-white">
            {/* Left controls: Play/Pause, Skip, Volume, Timestamp */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <button
                type="button"
                disabled={!isReady}
                onClick={togglePlay}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                ) : (
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                )}
              </button>

              <button
                type="button"
                disabled={!isReady}
                onClick={() => skipBy(-10)}
                aria-label="رجوع 10 ثواني"
                title="رجوع 10 ثواني"
                className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50 transition-colors cursor-pointer hidden xs:inline-flex sm:inline-flex"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={!isReady}
                onClick={() => skipBy(10)}
                aria-label="تقديم 10 ثواني"
                title="تقديم 10 ثواني"
                className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50 transition-colors cursor-pointer hidden xs:inline-flex sm:inline-flex"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume Control */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!isReady}
                  onClick={handleToggleMute}
                  aria-label={isMuted || volume === 0 ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                  className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
                <input
                  type="range"
                  aria-label="مستوى الصوت"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-14 sm:w-20 h-1 accent-blue-500 cursor-pointer"
                />
              </div>

              <span className="text-[11px] sm:text-xs font-mono text-slate-200 tabular-nums px-1">
                {formatClock(currentTime)} / {formatClock(duration)}
              </span>
            </div>

            {/* Right controls: Settings (Quality + Speed) & Fullscreen */}
            <div className="relative flex items-center gap-1 shrink-0">
              {showSettings && (
                <div
                  dir="rtl"
                  className="absolute bottom-11 right-0 w-56 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl p-2 text-xs text-white z-40"
                >
                  {settingsTab === 'main' && (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setSettingsTab('quality')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <span className="font-semibold">جودة الفيديو</span>
                        <span className="text-blue-300 font-mono">{qualityDisplayLabel}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettingsTab('speed')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <span className="font-semibold">سرعة التشغيل</span>
                        <span className="text-blue-300 font-mono">{playbackRate}x</span>
                      </button>
                    </div>
                  )}

                  {settingsTab === 'quality' && (
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => setSettingsTab('main')}
                        className="w-full text-right px-3 py-1.5 text-[11px] font-bold text-slate-300 border-b border-slate-700/80 hover:text-white cursor-pointer"
                      >
                        ← الرجوع للإعدادات
                      </button>
                      {availableQualities.map((q) => {
                        const isSelected = selectedQuality === q;
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => handleSelectQuality(q)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                              isSelected ? 'bg-blue-700 text-white' : 'hover:bg-white/10'
                            }`}
                          >
                            <span>{QUALITY_LABELS[q] || q}</span>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {settingsTab === 'speed' && (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setSettingsTab('main')}
                        className="w-full text-right px-3 py-1.5 text-[11px] font-bold text-slate-300 border-b border-slate-700/80 hover:text-white cursor-pointer"
                      >
                        ← الرجوع للإعدادات
                      </button>
                      {SPEED_OPTIONS.map((rate) => {
                        const isSelected = playbackRate === rate;
                        return (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => handleSelectSpeed(rate)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                              isSelected ? 'bg-blue-700 text-white' : 'hover:bg-white/10'
                            }`}
                          >
                            <span className="font-mono">{rate === 1 ? 'عادي (1x)' : `${rate}x`}</span>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={!isReady}
                onClick={() => {
                  setSettingsTab('main');
                  setShowSettings((s) => !s);
                }}
                aria-label="إعدادات الجودة والسرعة"
                title="إعدادات المشغل"
                className={`p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-50 transition-colors cursor-pointer ${
                  showSettings ? 'bg-white/20 text-blue-300' : ''
                }`}
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                type="button"
                onClick={() => void handleToggleFullscreen()}
                aria-label={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
                title={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
