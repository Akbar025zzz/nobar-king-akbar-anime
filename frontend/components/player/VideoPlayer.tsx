"use client";

import Hls from "hls.js";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { formatTime } from "@/lib/format";
import type { StreamSource } from "@/lib/types";

export interface VideoPlayerHandle {
  getCurrentTime: () => number;
  getDuration: () => number;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
}

export interface PlayerSyncTarget {
  isPlaying: boolean;
  position: number;
}

interface VideoPlayerProps {
  source: StreamSource | null;
  poster?: string | null;
  autoPlay?: boolean;
  roomMode?: boolean;
  canControl?: boolean;
  syncTarget?: PlayerSyncTarget | null;
  onProgress?: (position: number, duration: number) => void;
  onPlayingChange?: (playing: boolean, position: number) => void;
  onSeek?: (position: number) => void;
  onEnded?: () => void;
  className?: string;
}

const SYNC_TOLERANCE_SECONDS = 1.6;
const HOST_CATCHUP_SECONDS = 4;

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  {
    source,
    poster,
    autoPlay = false,
    roomMode = false,
    canControl = true,
    syncTarget = null,
    onProgress,
    onPlayingChange,
    onSeek,
    onEnded,
    className = "",
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastReportRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep callbacks in a ref: parent renders (e.g. realtime sync) must never
  // re-attach the media source.
  const callbacksRef = useRef({ onProgress, onPlayingChange, onSeek, onEnded });
  useEffect(() => {
    callbacksRef.current = { onProgress, onPlayingChange, onSeek, onEnded };
  }, [onProgress, onPlayingChange, onSeek, onEnded]);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration ?? 0,
    play: () => {
      void videoRef.current?.play().catch(() => undefined);
    },
    pause: () => {
      videoRef.current?.pause();
    },
    seekTo: (seconds: number) => {
      if (videoRef.current && Number.isFinite(seconds)) {
        videoRef.current.currentTime = Math.max(0, seconds);
      }
    },
  }));

  /* ------------------------- media attachment ------------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setReady(false);
    setError(null);
    setNeedsGesture(false);
    setBuffering(false);

    if (!source?.url) {
      return;
    }

    // Provider embed (film): media diputar di dalam iframe milik provider,
    // jadi elemen <video> tidak perlu dilibatkan sama sekali.
    if (source.type === "iframe" || source.type === "embed") {
      setReady(true);
      return;
    }

    let hls: Hls | null = null;

    const attachNative = () => {
      video.src = source.url;
    };

    if (source.type === "hls") {
      if (Hls.isSupported()) {
        hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          enableWorker: true,
          lowLatencyMode: false,
        });
        hlsRef.current = hls;
        hls.loadSource(source.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls?.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls?.recoverMediaError();
            } else {
              setError("Gagal memuat aliran video. Coba muat ulang.");
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        attachNative();
      } else {
        setError("Browser ini tidak mendukung pemutaran HLS.");
      }
    } else {
      attachNative();
    }

    const onLoadedMetadata = () => {
      setReady(true);
      setDuration(video.duration || 0);
    };
    const onCanPlay = () => {
      setReady(true);
      if (autoPlay && canControl) {
        void video.play().catch(() => setNeedsGesture(true));
      }
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      const now = Date.now();
      const progressHandler = callbacksRef.current.onProgress;
      if (progressHandler && now - lastReportRef.current > 5000 && video.duration > 0) {
        lastReportRef.current = now;
        progressHandler(video.currentTime, video.duration);
      }
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onPlay = () => {
      setPlaying(true);
      setNeedsGesture(false);
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onEndedInternal = () => {
      setPlaying(false);
      callbacksRef.current.onEnded?.();
    };
    const onErrorInternal = () => {
      if (source.type !== "hls" || !Hls.isSupported()) {
        setError("Video tidak dapat diputar. Coba server lain atau muat ulang.");
      }
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEndedInternal);
    video.addEventListener("error", onErrorInternal);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEndedInternal);
      video.removeEventListener("error", onErrorInternal);
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [source?.url, source?.type, autoPlay, canControl, retryKey]);

  /* --------------------------- room sync --------------------------- */

  // Host: resume from the room position once per media attachment (e.g. after
  // a page refresh) — then full control stays with the host.
  const hostResumeRef = useRef(false);

  useEffect(() => {
    hostResumeRef.current = false;
  }, [source?.url, retryKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !roomMode || !syncTarget) return;
    // Never touch the media before metadata exists: setting currentTime on an
    // empty element installs a "default playback start position" and causes
    // stray seeks when the stream attaches later.
    if (video.readyState < 1) return;

    const target = syncTarget.position;

    if (canControl) {
      if (!hostResumeRef.current) {
        hostResumeRef.current = true;
        if (target > 1 && Math.abs(video.currentTime - target) > 5) {
          video.currentTime = target;
        }
        return;
      }
      // Catch-up: kalau stream host tersendat (buffering) sementara timeline room
      // tetap berjalan, host ditarik kembali ke posisi kanonik room.
      if (syncTarget.isPlaying && !video.paused && Math.abs(video.currentTime - target) > HOST_CATCHUP_SECONDS) {
        video.currentTime = Math.max(0, target);
      }
      return;
    }

    const drift = Math.abs(video.currentTime - target);
    if (syncTarget.isPlaying) {
      if (drift > SYNC_TOLERANCE_SECONDS) {
        video.currentTime = Math.max(0, target);
      }
      if (video.paused) {
        void video.play().catch(() => setNeedsGesture(true));
      }
    } else {
      if (drift > SYNC_TOLERANCE_SECONDS) {
        video.currentTime = Math.max(0, target);
      }
      if (!video.paused) {
        video.pause();
      }
    }
  }, [roomMode, syncTarget, canControl, ready, source?.url]);

  /* ------------------------- controls helpers ------------------------- */

  const emitPlaying = useCallback(
    (isPlaying: boolean, position: number) => {
      callbacksRef.current.onPlayingChange?.(isPlaying, position);
    },
    []
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !canControl) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
      emitPlaying(true, video.currentTime);
    } else {
      video.pause();
      emitPlaying(false, video.currentTime);
    }
  }, [canControl, emitPlaying]);

  const commitSeek = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video || !canControl) return;
      video.currentTime = Math.max(0, seconds);
      setCurrentTime(seconds);
      callbacksRef.current.onSeek?.(seconds);
    },
    [canControl]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const changeVolume = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const revealControls = useCallback(() => {
    if (!roomMode) return;
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!videoRef.current?.paused) setControlsVisible(false);
    }, 3200);
  }, [roomMode]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  /* --------------------------- shortcuts --------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const video = videoRef.current;
      if (!video) return;

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowRight") {
        commitSeek(video.currentTime + 10);
      } else if (event.key === "ArrowLeft") {
        commitSeek(video.currentTime - 10);
      } else if (event.key.toLowerCase() === "m") {
        toggleMute();
      } else if (event.key.toLowerCase() === "f") {
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, commitSeek, toggleMute, toggleFullscreen]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showControls = !roomMode || controlsVisible || !playing;

  // Film & series diputar lewat player mitra (iframe). Kontrol pemutar ada di
  // sisi provider, jadi di sini kita hanya menampilkan player itu apa adanya —
  // tanpa tombol palsu yang tidak berfungsi.
  if (source && (source.type === "iframe" || source.type === "embed")) {
    return (
      <div
        className={`relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-black ${className ?? ""}`}
      >
        <iframe
          key={source.id}
          src={source.url}
          title={source.label ?? "Pemutar mitra"}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="origin-when-cross-origin"
          className="h-full w-full"
        />
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          <span className="glass rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fog-200">
            {source.label ?? source.server ?? "Pemutar mitra"}
          </span>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="glass absolute right-3 top-3 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-fog-100 transition-colors hover:text-accent-300"
        >
          Buka di tab baru
        </a>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={revealControls}
      onMouseLeave={() => roomMode && playing && setControlsVisible(false)}
      className={`group/player relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-black ${className}`}
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
      />

      {buffering && !error ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-accent-500" />
        </div>
      ) : null}

      {needsGesture && !error ? (
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            void video.play().catch(() => undefined);
            setNeedsGesture(false);
          }}
          className="absolute inset-0 grid place-items-center bg-ink-950/60 backdrop-blur-[2px]"
          aria-label="Putar video"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-500 text-ink-950 shadow-[0_0_0_1px_rgba(85,203,216,0.5),0_20px_50px_-15px_rgba(85,203,216,0.9)]">
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4.5 3.4v9.2c0 .8.9 1.3 1.6.9l6.6-4.6c.6-.4.6-1.4 0-1.8L6.1 2.5c-.7-.4-1.6.1-1.6.9Z" fill="currentColor" />
            </svg>
          </span>
        </button>
      ) : null}

      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-ink-950/85 px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-rose-400">{error}</p>
            <button
              type="button"
              className="btn btn-outline mt-4 !py-2 text-xs"
              onClick={() => setRetryKey((key) => key + 1)}
            >
              Muat ulang pemutar
            </button>
          </div>
        </div>
      ) : null}

      {!ready && source && !error ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-accent-500" />
        </div>
      ) : null}

      {!source && !error ? (
        <div className="absolute inset-0 grid place-items-center bg-ink-900 text-sm text-fog-500">
          Menyiapkan sumber video…
        </div>
      ) : null}

      {/* ------------------------- control bar ------------------------- */}
      {source && !error ? (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink-950/95 via-ink-950/70 to-transparent px-3 pb-2.5 pt-10 transition-opacity duration-300 sm:px-4 ${
            showControls ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="w-12 text-right font-mono text-[11px] text-fog-300 sm:w-14">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1">
              <input
                type="range"
                min={0}
                max={duration > 0 ? duration : 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                disabled={!canControl}
                onChange={(event) => {
                  if (canControl) {
                    setCurrentTime(Number(event.target.value));
                  }
                }}
                onPointerUp={(event) => {
                  commitSeek(Number((event.target as HTMLInputElement).value));
                }}
                onKeyUp={(event) => {
                  commitSeek(Number((event.target as HTMLInputElement).value));
                }}
                aria-label="Posisi video"
                className={`peer h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#55cbd8] ${
                  canControl ? "" : "cursor-default opacity-70"
                }`}
                style={{
                  background: `linear-gradient(90deg, #55cbd8 ${progressPercent}%, rgba(255,255,255,0.16) ${progressPercent}%)`,
                }}
              />
            </div>
            <span className="w-12 font-mono text-[11px] text-fog-500 sm:w-14">{formatTime(duration)}</span>

            <button
              type="button"
              onClick={togglePlay}
              disabled={!canControl}
              className="btn btn-ghost !rounded-full !p-2"
              aria-label={playing ? "Jeda" : "Putar"}
            >
              {playing ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M7 4.8v14.4c0 .9 1 1.5 1.8 1l11-7.2c.7-.5.7-1.5 0-2l-11-7.2c-.8-.5-1.8.1-1.8 1Z" />
                </svg>
              )}
            </button>

            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={toggleMute}
                className="btn btn-ghost !rounded-full !p-2"
                aria-label={muted ? "Aktifkan suara" : "Bisukan"}
              >
                {muted ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M4 9.5h3L11 6v12l-4-3.5H4v-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="m16 9 5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M4 9.5h3L11 6v12l-4-3.5H4v-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M15.5 9.5a4 4 0 0 1 0 5M18 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(event) => changeVolume(Number(event.target.value))}
                aria-label="Volume"
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/15 accent-[#55cbd8]"
                style={{
                  background: `linear-gradient(90deg, #55cbd8 ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.16) ${(muted ? 0 : volume) * 100}%)`,
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="btn btn-ghost !rounded-full !p-2"
              aria-label={isFullscreen ? "Keluar layar penuh" : "Layar penuh"}
            >
              {isFullscreen ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>

          {roomMode && !canControl ? (
            <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-fog-500">
              Host mengontrol pemutaran · kamu menonton tersinkron
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
