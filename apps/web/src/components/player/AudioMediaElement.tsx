import React, { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { usePlayerStore } from '../../store/playerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getCachedStream } from '../../api/streamResolver';

const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);

export const AudioMediaElement: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const isAdvancingRef = useRef<boolean>(false);
  const lastDacUrlRef = useRef<string | null>(null);

  const {
    currentTrack,
    streamAudioUrl,
    fallbackAudioUrl,
    activeStreamSpec,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    playbackMode,
    repeatMode,
    queue,
    queueIndex,
    updatePlaybackProgress,
    setBuffering,
    nextTrack,
    setActiveStreamSpec
  } = usePlayerStore();

  const { audioNormalization, crossfadeEnabled, crossfadeDuration, dacBitPerfectExclusive } =
    useSettingsStore();
  const fadeInTimerRef = useRef<number | null>(null);

  const isDacActive =
    isTauri &&
    dacBitPerfectExclusive &&
    activeStreamSpec?.isLossless &&
    playbackMode === 'music' &&
    Boolean(streamAudioUrl);

  const getNormalizedTargetVolume = (rawVol: number, muted: boolean) => {
    if (muted) return 0;
    const clamped = Math.max(0, Math.min(1, rawVol));
    if (!audioNormalization) return clamped;
    // Soft knee loudness normalization curve: compresses peak ceiling & lifts quiet floor
    return Math.min(0.92, Math.pow(clamped, 0.85) * 0.92);
  };

  // 1. Native DAC Bit-Perfect Engine Listener & Driver
  useEffect(() => {
    if (!isTauri) return;

    let unlistenFn: (() => void) | null = null;
    listen<any>('dac-state', (event) => {
      const state = event.payload;
      if (!state) return;

      if (activeStreamSpec && (state.deviceName || state.sampleRate || state.bitDepth)) {
        const sr = state.sampleRate || activeStreamSpec.sampleRate || 44100;
        const bd = state.bitDepth || activeStreamSpec.bitDepth || 16;
        const rateKhz = (sr / 1000).toFixed(sr % 1000 === 0 ? 0 : 1);
        const isHiRes = bd >= 24 || sr >= 88200;
        const isDacBitPerfect = dacBitPerfectExclusive && (state.mode ? state.mode.includes('Exclusive') : true);
        const badgeText = isDacBitPerfect
          ? `${bd}-BIT / ${rateKhz}KHZ FLAC • BIT-PERFECT`
          : `${bd}-BIT / ${rateKhz}KHZ FLAC • ${isHiRes ? 'HI-RES' : 'LOSSLESS'}`;
        const shortBadgeText = isDacBitPerfect
          ? `${bd}-BIT FLAC • BIT-PERFECT`
          : `${bd}-BIT FLAC`;

        if (
          activeStreamSpec.sampleRate !== sr ||
          activeStreamSpec.bitDepth !== bd ||
          activeStreamSpec.dacDeviceName !== state.deviceName ||
          activeStreamSpec.outputMode !== state.mode
        ) {
          setActiveStreamSpec({
            ...activeStreamSpec,
            sampleRate: sr,
            bitDepth: bd,
            dacDeviceName: state.deviceName || activeStreamSpec.dacDeviceName,
            outputMode: state.mode || activeStreamSpec.outputMode,
            badgeText,
            shortBadgeText
          });
        }
      }

      if (state.error) {
        console.warn('[OurTube DAC] Engine error:', state.error);
        setBuffering(false);
        // If exclusive mode failed, fall back to standard HTML5 audio with fallbackAudioUrl if available
        if (fallbackAudioUrl && audioRef.current) {
          console.warn('[OurTube DAC] Falling back to standard studio stream');
          audioRef.current.src = fallbackAudioUrl;
          audioRef.current.load();
          if (isPlaying) {
            audioRef.current.play().catch(() => {});
          }
        }
        return;
      }

      if (state.playing || state.paused) {
        const cur = Number(state.positionSec) || 0;
        const dur = Number(state.durationSec) || currentTrack?.duration || 0;
        updatePlaybackProgress(cur, dur);
        setBuffering(false);
      }

      if (state.ended) {
        handleEnded();
      }
    }).then((unlisten) => {
      unlistenFn = unlisten;
    }).catch((err) => {
      console.warn('[OurTube DAC] Listen error:', err);
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [activeStreamSpec, fallbackAudioUrl, isPlaying, currentTrack]);

  // 2. Playback activation: Handoff between Native DAC engine and HTML5 <audio>
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (fadeInTimerRef.current) {
      window.clearInterval(fadeInTimerRef.current);
      fadeInTimerRef.current = null;
    }

    if (!streamAudioUrl || playbackMode !== 'music') {
      if (isTauri && lastDacUrlRef.current) {
        invoke('dac_stop').catch(() => {});
        lastDacUrlRef.current = null;
      }
      if (audio.src) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      return;
    }

    if (isDacActive) {
      // In Native DAC mode: Pause and clear HTML5 audio element
      if (audio.src) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }

      if (lastDacUrlRef.current !== streamAudioUrl) {
        lastDacUrlRef.current = streamAudioUrl;
        setBuffering(true);
        invoke('dac_play', { url: streamAudioUrl, exclusive: true }).catch((err) => {
          console.warn('[OurTube DAC] Play error:', err);
          // Fallback to normal audio
          if (audioRef.current) {
            const fallback = fallbackAudioUrl || streamAudioUrl;
            audioRef.current.src = fallback;
            audioRef.current.load();
            if (isPlaying) audioRef.current.play().catch(() => {});
          }
        });
      }
      return;
    }

    // Standard HTML5 <audio> mode: stop any DAC engine
    if (isTauri && lastDacUrlRef.current) {
      invoke('dac_stop').catch(() => {});
      lastDacUrlRef.current = null;
    }

    const targetVol = getNormalizedTargetVolume(volume, isMuted);

    if (audio.src !== streamAudioUrl) {
      audio.src = streamAudioUrl;
      audio.load();

      // Always reset volume on track switch; apply smooth fade-in if crossfade is enabled
      if (crossfadeEnabled && crossfadeDuration > 0 && !isMuted && targetVol > 0) {
        const steps = 12;
        const stepMs = Math.min(150, (crossfadeDuration * 1000) / (steps * 2));
        let step = 1;
        audio.volume = targetVol * 0.15;
        fadeInTimerRef.current = window.setInterval(() => {
          step += 1;
          if (!audioRef.current || step >= steps) {
            if (audioRef.current) {
              audioRef.current.volume = getNormalizedTargetVolume(
                usePlayerStore.getState().volume,
                usePlayerStore.getState().isMuted
              );
            }
            if (fadeInTimerRef.current) {
              window.clearInterval(fadeInTimerRef.current);
              fadeInTimerRef.current = null;
            }
            return;
          }
          const curTarget = getNormalizedTargetVolume(
            usePlayerStore.getState().volume,
            usePlayerStore.getState().isMuted
          );
          audioRef.current.volume = Math.max(
            0,
            Math.min(1, curTarget * (0.15 + 0.85 * (step / steps)))
          );
        }, stepMs);
      } else {
        audio.volume = targetVol;
      }
    }

    if (isPlaying) {
      audio.play().catch((err) => {
        console.warn('[OurTube Audio] Playback autoplay interrupted:', err);
      });
    }

    return () => {
      if (fadeInTimerRef.current) {
        window.clearInterval(fadeInTimerRef.current);
        fadeInTimerRef.current = null;
      }
    };
  }, [streamAudioUrl, playbackMode, isDacActive]);

  // 3. Handle Play/Pause transitions
  useEffect(() => {
    if (!streamAudioUrl || playbackMode !== 'music') return;

    if (isDacActive) {
      if (isPlaying) {
        invoke('dac_resume').catch(() => {});
      } else {
        invoke('dac_pause').catch(() => {});
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (audio.paused) {
        audio.play().catch((err) => {
          console.warn('[OurTube Audio] Play error:', err);
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, isDacActive, playbackMode, streamAudioUrl]);

  // 4. Handle Volume, Mute & Normalization (applies to HTML5 audio; hardware DAC receives unscaled bit-perfect stream)
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = getNormalizedTargetVolume(volume, isMuted);
    }
  }, [volume, isMuted, audioNormalization]);

  // 5. Sync native loop attribute for Repeat-One mode
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.loop = repeatMode === 'one';
    }
  }, [repeatMode]);

  // 6. Handle Programmatic Seek
  useEffect(() => {
    if (playbackMode !== 'music') return;

    if (isDacActive) {
      invoke('dac_seek', { positionSec: currentTime }).catch(() => {});
      return;
    }

    const audio = audioRef.current;
    if (audio && streamAudioUrl && audio.src && Math.abs(audio.currentTime - currentTime) > 1.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, isDacActive, streamAudioUrl, playbackMode]);

  // 7. Gapless Audio Preloader for upcoming tracks
  useEffect(() => {
    const nextEntry = queue[queueIndex + 1];
    if (!nextEntry?.track?.id || playbackMode !== 'music') return;

    const cached = getCachedStream({ videoId: nextEntry.track.id });
    if (cached?.audioUrl && preloadAudioRef.current) {
      if (preloadAudioRef.current.src !== cached.audioUrl) {
        preloadAudioRef.current.src = cached.audioUrl;
        preloadAudioRef.current.preload = 'auto';
      }
    }
  }, [queue, queueIndex, streamAudioUrl, playbackMode]);

  // 8. Track completion handler
  const handleEnded = () => {
    if (repeatMode === 'one') {
      if (isDacActive) {
        invoke('dac_seek', { positionSec: 0 }).catch(() => {});
        invoke('dac_resume').catch(() => {});
      } else {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.volume = getNormalizedTargetVolume(volume, isMuted);
          audio.play().catch(() => {});
        }
      }
      return;
    }

    // Record 1.0 completion rate when track finishes naturally
    if (currentTrack) {
      import('../../store/tasteStore')
        .then(({ useTasteStore }) => {
          useTasteStore.getState().recordPlayback(currentTrack, 1.0);
        })
        .catch(() => {});
    }

    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    nextTrack().finally(() => {
      setTimeout(() => {
        isAdvancingRef.current = false;
      }, 800);
    });
  };

  const handleError = () => {
    if (playbackMode !== 'music') return;
    const audio = audioRef.current;
    console.warn('[OurTube Audio] Audio stream error encountered:', audio?.error);
    setBuffering(false);

    // If lossless stream failed in HTML5 audio, try fallback YouTube audio
    if (fallbackAudioUrl && audio && audio.src !== fallbackAudioUrl) {
      console.warn('[OurTube Audio] Falling back to YouTube stream');
      audio.src = fallbackAudioUrl;
      audio.load();
      if (isPlaying) audio.play().catch(() => {});
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (playbackMode === 'music' && audioRef.current && streamAudioUrl && !isDacActive) {
            const cur = audioRef.current.currentTime || 0;
            const dur = audioRef.current.duration || currentTrack?.duration || 0;
            updatePlaybackProgress(cur, dur);

            // Real-time smooth volume crossfade ramp as track approaches end
            const baseTarget = getNormalizedTargetVolume(volume, isMuted);
            if (
              crossfadeEnabled &&
              repeatMode !== 'one' &&
              crossfadeDuration > 0 &&
              dur > crossfadeDuration &&
              dur - cur <= crossfadeDuration
            ) {
              const remaining = Math.max(0, dur - cur);
              const ramp = remaining / crossfadeDuration;
              const targetVol = isMuted ? 0 : baseTarget * Math.max(0.08, ramp);
              audioRef.current.volume = Math.max(0, Math.min(1, targetVol));
            } else if (
              !fadeInTimerRef.current &&
              Math.abs(audioRef.current.volume - baseTarget) > 0.02
            ) {
              audioRef.current.volume = baseTarget;
            }
          }
        }}
        onWaiting={() => {
          if (playbackMode === 'music' && !isDacActive) setBuffering(true);
        }}
        onPlaying={() => {
          if (playbackMode === 'music' && !isDacActive) setBuffering(false);
        }}
        onCanPlay={() => {
          if (playbackMode === 'music' && !isDacActive) setBuffering(false);
        }}
        onEnded={handleEnded}
        onError={handleError}
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Seamless gapless audio buffer element for upcoming queue tracks */}
      <audio ref={preloadAudioRef} preload="auto" muted style={{ display: 'none' }} />
    </>
  );
};
