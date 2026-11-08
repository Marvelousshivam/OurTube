import React, { useEffect, useMemo, useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';
import { innertubeService } from '../../api/innertubeService';
import { VideoItem } from '../../types';
import { VideoCard } from './VideoCard';

export const ChannelSheet: React.FC = () => {
  const { activeChannel, closeChannel, playVideo } = usePlayerStore();
  const { toggleSubscribeChannel, syncSubscribedChannels, isChannelSubscribed } = useTasteStore();

  const [isLoading, setIsLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [channelInfo, setChannelInfo] = useState<{
    id: string;
    name: string;
    avatarUrl?: string;
    bannerUrl?: string;
    subscriberCountText?: string;
    description?: string;
    isSubscribed?: boolean;
    videos: VideoItem[];
  } | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'short' | 'long'>('all');

  useEffect(() => {
    if (!activeChannel) {
      setChannelInfo(null);
      setAvatarError(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setAvatarError(false);
    setFilterMode('all');

    innertubeService
      .getChannelVideos(activeChannel.id, activeChannel.name)
      .then((res) => {
        if (cancelled) return;
        const resolvedAvatar =
          res.avatarUrl ||
          activeChannel.avatarUrl ||
          res.videos.find((v) => v.channelIconUrl)?.channelIconUrl;
        const resolvedName =
          res.name && res.name !== 'Creator'
            ? res.name
            : activeChannel.name.replace(/\s+and\s+\d+\s+more$/i, '').trim();

        const stampedVideos = res.videos.map((v) => ({
          ...v,
          channelName:
            !v.channelName ||
            v.channelName === 'YouTube Creator' ||
            v.channelName === 'Creator' ||
            /\band\s+\d+\s+more$/i.test(v.channelName)
              ? resolvedName
              : v.channelName,
          channelId: v.channelId || res.id || activeChannel.id,
          channelIconUrl: v.channelIconUrl || resolvedAvatar
        }));

        if (res.isSubscribed) {
          syncSubscribedChannels([
            {
              id: res.id || activeChannel.id || `ch_${resolvedName}`,
              name: resolvedName,
              avatarUrl: resolvedAvatar
            }
          ]);
        }

        setChannelInfo({
          ...res,
          name: resolvedName,
          avatarUrl: resolvedAvatar,
          videos: stampedVideos
        });
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeChannel, syncSubscribedChannels]);

  useEffect(() => {
    if (!activeChannel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeChannel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeChannel, closeChannel]);

  const filteredVideos = useMemo(() => {
    const list = channelInfo?.videos || [];
    if (filterMode === 'short') return list.filter((v) => (v.duration || 0) <= 600);
    if (filterMode === 'long') return list.filter((v) => (v.duration || 0) > 600);
    return list;
  }, [channelInfo, filterMode]);

  if (!activeChannel) return null;

  const displayName = (channelInfo?.name || activeChannel.name)
    .replace(/\s+and\s+\d+\s+more$/i, '')
    .trim();
  const displayId = channelInfo?.id || activeChannel.id || `ch_${displayName}`;
  const displayAvatar = channelInfo?.avatarUrl || activeChannel.avatarUrl;
  const isSubscribed =
    Boolean(channelInfo?.isSubscribed) ||
    isChannelSubscribed(displayId) ||
    isChannelSubscribed(displayName);

  const handleToggleSub = () => {
    toggleSubscribeChannel({
      id: displayId,
      name: displayName,
      avatarUrl: displayAvatar
    });
  };

  return (
    <div
      onClick={closeChannel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 130,
        backgroundColor: 'rgba(6, 7, 10, 0.72)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'channelBackdropFade 200ms ease'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(960px, 94vw)',
          height: '100%',
          backgroundColor: '#121316',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '-24px 0 64px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'channelSlideIn 280ms cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
        {/* Top Banner & Creator Header */}
        <div
          style={{
            position: 'relative',
            padding: '24px 28px 20px',
            background: channelInfo?.bannerUrl
              ? `linear-gradient(to bottom, rgba(18,19,22,0.55), rgba(18,19,22,0.98)), url(${channelInfo.bannerUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg, rgba(168, 199, 250, 0.14) 0%, rgba(18, 19, 22, 0.98) 70%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--md-sys-color-secondary-container, #282A2F)',
                  color: 'var(--md-sys-color-on-secondary-container, #A8C7FA)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 800,
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '2px solid var(--md-sys-color-outline-variant, rgba(168, 199, 250, 0.3))',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}
              >
                {displayAvatar && !avatarError ? (
                  <img
                    src={displayAvatar}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  displayName.slice(0, 2).toUpperCase()
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '22px',
                      fontWeight: 800,
                      color: '#F3F4F6',
                      letterSpacing: '-0.02em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {displayName}
                  </h2>
                  <span
                    className="material-symbols-rounded"
                    style={{
                      fontSize: '18px',
                      color: '#A8C7FA',
                      fontVariationSettings: "'FILL' 1"
                    }}
                  >
                    check_circle
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                    fontSize: '13px',
                    color: '#9AA0A6',
                    fontWeight: 500
                  }}
                >
                  {channelInfo?.subscriberCountText && (
                    <span>{channelInfo.subscriberCountText}</span>
                  )}
                  {channelInfo?.videos && channelInfo.videos.length > 0 && (
                    <span>
                      {channelInfo?.subscriberCountText ? '• ' : ''}
                      {channelInfo.videos.length} videos loaded
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={handleToggleSub}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  height: '40px',
                  padding: '0 18px',
                  borderRadius: isSubscribed ? '12px' : '999px',
                  border: isSubscribed
                    ? '1px solid rgba(255, 255, 255, 0.16)'
                    : 'none',
                  backgroundColor: isSubscribed
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#A8C7FA',
                  color: isSubscribed ? '#E3E3E3' : '#062E6F',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              >
                <span
                  className="material-symbols-rounded"
                  style={{
                    fontSize: '18px',
                    fontVariationSettings: isSubscribed ? "'FILL' 1" : "'FILL' 0"
                  }}
                >
                  {isSubscribed ? 'notifications_active' : 'person_add'}
                </span>
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>

              <button
                type="button"
                onClick={closeChannel}
                title="Close Channel Drawer"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  color: '#E3E3E3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                  close
                </span>
              </button>
            </div>
          </div>

          {channelInfo?.description && (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: '12.5px',
                lineHeight: 1.5,
                color: '#9AA0A6',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {channelInfo.description}
            </p>
          )}

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
            {[
              { id: 'all', label: 'All Uploads' },
              { id: 'short', label: 'Under 10 min' },
              { id: 'long', label: '10+ min Deep Dives' }
            ].map((tab) => {
              const active = filterMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id as any)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: active ? '10px' : '999px',
                    border: active
                      ? '1px solid #A8C7FA'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: active
                      ? 'rgba(168, 199, 250, 0.18)'
                      : 'rgba(255, 255, 255, 0.04)',
                    color: active ? '#A8C7FA' : '#C4C7C5',
                    fontSize: '12.5px',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 180ms ease'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Videos Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px 100px'
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '20px'
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      borderRadius: '16px',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      animation: 'kodaPulse 1.5s ease-in-out infinite'
                    }}
                  />
                  <div
                    style={{
                      width: '80%',
                      height: '14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.06)'
                    }}
                  />
                </div>
              ))}
            </div>
          ) : filteredVideos.length === 0 ? (
            <div
              style={{
                padding: '64px 20px',
                textAlign: 'center',
                color: '#9AA0A6'
              }}
            >
              No videos match this length filter.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '22px 18px'
              }}
            >
              {filteredVideos.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onClick={(clicked) => {
                    closeChannel();
                    playVideo(clicked);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes channelBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes channelSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};
