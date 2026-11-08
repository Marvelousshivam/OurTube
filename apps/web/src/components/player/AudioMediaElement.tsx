import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getCachedStream } from '../../api/streamResolver';

export const AudioMediaElement: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const isAdvancingRef = useRef<boolean>(false);

  const {
    currentTrack,
    streamAudioUrl,
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
    nextTrack
  } = usePlayerStore();

  const { audioNormalization, crossfadeEnabled, crossfadeDuration } = useSettingsStore();
  const fadeInTimerRef = useRef<number | null>(null);

  const getNormalizedTargetVolume = (rawVol: number, muted: boolean) => {
    if (muted) return 0;
    const clamped = Math.max(0, Math.min(1, rawVol));
    if (!audioNormalization) return clamped;
    // Soft knee loudness normalization curve: compresses peak ceiling & lifts quiet floor
    return Math.min(0.92, Math.pow(clamped, 0.85) * 0.92);
  };

  // Load stream into native audio element when streamAudioUrl changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (fadeInTimerRef.current) {
      window.clearInterval(fadeInTimerRef.current);
      fadeInTimerRef.current = null;
    }

    if (!streamAudioUrl || playbackMode !== 'music') {
      if (audio.src) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      return;
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
          audioRef.current.volume = Math.max(0, Math.min(1, curTarget * (0.15 + 0.85 * (step / steps))));
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
  }, [streamAudioUrl, playbackMode]);

  // Seamless Gapless Audio Preloader: pre-buffer the upcoming track in background
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

  // Handle Play/Pause transitions
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamAudioUrl || playbackMode !== 'music') return;

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
  }, [isPlaying, playbackMode, streamAudioUrl]);

  // Handle Volume, Mute & Normalization
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = getNormalizedTargetVolume(volume, isMuted);
    }
  }, [volume, isMuted, audioNormalization]);

  // Sync native loop attribute for Repeat-One mode
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.loop = repeatMode === 'one';
    }
  }, [repeatMode]);

  // Handle Programmatic Seek
  useEffect(() => {
    if (playbackMode !== 'music') return;
    const audio = audioRef.current;
    if (audio && streamAudioUrl && audio.src && Math.abs(audio.currentTime - currentTime) > 1.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, streamAudioUrl, playbackMode]);

  // Guarded track completion handler to prevent cascade skipping
  const handleEnded = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (repeatMode === 'one') {
      audio.currentTime = 0;
      audio.volume = getNormalizedTargetVolume(volume, isMuted);
      audio.play().catch(() => {});
      return;
    }

    const duration = audio.duration || currentTrack?.duration || 0;
    const isCompleted = (duration > 0 && audio.currentTime >= duration - 3) || audio.currentTime > 10;

    if (!isCompleted) {
      console.warn('[OurTube Audio] Premature ended event suppressed (cur:', audio.currentTime, 'dur:', duration, ')');
      return;
    }

    // Record 1.0 completion rate when track finishes naturally
    if (currentTrack) {
      import('../../store/tasteStore').then(({ useTasteStore }) => {
        useTasteStore.getState().recordPlayback(currentTrack, 1.0);
      }).catch(() => {});
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
  };

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (playbackMode === 'music' && audioRef.current && streamAudioUrl) {
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
            } else if (!fadeInTimerRef.current && Math.abs(audioRef.current.volume - baseTarget) > 0.02) {
              audioRef.current.volume = baseTarget;
            }
          }
        }}
        onWaiting={() => {
          if (playbackMode === 'music') setBuffering(true);
        }}
        onPlaying={() => {
          if (playbackMode === 'music') setBuffering(false);
        }}
        onCanPlay={() => {
          if (playbackMode === 'music') setBuffering(false);
        }}
        onEnded={handleEnded}
        onError={handleError}
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Seamless gapless audio buffer element for upcoming queue tracks */}
      <audio
        ref={preloadAudioRef}
        preload="auto"
        muted
        style={{ display: 'none' }}
      />
    </>
  );
};
