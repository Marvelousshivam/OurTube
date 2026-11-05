import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';

export const AudioMediaElement: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
