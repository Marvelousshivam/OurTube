import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';
import { useVideoShaderStore } from '../../store/videoShaderStore';
import { KodaVideoShaderCanvas, buildCssVideoFilter } from './KodaVideoShaderCanvas';
import { wrapChunkedStreamUrl, prewarmStreamBytes } from '../../api/streamResolver';

/**
 * NativeVideoPlayerEngine
 *
 * Persistent ExoPlayer-inspired dual-element media engine:
 * - Bounded-range ChunkedStreamDataSource integration (bypasses googlevideo.com 1.0x open-ended Range throttling)
 * - Zero-Blackness Pipeline:
 *   1. High-Res Ambient + Sharp Poster Curtain held until the first decoded video frame (readyState >= 2)
 *   2. Freeze-Frame <canvas> Bridge during Quality (1080p <-> 720p) or Audio Track switches (0ms black flash)
 * - Zero-stutter PLL rate synchronization & mutual buffer hold for split adaptive 1080p streams
 * - Debounced buffering state that never gets stuck on screen once frames advance
 * - Automatic Koda VideoRecoveryPolicy (silent fallback from chunked SW -> direct URL -> muxed 720p)
 * - Real-time Koda 16-preset WebGL + SVG Video Shader pipeline & picture tuning sliders
 */
export interface NativeVideoPlayerEngineProps {
  onEnded?: () => void;
}

export const NativeVideoPlayerEngine: React.FC<NativeVideoPlayerEngineProps> = ({ onEnded }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const freezeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waitingTimerRef = useRef<number | null>(null);
  const lastTimeUpdatePosRef = useRef<number>(-1);
  const lastAppliedSeekNonceRef = useRef<number>(0);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const lastHardSyncMsRef = useRef<number>(0);
  const lastLoadedVideoIdRef = useRef<string | null>(null);
  const recoveryAttemptRef = useRef<{ videoId: string; count: number }>({ videoId: '', count: 0 });

  const [webglShaderActive, setWebglShaderActive] = useState(false);
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = useState(false);
  const [isHoldingFreezeFrame, setIsHoldingFreezeFrame] = useState(false);
  const [bypassChunkedSwForId, setBypassChunkedSwForId] = useState<string | null>(null);

  const {
    currentVideo,
    streamVideoUrl,
    streamAudioUrl,
    isPlaying,
    volume,
    isMuted,
    seekTarget,
    playbackMode,
    isVideoWatchOpen,
    isMiniVideoPlayerOpen,
    videoPlaybackError,
    playbackSpeed,
    isHoldTo2x,
    isLooping,
    fitMode,
    videoQuality,
    updatePlaybackProgress,
    setBuffering,
    setVideoPlaybackError,
    retryVideoStream
  } = usePlayerStore();

  const shaderSettings = useVideoShaderStore();

  const isSeparateAudio = Boolean(
    streamVideoUrl &&
      streamAudioUrl &&
      streamAudioUrl !== streamVideoUrl
  );

  const shouldBypassSw = Boolean(currentVideo?.id && bypassChunkedSwForId === currentVideo.id);
  const effectiveVideoUrl = shouldBypassSw
    ? streamVideoUrl
    : wrapChunkedStreamUrl(streamVideoUrl) || streamVideoUrl;
  const effectiveAudioUrl = shouldBypassSw
    ? streamAudioUrl
    : wrapChunkedStreamUrl(streamAudioUrl) || streamAudioUrl;

  const effectiveSpeed = isHoldTo2x ? Math.max(2.0, playbackSpeed) : playbackSpeed;
  const effectiveFit = shaderSettings.zoomToFill || fitMode === 'fill' ? 'cover' : 'contain';

  const captureFreezeFrame = useCallback(() => {
    const v = videoRef.current;
    const canvas = freezeCanvasRef.current;
    if (!v || !canvas || v.readyState < 2 || !v.videoWidth || !v.videoHeight) return false;
    try {
      canvas.width = Math.min(1280, v.videoWidth);
      canvas.height = Math.min(720, v.videoHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      setIsHoldingFreezeFrame(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearBufferingState = useCallback(() => {
    if (waitingTimerRef.current !== null) {
      window.clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
    if (usePlayerStore.getState().isBuffering) {
      setBuffering(false);
    }
  }, [setBuffering]);

  const scheduleBufferingState = useCallback(() => {
    if (waitingTimerRef.current !== null) {
      window.clearTimeout(waitingTimerRef.current);
    }
    waitingTimerRef.current = window.setTimeout(() => {
      waitingTimerRef.current = null;
      const v = videoRef.current;
      if (v && (v.seeking || v.readyState < 3)) {
        setBuffering(true);
      }
    }, 280);
  }, [setBuffering]);

  const computeBufferedEnd = (v: HTMLVideoElement): number => {
    try {
      const buf = v.buffered;
      if (!buf || buf.length === 0) return 0;
      const cur = v.currentTime || 0;
      for (let i = 0; i < buf.length; i++) {
        if (buf.start(i) <= cur + 0.5 && buf.end(i) >= cur) {
          return buf.end(i);
        }
      }
      return buf.end(buf.length - 1);
    } catch {
      return 0;
    }
  };

  // Reset recovery counter & first-frame curtain when opening a new video
  useEffect(() => {
    if (currentVideo?.id && recoveryAttemptRef.current.videoId !== currentVideo.id) {
      recoveryAttemptRef.current = { videoId: currentVideo.id, count: 0 };
      lastTimeUpdatePosRef.current = -1;
      setHasRenderedFirstFrame(false);
      setIsHoldingFreezeFrame(false);
    }
  }, [currentVideo?.id]);

  // Clean up waiting timer on unmount
  useEffect(() => {
    return () => {
      if (waitingTimerRef.current !== null) {
        window.clearTimeout(waitingTimerRef.current);
      }
    };
  }, []);

  // Load Video & Optional Separate Audio Source when URLs change
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    if (!effectiveVideoUrl || !streamVideoUrl || playbackMode !== 'video' || !currentVideo) {
      clearBufferingState();
      setHasRenderedFirstFrame(false);
      setIsHoldingFreezeFrame(false);
      if (video.src) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      if (audio && audio.src) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      return;
    }

    // Warm the initial bounded byte range (768KB / 1.5MB) in background
    prewarmStreamBytes(streamVideoUrl);
    if (isSeparateAudio && streamAudioUrl) {
      prewarmStreamBytes(streamAudioUrl);
    }

    const storeState = usePlayerStore.getState();
    const isSameVideoQualitySwitch = lastLoadedVideoIdRef.current === currentVideo.id;
    const targetResume =
      storeState.seekTarget?.time ??
      (isSameVideoQualitySwitch && video.currentTime > 0.5
        ? video.currentTime
        : storeState.currentTime);

    let sourceChanged = false;
    const currentVideoAttrSrc = video.getAttribute('src') || '';
    if (currentVideoAttrSrc !== effectiveVideoUrl && video.src !== effectiveVideoUrl) {
      sourceChanged = true;
      // If switching quality/audio on the SAME video, snapshot the current decoded frame onto freezeCanvasRef
      // so the user sees 0ms of black screen while the new resolution loads and seeks!
      if (isSameVideoQualitySwitch && hasRenderedFirstFrame) {
        captureFreezeFrame();
      } else if (!isSameVideoQualitySwitch) {
        setHasRenderedFirstFrame(false);
        setIsHoldingFreezeFrame(false);
      }

      if (targetResume > 0.5) {
        pendingSeekTimeRef.current = targetResume;
      }
      lastLoadedVideoIdRef.current = currentVideo.id;
      video.src = effectiveVideoUrl;
      video.load();
    }

    if (audio) {
      if (isSeparateAudio && effectiveAudioUrl) {
        const currentAudioAttrSrc = audio.getAttribute('src') || '';
        if (currentAudioAttrSrc !== effectiveAudioUrl && audio.src !== effectiveAudioUrl) {
          audio.src = effectiveAudioUrl;
          audio.load();
          if (targetResume > 0.5) {
            try {
              audio.currentTime = targetResume;
            } catch {}
          }
        }
        audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
        audio.muted = isMuted;
        video.muted = true;
        video.volume = 0;
      } else {
        if (audio.src) {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        }
        video.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
        video.muted = isMuted;
      }
    }

    video.playbackRate = effectiveSpeed;
    if (audio) audio.playbackRate = effectiveSpeed;

    if (storeState.isPlaying) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (isSeparateAudio && audio && audio.src && usePlayerStore.getState().isPlaying) {
              if (Math.abs(audio.currentTime - video.currentTime) > 0.25) {
                try {
                  audio.currentTime = video.currentTime;
                } catch {}
              }
              audio.play().catch(() => {});
            }
          })
          .catch((err) => {
            if (sourceChanged) {
              console.warn('[NativeVideoPlayerEngine] Video play start warning:', err);
            }
          });
      }
    }
  }, [
    effectiveVideoUrl,
    effectiveAudioUrl,
    streamVideoUrl,
    streamAudioUrl,
    isSeparateAudio,
    playbackMode,
    currentVideo?.id
  ]);

  // Sync Play / Pause state
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !streamVideoUrl || playbackMode !== 'video') return;

    if (isPlaying) {
      if (video.paused) {
        video.play().catch(() => {});
      }
      if (isSeparateAudio && audio && audio.src && audio.paused && video.readyState >= 3 && !video.seeking) {
        if (Math.abs(audio.currentTime - video.currentTime) > 0.25) {
          try {
            audio.currentTime = video.currentTime;
          } catch {}
        }
        audio.play().catch(() => {});
      }
    } else {
      clearBufferingState();
      if (!video.paused) video.pause();
      if (audio && !audio.paused) audio.pause();
    }
  }, [isPlaying, playbackMode, streamVideoUrl, isSeparateAudio, clearBufferingState]);

  // Sync Volume & Mute
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const clampedVol = isMuted ? 0 : Math.max(0, Math.min(1, volume));

    if (isSeparateAudio) {
      if (video) {
        video.muted = true;
        video.volume = 0;
      }
      if (audio) {
        audio.volume = clampedVol;
        audio.muted = isMuted;
      }
    } else {
      if (video) {
        video.volume = clampedVol;
        video.muted = isMuted;
      }
    }
  }, [volume, isMuted, isSeparateAudio]);

  // Sync Explicit Programmatic Seek (via seekTarget nonce — never triggered by onTimeUpdate!)
  useEffect(() => {
    if (!seekTarget || seekTarget.nonce === lastAppliedSeekNonceRef.current) return;
    if (playbackMode !== 'video') return;

    lastAppliedSeekNonceRef.current = seekTarget.nonce;
    const targetTime = Math.max(0, seekTarget.time);
    const video = videoRef.current;
    const audio = audioRef.current;

    if (!video || !video.src) {
      pendingSeekTimeRef.current = targetTime;
      return;
    }

    if (video.readyState === 0) {
      pendingSeekTimeRef.current = targetTime;
      return;
    }

    try {
      if (Math.abs(video.currentTime - targetTime) > 0.15) {
        video.currentTime = targetTime;
      }
      if (isSeparateAudio && audio && audio.src) {
        audio.currentTime = targetTime;
      }
    } catch {
      pendingSeekTimeRef.current = targetTime;
    }
  }, [seekTarget, playbackMode, isSeparateAudio]);

  // Sync Playback Speed & Hold-to-Boost
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) video.playbackRate = effectiveSpeed;
    if (audio && isSeparateAudio) audio.playbackRate = effectiveSpeed;
  }, [effectiveSpeed, isSeparateAudio]);

  // Sync Loop Mode
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) video.loop = isLooping;
    if (audio) audio.loop = isLooping;
  }, [isLooping]);

  // PLL Soft Clock Synchronization for Separate Video + Audio Streams (Zero Seek-Storms)
  useEffect(() => {
    if (!isSeparateAudio || !isPlaying || playbackMode !== 'video') return;

    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!video || !audio || !video.src || !audio.src) return;

      // Mutual buffer hold: if video is seeking or buffering, keep audio paused so it never runs ahead
      if (video.seeking || video.readyState < 3 || video.paused) {
        if (!audio.paused) {
          audio.pause();
        }
        return;
      }

      // Video has enough future data and is playing: ensure audio is playing too
      if (audio.seeking || audio.readyState < 2) {
        return;
      }

      if (audio.paused) {
        if (Math.abs(audio.currentTime - video.currentTime) > 0.2) {
          try {
            audio.currentTime = video.currentTime;
          } catch {}
        }
        audio.play().catch(() => {});
        return;
      }

      // Calculate A/V drift: positive means audio is ahead of video
      const drift = audio.currentTime - video.currentTime;
      const absDrift = Math.abs(drift);

      if (absDrift > 0.65) {
        // Large drift: sync audio to video (seeking audio is instant and never drops video keyframes)
        const now = performance.now();
        if (now - lastHardSyncMsRef.current > 2000) {
          lastHardSyncMsRef.current = now;
          try {
            audio.currentTime = video.currentTime;
            video.playbackRate = effectiveSpeed;
            audio.playbackRate = effectiveSpeed;
          } catch {}
        }
      } else if (absDrift > 0.045) {
        // Soft PLL rate nudge so video smoothly catches up or slows down without any frame skip
        const nudge = Math.max(-0.06, Math.min(0.06, drift * 0.18));
        video.playbackRate = Number((effectiveSpeed + nudge).toFixed(3));
        audio.playbackRate = effectiveSpeed;
      } else if (Math.abs(video.playbackRate - effectiveSpeed) > 0.002) {
        video.playbackRate = effectiveSpeed;
      }
    }, 350);

    return () => window.clearInterval(interval);
  }, [isSeparateAudio, isPlaying, playbackMode, effectiveSpeed]);

  const handleVideoError = useCallback(() => {
    const v = videoRef.current;
    if (!v || !streamVideoUrl || playbackMode !== 'video' || !currentVideo) return;

    // 0. If Service Worker chunked stream wrapper encountered an issue, transparently fall back to direct URL first
    if (!shouldBypassSw && effectiveVideoUrl !== streamVideoUrl) {
      console.info('[NativeVideoPlayerEngine] Falling back from SW chunked proxy to direct googlevideo stream');
      setBypassChunkedSwForId(currentVideo.id);
      return;
    }

    console.warn('[NativeVideoPlayerEngine] Media error encountered:', v.error);
    clearBufferingState();

    // Koda VideoRecoveryPolicy: attempt 1 silent recovery before showing error overlay
    const rec = recoveryAttemptRef.current;
    if (rec.videoId === currentVideo.id && rec.count < 1) {
      rec.count += 1;
      const fallbackQuality = videoQuality === '1080p' || isSeparateAudio ? '720p' : videoQuality;
      console.info(
        `[NativeVideoPlayerEngine] Running Koda VideoRecoveryPolicy (attempt ${rec.count}/1) -> ${fallbackQuality}`
      );
      retryVideoStream(fallbackQuality).then((recovered) => {
        if (!recovered) {
          setVideoPlaybackError('Video stream interrupted. Tap Retry or switch to Embedded Player.');
        }
      });
      return;
    }

    setVideoPlaybackError('Video stream interrupted. Tap Retry or switch to Embedded Player.');
  }, [
    shouldBypassSw,
    effectiveVideoUrl,
    streamVideoUrl,
    playbackMode,
    currentVideo,
    clearBufferingState,
    videoQuality,
    isSeparateAudio,
    retryVideoStream,
    setVideoPlaybackError
  ]);

  const cssFilter = buildCssVideoFilter(shaderSettings, webglShaderActive);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#000',
        overflow: 'hidden'
      }}
    >
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        onLoadedMetadata={() => {
          const v = videoRef.current;
          const a = audioRef.current;
          if (!v) return;

          if (pendingSeekTimeRef.current !== null && pendingSeekTimeRef.current > 0.5) {
            const seekTo = pendingSeekTimeRef.current;
            pendingSeekTimeRef.current = null;
            try {
              v.currentTime = seekTo;
              if (isSeparateAudio && a && a.src) {
                a.currentTime = seekTo;
              }
            } catch {}
          }
          const dur = v.duration && !Number.isNaN(v.duration) ? v.duration : currentVideo?.duration || 0;
          updatePlaybackProgress(v.currentTime || 0, dur, computeBufferedEnd(v));
        }}
        onLoadedData={() => {
          const v = videoRef.current;
          if (v && v.readyState >= 2 && v.videoWidth > 0) {
            setHasRenderedFirstFrame(true);
            if (!v.seeking && pendingSeekTimeRef.current === null) {
              setIsHoldingFreezeFrame(false);
            }
          }
        }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v || !streamVideoUrl || playbackMode !== 'video') return;

          if (v.readyState >= 2 && v.videoWidth > 0 && !hasRenderedFirstFrame) {
            setHasRenderedFirstFrame(true);
          }

          // If playhead is advancing, buffering and freeze-frame bridge are definitively over
          if (
            lastTimeUpdatePosRef.current >= 0 &&
            Math.abs(v.currentTime - lastTimeUpdatePosRef.current) > 0.01 &&
            !v.seeking
          ) {
            clearBufferingState();
            if (isHoldingFreezeFrame) {
              setIsHoldingFreezeFrame(false);
            }
          }
          lastTimeUpdatePosRef.current = v.currentTime;

          const dur = v.duration && !Number.isNaN(v.duration) ? v.duration : currentVideo?.duration || 0;
          updatePlaybackProgress(v.currentTime, dur, computeBufferedEnd(v));

          if (currentVideo && dur > 0 && Math.floor(v.currentTime) % 5 === 0) {
            useTasteStore.getState().updateVideoProgress(currentVideo.id, v.currentTime, dur);
          }
        }}
        onProgress={() => {
          const v = videoRef.current;
          if (!v || !streamVideoUrl || playbackMode !== 'video') return;
          const dur = v.duration && !Number.isNaN(v.duration) ? v.duration : currentVideo?.duration || 0;
          updatePlaybackProgress(v.currentTime, dur, computeBufferedEnd(v));
        }}
        onWaiting={() => {
          const a = audioRef.current;
          if (isSeparateAudio && a && !a.paused) {
            a.pause();
          }
          scheduleBufferingState();
        }}
        onCanPlay={() => {
          clearBufferingState();
          const v = videoRef.current;
          const a = audioRef.current;
          if (v && v.readyState >= 2 && v.videoWidth > 0) {
            setHasRenderedFirstFrame(true);
            if (!v.seeking && pendingSeekTimeRef.current === null) {
              setIsHoldingFreezeFrame(false);
            }
          }
          if (isSeparateAudio && isPlaying && v && a && a.src && a.paused && !v.seeking) {
            if (Math.abs(a.currentTime - v.currentTime) > 0.25) {
              try {
                a.currentTime = v.currentTime;
              } catch {}
            }
            a.play().catch(() => {});
          }
        }}
        onCanPlayThrough={clearBufferingState}
        onSeeked={() => {
          clearBufferingState();
          const v = videoRef.current;
          const a = audioRef.current;
          if (v && v.readyState >= 2) {
            setHasRenderedFirstFrame(true);
            setIsHoldingFreezeFrame(false);
          }
          if (isSeparateAudio && v && a && a.src) {
            if (Math.abs(a.currentTime - v.currentTime) > 0.2) {
              try {
                a.currentTime = v.currentTime;
              } catch {}
            }
            if (isPlaying && a.paused) {
              a.play().catch(() => {});
            }
          }
        }}
        onPlaying={() => {
          clearBufferingState();
          setVideoPlaybackError(null);
          setHasRenderedFirstFrame(true);
          if (!videoRef.current?.seeking) {
            setIsHoldingFreezeFrame(false);
          }
          const v = videoRef.current;
          const a = audioRef.current;
          if (isSeparateAudio && v && a && a.src && a.paused) {
            if (Math.abs(a.currentTime - v.currentTime) > 0.25) {
              try {
                a.currentTime = v.currentTime;
              } catch {}
            }
            a.play().catch(() => {});
          }
        }}
        onPause={() => {
          clearBufferingState();
          const a = audioRef.current;
          if (isSeparateAudio && a && !a.paused) {
            a.pause();
          }
        }}
        onEnded={() => {
          clearBufferingState();
          if (isLooping && videoRef.current) {
            videoRef.current.currentTime = 0;
            if (audioRef.current) audioRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
            if (isSeparateAudio && audioRef.current) audioRef.current.play().catch(() => {});
            return;
          }
          if (onEnded) {
            onEnded();
          } else {
            usePlayerStore.setState({ isPlaying: false });
          }
        }}
        onError={handleVideoError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: effectiveFit,
          display: 'block',
          backgroundColor: '#000',
          filter: cssFilter,
          transition: 'filter 180ms ease'
        }}
      />

      {/* Freeze-Frame <canvas> Bridge: Holds last decoded frame during Quality/Audio switch (Zero Black Flash) */}
      <canvas
        ref={freezeCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: effectiveFit,
          pointerEvents: 'none',
          zIndex: 3,
          filter: cssFilter,
          opacity: isHoldingFreezeFrame ? 1 : 0,
          transition: 'opacity 160ms ease'
        }}
      />

      {/* High-Res Ambient + Sharp Poster Curtain: Eliminates black box while initial keyframe decodes */}
      {currentVideo?.thumbnailUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            pointerEvents: 'none',
            overflow: 'hidden',
            backgroundColor: '#09090d',
            opacity: hasRenderedFirstFrame ? 0 : 1,
            transition: 'opacity 220ms cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          <img
            src={currentVideo.thumbnailUrl}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(32px) brightness(0.45) saturate(1.25)',
              transform: 'scale(1.12)'
            }}
          />
          <img
            src={currentVideo.thumbnailUrl}
            alt={currentVideo.title}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              objectFit: effectiveFit,
              display: 'block'
            }}
          />
        </div>
      )}

      {/* Real-time Koda Video Shader Engine (WebGL GLSL + SVG/Procedural Post-FX) */}
      <KodaVideoShaderCanvas
        videoRef={videoRef}
        isPlaying={isPlaying}
        onWebglStateChange={setWebglShaderActive}
      />

      {/* Secondary synchronized audio element for adaptive 1080p DASH & multi-language tracks */}
      <audio
        ref={audioRef}
        preload="auto"
        onError={() => {
          if (!shouldBypassSw && currentVideo?.id && effectiveAudioUrl !== streamAudioUrl) {
            setBypassChunkedSwForId(currentVideo.id);
          }
        }}
        onWaiting={() => {
          const v = videoRef.current;
          if (isSeparateAudio && v && !v.paused && aIsTrulyStalled(audioRef.current)) {
            scheduleBufferingState();
          }
        }}
        onPlaying={clearBufferingState}
        onCanPlay={clearBufferingState}
        style={{ display: 'none' }}
      />
    </div>
  );
};

function aIsTrulyStalled(a: HTMLAudioElement | null): boolean {
  if (!a || !a.src) return false;
  return a.readyState < 2;
}
