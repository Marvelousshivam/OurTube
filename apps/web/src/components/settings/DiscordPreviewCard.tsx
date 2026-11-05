import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { sizedArtwork } from '../../api/artworkService';

export const DiscordPreviewCard: React.FC = () => {
  const { currentTrack, isPlaying, currentTime, duration } = usePlayerStore();
  const {
    discordRpcEnabled,
    discordShowElapsed,
    discordShowArtwork,
    discordShowButtons,
    discordIncognito,
    discordUser
  } = useSettingsStore();

  const [simulatedTime, setSimulatedTime] = useState(currentTime || 45);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimulatedTime((prev) => (prev >= (duration || 210) ? 0 : prev + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  // Display song metadata or an authentic placeholder if nothing is currently playing
  const songTitle = currentTrack?.title || 'Barkha';
  const songArtist = currentTrack?.artist || 'Jagjit Singh & Chitra Singh';
  const songAlbum = currentTrack?.album || 'The Unforgettables';
  const songDuration = duration > 0 ? duration : 210;
  const songArt = currentTrack?.thumbnailUrl
    ? sizedArtwork(currentTrack.thumbnailUrl, 226)
    : 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=300&q=80';

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = Math.min(100, Math.max(0, (simulatedTime / songDuration) * 100));

  return (
    <div
      style={{
        backgroundColor: '#1e1f22', // Discord signature dark theme
        borderRadius: '16px',
        padding: '18px',
        color: '#f2f3f5',
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        maxWidth: '460px',
        width: '100%',
        margin: '0 auto',
        userSelect: 'none'
      }}
    >
      {/* Discord Profile Mini Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: '#5865f2', // Discord blurple
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '11px',
              color: '#ffffff'
            }}
          >
            {discordUser?.name ? discordUser.name[0].toUpperCase() : 'K'}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#f2f3f5' }}>
            {discordUser?.name || 'Koda Listener'}
          </span>
        </div>

        {/* Live RPC Activity Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 700
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: !discordRpcEnabled
                ? '#80848e'
                : discordIncognito
                  ? '#eb459e'
                  : isPlaying
                    ? '#23a55a'
                    : '#f0b232',
              boxShadow: discordRpcEnabled && isPlaying ? '0 0 8px #23a55a' : 'none'
            }}
          />
          <span style={{ color: '#b5bac1' }}>
            {!discordRpcEnabled
              ? 'Disabled'
              : discordIncognito
                ? 'Incognito'
                : isPlaying
                  ? 'Broadcasting'
                  : 'Idle (Paused)'}
          </span>
        </div>
      </div>

      {/* Activity Title */}
      <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', color: '#b5bac1', textTransform: 'uppercase' }}>
        Listening to Koda
      </div>

      {/* Presence Card Body */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        {/* Large Album Artwork with small logo badge */}
        {discordShowArtwork && (
          <div style={{ position: 'relative', width: '74px', height: '74px', flexShrink: 0 }}>
            <img
              src={songArt}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '8px',
                objectFit: 'cover',
                backgroundColor: '#2b2d31'
              }}
            />
            {/* Small Koda monogram badge in corner */}
            <div
              style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#5865f2',
                border: '3px solid #1e1f22',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 900
              }}
            >
              K
            </div>
          </div>
        )}

        {/* Track details & timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: '2px' }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {songTitle}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: '#b5bac1',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            by {songArtist}
          </span>
          {songAlbum && (
            <span
              style={{
                fontSize: '11px',
                color: '#949ba4',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              on {songAlbum}
            </span>
          )}

          {/* Discord Elapsed Progress Bar */}
          {discordShowElapsed && (
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div
                style={{
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: '#3b3e45',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    backgroundColor: '#ffffff',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#949ba4' }}>
                <span>{formatSec(simulatedTime)}</span>
                <span>{formatSec(songDuration)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {discordShowButtons && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
          <button
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: '#4e5058',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <span>Listen on YouTube Music</span>
            <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>
              open_in_new
            </span>
          </button>

          <button
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: '#3b3e45',
              color: '#dbdee1',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <span>Open Koda Web</span>
          </button>
        </div>
      )}
    </div>
  );
};
