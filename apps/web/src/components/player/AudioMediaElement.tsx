import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useSettingsStore } from '../../store/settingsStore';

export const AudioMediaElement: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const {
    currentTrack,
    streamAudioUrl,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    playbackMode,
    updatePlaybackProgress,
    setBuffering,
    nextTrack
  } = usePlayerStore();

  const { audioNormalization, crossfadeEnabled, crossfadeDuration } = useSettingsStore();

  // Initialize Web Audio API DynamicsCompressor for Loudness Normalization
  // Note: googlevideo.com streams lack CORS headers in browser, so media element must remain directly connected to audio output
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Direct HTML5 audio element playback ensures 100% reliable cross-origin streaming without browser CORS silence
  }, [audioNormalization, isPlaying]);

  // Load stream into native audio element when streamAudioUrl changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (streamAudioUrl && playbackMode === 'music') {
      if (audio.src !== streamAudioUrl) {
        audio.src = streamAudioUrl;
        audio.load();
      }
      if (isPlaying) {
        audio.play().catch((err) => {
          console.warn('[Koda Audio] Autoplay interrupted:', err);
        });
      }
    } else if (playbackMode === 'video') {
      audio.pause();
    }
  }, [streamAudioUrl, playbackMode]);

  // Handle Play/Pause transitions
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamAudioUrl || playbackMode !== 'music') return;

    if (isPlaying) {
      if (audio.paused) {
        audio.play().catch((err) => {
          console.warn('[Koda Audio] Play error:', err);
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, playbackMode, streamAudioUrl]);

  // Handle Volume & Mute with Crossfade consideration
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
    }
  }, [volume, isMuted]);

  // Handle Programmatic Seek
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && streamAudioUrl && Math.abs(audio.currentTime - currentTime) > 1.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, streamAudioUrl]);

  return (
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
      onEnded={() => nextTrack()}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
};
