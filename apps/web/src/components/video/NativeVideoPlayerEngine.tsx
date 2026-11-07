import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';

interface NativeVideoPlayerEngineProps {
  className?: string;
  style?: React.CSSProperties;
  onVideoElementReady?: (video: HTMLVideoElement | null) => void;
  onEnded?: () => void;
}

/**
 * Native Hardware-Accelerated Video Engine (No Iframe)
 * Modeled after BitChord's videoDeck and Koda's ExoPlayer pipeline:
 * - Direct googlevideo.com streaming without iframe embeds
 * - Dual clock sync: if separate adaptive audio is loaded, keeps video locked to master clock
 * - Hardware video decoding with playsInline and smooth buffering
 */
export const NativeVideoPlayerEngine: React.FC<NativeVideoPlayerEngineProps> = ({
  className = '',
  style,
  onVideoElementReady,
  onEnded
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastVideoIdRef = useRef<string | null>(null);

  const {
    currentVideo,
    streamVideoUrl,
    streamAudioUrl,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    playbackMode,
    playbackSpeed,
    isHoldTo2x,
    isLooping,
    fitMode,
    updatePlaybackProgress,
    setBuffering,
    setVideoPlaybackError
  } = usePlayerStore();

  const effectiveSpeed = isHoldTo2x ? 2.0 : (playbackSpeed || 1.0);
  const isSeparateAudio = Boolean(streamAudioUrl && streamVideoUrl && streamAudioUrl !== streamVideoUrl);

  // Notify parent of video element
  useEffect(() => {
    onVideoElementReady?.(videoRef.current);
  }, [onVideoElementReady]);

  // Load stream URLs
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || playbackMode !== 'video') return;

    if (!streamVideoUrl) {
      if (video.src) {
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    const currentVideoId = currentVideo?.id || null;
    const isSameVideoSwitch =
      Boolean(currentVideoId && lastVideoIdRef.current === currentVideoId) &&
      (video.currentTime > 0.5 || usePlayerStore.getState().currentTime > 0.5);
    const resumeTime = isSameVideoSwitch
      ? Math.max(video.currentTime || 0, usePlayerStore.getState().currentTime || 0)
      : 0;
    lastVideoIdRef.current = currentVideoId;

    if (video.src !== streamVideoUrl) {
      video.src = streamVideoUrl;
      video.load();
      if (resumeTime > 0.5) {
        const restoreVideoPos = () => {
          video.currentTime = resumeTime;
          video.removeEventListener('loadedmetadata', restoreVideoPos);
        };
        video.addEventListener('loadedmetadata', restoreVideoPos);
      }
    }

    if (isSeparateAudio && audio && streamAudioUrl) {
      if (audio.src !== streamAudioUrl) {
        audio.src = streamAudioUrl;
        audio.load();
        const targetAudioPos = resumeTime > 0.5 ? resumeTime : video.currentTime || 0;
        if (targetAudioPos > 0.5) {
          const restoreAudioPos = () => {
            audio.currentTime = targetAudioPos;
            audio.removeEventListener('loadedmetadata', restoreAudioPos);
          };
          audio.addEventListener('loadedmetadata', restoreAudioPos);
        }
      }
      // When separate audio stream exists, mute video to prevent echo and let audio element produce sound
      video.muted = true;
    } else {
      video.muted = isMuted;
    }

    if (isPlaying) {
      video.play().catch((e) => console.warn('[NativeVideo] Autoplay error:', e));
      if (isSeparateAudio && audio) {
        audio.play().catch((e) => console.warn('[NativeAudio] Autoplay error:', e));
      }
    }
  }, [streamVideoUrl, streamAudioUrl, playbackMode, isSeparateAudio]);

  // Handle Play/Pause
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !streamVideoUrl || playbackMode !== 'video') return;

    if (isPlaying) {
      if (video.paused) video.play().catch(() => {});
      if (isSeparateAudio && audio && audio.paused) audio.play().catch(() => {});
    } else {
      if (!video.paused) video.pause();
      if (isSeparateAudio && audio && !audio.paused) audio.pause();
    }
  }, [isPlaying, streamVideoUrl, playbackMode, isSeparateAudio]);

  // Handle Volume
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const effectiveVol = isMuted ? 0 : Math.max(0, Math.min(1, volume));

    if (isSeparateAudio && audio) {
      audio.volume = effectiveVol;
      audio.muted = isMuted;
      if (video) video.muted = true;
    } else if (video) {
      video.volume = effectiveVol;
      video.muted = isMuted;
    }
  }, [volume, isMuted, isSeparateAudio]);

  // Handle Programmatic Seek
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video && video.src && Math.abs(video.currentTime - currentTime) > 1.5) {
      video.currentTime = currentTime;
      if (isSeparateAudio && audio && audio.src) {
        audio.currentTime = currentTime;
      }
    }
  }, [currentTime, isSeparateAudio]);

  // Handle Playback Speed (including hold-to-2x gesture)
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) video.playbackRate = effectiveSpeed;
    if (isSeparateAudio && audio) audio.playbackRate = effectiveSpeed;
  }, [effectiveSpeed, isSeparateAudio]);

  // Handle Loop
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video) video.loop = isLooping;
    if (isSeparateAudio && audio) audio.loop = isLooping;
  }, [isLooping, isSeparateAudio]);

  // High-precision clock sync loop if separate audio stream is used
  useEffect(() => {
    if (!isSeparateAudio) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!video || !audio || video.paused || audio.paused) return;
      if (video.readyState < 2 || audio.readyState < 2) return;

      const drift = Math.abs(video.currentTime - audio.currentTime);
      if (drift > 0.3) {
        // Large drift: hard seek video to audio playhead
        video.currentTime = audio.currentTime;
      } else if (drift > 0.05) {
        // Small drift: nudge video playbackRate slightly
        video.playbackRate = video.currentTime < audio.currentTime
          ? effectiveSpeed * 1.05
          : effectiveSpeed * 0.95;
      } else {
        video.playbackRate = effectiveSpeed;
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isSeparateAudio, effectiveSpeed]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100%',
        overflow: 'hidden',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      <video
        ref={videoRef}
        playsInline
        poster={currentVideo?.thumbnailUrl}
        style={{
          width: '100%',
          height: '100%',
          maxHeight: '100%',
          maxWidth: '100%',
          objectFit: fitMode === 'fill' ? 'cover' : 'contain',
          display: 'block',
          backgroundColor: '#000000'
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration && !Number.isNaN(v.duration)) {
            updatePlaybackProgress(v.currentTime, v.duration);
          }
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => {
          setBuffering(false);
          setVideoPlaybackError(null);
        }}
        onCanPlay={() => {
          setBuffering(false);
          setVideoPlaybackError(null);
        }}
        onEnded={() => {
          if (isLooping) {
            const v = videoRef.current;
            const a = audioRef.current;
            if (v) {
              v.currentTime = 0;
              v.play().catch(() => {});
            }
            if (isSeparateAudio && a) {
              a.currentTime = 0;
              a.play().catch(() => {});
            }
            return;
          }
          if (onEnded) {
            onEnded();
          } else {
            usePlayerStore.setState({ isPlaying: false });
          }
        }}
        onError={(e) => {
          const err = e.currentTarget.error;
          console.warn('[NativeVideo] Video element playback error:', err?.code, err?.message);
          setBuffering(false);
          setVideoPlaybackError(
            err?.code === 4
              ? 'Video stream format or cipher could not be decoded. Tap below to switch to embedded player.'
              : err?.code === 2
              ? 'Network error while loading video stream.'
              : 'Video stream could not be loaded.'
          );
        }}
      />

      {/* Hidden background audio element for adaptive DASH audio track sync if needed */}
      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        onError={(e) => {
          console.warn('[NativeVideo] Secondary audio track error:', e);
        }}
      />
    </div>
  );
};
