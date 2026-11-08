import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { sizedArtwork } from '../../api/artworkService';
import { bridgeClient } from '../../api/bridgeClient';
import { OurTubeLogo } from '../common/OurTubeLogo';

export const DiscordPreviewCard: React.FC = () => {
  const { currentTrack, isPlaying, currentTime, duration } = usePlayerStore();
  const {
    discordRpcEnabled,
    discordShowElapsed,
    discordShowArtwork,
    discordShowButtons,
    discordIncognito,
    discordUser,
    discordConnected,
    discordGateway,
    discordActivityType,
    discordOnlineStatus,
    discordActivityName,
    discordButton1Visible,
    discordButton1Text,
    discordButton2Visible,
    discordButton2Text
  } = useSettingsStore();

  const [simulatedTime, setSimulatedTime] = useState(currentTime || 45);

  useEffect(() => {
    if (currentTime > 0) {
      setSimulatedTime(currentTime);
    }
  }, [currentTime]);

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

  const resolveVariables = (text: string) =>
    text
      .replaceAll('{song_name}', songTitle)
      .replaceAll('{artist_name}', songArtist)
      .replaceAll('{album_name}', songAlbum || '');

  const progressPercent = Math.min(100, Math.max(0, (simulatedTime / songDuration) * 100));

  const ytChannel = bridgeClient.getAuthState().selectedChannel;
  const displayName = discordUser?.name || ytChannel?.name || 'OurTube Listener';
  const displayAvatar = discordUser?.avatarUrl || ytChannel?.avatarUrl || null;

  const activityVerb = {
    listening: 'Listening to',
    playing: 'Playing',
    watching: 'Watching',
    competing: 'Competing in'
  }[discordActivityType || 'listening'];

  const appName = (discordActivityName || '').trim() || 'OurTube';

  const statusColor = !discordRpcEnabled
    ? '#80848e'
    : discordIncognito
      ? '#eb459e'
      : !discordConnected
        ? '#f0b232'
        : discordOnlineStatus === 'dnd'
          ? '#f23f43'
          : discordOnlineStatus === 'idle'
            ? '#f0b232'
            : discordOnlineStatus === 'invisible'
              ? '#80848e'
              : '#23a55a';

  const statusLabel = !discordRpcEnabled
    ? 'Disabled'
    : discordIncognito
      ? 'Incognito'
      : !discordConnected
        ? 'Account Not Connected'
        : discordGateway === 'connecting'
          ? 'Connecting Gateway…'
          : isPlaying
            ? 'Broadcasting Live'
            : 'Ready · Paused';

  const btn1Label = resolveVariables(discordButton1Text?.trim() || 'Listen on YouTube Music');
  const btn2Label = resolveVariables(discordButton2Text?.trim() || 'Visit OurTube');

  return (
    <div
      style={{
        backgroundColor: '#1e1f22',
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt={displayName}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0
              }}
            />
          ) : (
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#5865f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '12px',
                color: '#ffffff',
                flexShrink: 0
              }}
            >
              {displayName[0]?.toUpperCase() || 'O'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#f2f3f5',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {displayName}
            </span>
            {discordUser?.username && (
              <span style={{ fontSize: '10px', color: '#949ba4' }}>@{discordUser.username}</span>
            )}
          </div>
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
            fontWeight: 700,
            flexShrink: 0
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: statusColor,
              boxShadow: discordRpcEnabled && discordConnected && isPlaying ? `0 0 8px ${statusColor}` : 'none'
            }}
          />
          <span style={{ color: '#b5bac1' }}>{statusLabel}</span>
        </div>
      </div>

      {/* Activity Title */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.04em',
          color: '#b5bac1',
          textTransform: 'uppercase'
        }}
      >
        {activityVerb} {appName}
      </div>

      {/* Presence Card Body */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        {/* Large Album Artwork with small OurTube logo badge */}
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
            <div
              style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                backgroundColor: '#1e1f22',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <OurTubeLogo size={22} style={{ filter: 'none' }} />
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
      {discordShowButtons && (discordButton1Visible || discordButton2Visible) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
          {discordButton1Visible && (
            <button
              type="button"
              onClick={() => {
                if (currentTrack?.id) {
                  window.open(`https://music.youtube.com/watch?v=${currentTrack.id}`, '_blank');
                }
              }}
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
              <span>{btn1Label}</span>
              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>
                open_in_new
              </span>
            </button>
          )}

          {discordButton2Visible && (
            <button
              type="button"
              onClick={() => window.open('https://github.com/Marvelousshivam/OurTube', '_blank')}
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
              <span>{btn2Label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
