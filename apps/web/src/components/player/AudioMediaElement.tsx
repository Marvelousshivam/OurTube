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
    queue,
    queueIndex,
    updatePlaybackProgress,
    setBuffering,
    nextTrack
  } = usePlayerStore();

  const { audioNormalization, crossfadeEnabled, crossfadeDuration } = useSettingsStore();

  // Load stream into native audio element when streamAudioUrl changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!streamAudioUrl || playbackMode !== 'music') {
      if (audio.src) {
        audio.removeAttribute('src');
        audio.load();
      }
      return;
    }

    if (audio.src !== streamAudioUrl) {
      audio.src = streamAudioUrl;
      audio.load();
    }

    if (isPlaying) {
      audio.play().catch((err) => {
        console.warn('[OurTube Audio] Playback autoplay interrupted:', err);
      });
    }
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

  // Handle Volume & Mute
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
    }
  }, [volume, isMuted]);

  // Handle Programmatic Seek
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && streamAudioUrl && audio.src && Math.abs(audio.currentTime - currentTime) > 1.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, streamAudioUrl]);

  // Guarded track completion handler to prevent cascade skipping
  const handleEnded = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const duration = audio.duration || currentTrack?.duration || 0;
    const isCompleted = (duration > 0 && audio.currentTime >= duration - 3) || audio.currentTime > 10;

    if (!isCompleted) {
      console.warn('[OurTube Audio] Premature ended event suppressed (cur:', audio.currentTime, 'dur:', duration, ')');
      return;
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
    const audio = audioRef.current;
    console.warn('[OurTube Audio] Audio stream error encountered:', audio?.error);
    setBuffering(false);
  };

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current && streamAudioUrl) {
            const cur = audioRef.current.currentTime || 0;
            const dur = audioRef.current.duration || currentTrack?.duration || 0;
            updatePlaybackProgress(cur, dur);

            // Real-time smooth volume crossfade ramp as track approaches end
            if (crossfadeEnabled && crossfadeDuration > 0 && dur > crossfadeDuration && dur - cur <= crossfadeDuration) {
              const remaining = Math.max(0, dur - cur);
              const ramp = remaining / crossfadeDuration;
              const targetVol = isMuted ? 0 : volume * Math.max(0.08, ramp);
              audioRef.current.volume = Math.max(0, Math.min(1, targetVol));
            }
          }
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
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
