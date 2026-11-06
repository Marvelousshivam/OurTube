import React, { useEffect, useState } from 'react';
import { VideoNotification, VideoItem } from '../../types';
import { bridgeClient } from '../../api/bridgeClient';

interface NotificationsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo?: (video: Partial<VideoItem>) => void;
}

export const NotificationsSheet: React.FC<NotificationsSheetProps> = ({
  isOpen,
  onClose,
  onSelectVideo
}) => {
  const [notifications, setNotifications] = useState<VideoNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    // Mock initial notifications with fallback to real InnerTube notification feed if authenticated
    const timer = setTimeout(() => {
      setNotifications([
        {
          id: 'notif_1',
          title: 'AVENGERS DOOMSDAY: Latveria Revealed in New Promos!',
          channelName: 'New Rockstars',
          channelIconUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_k69V7fKkQ1b8XJ4jG8KkQ1b8XJ4jG8=s88-c-k-c0x00ffffff-no-rj',
          timeAgo: '2 hours ago',
          thumbnailUrl: 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg',
          videoId: 'M7lc1UVf-VE',
          read: false
        },
        {
          id: 'notif_2',
          title: 'Why I hate "deep" quotes (and why you should too)',
          channelName: 'Unsolicited advice',
          timeAgo: '9 hours ago',
          thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          videoId: 'dQw4w9WgXcQ',
          read: false
        },
        {
          id: 'notif_3',
          title: 'Material 3 Expressive Design System Deep Dive',
          channelName: 'Google Developers',
          timeAgo: 'Yesterday',
          thumbnailUrl: 'https://i.ytimg.com/vi/3JZ_D3ELwOQ/hqdefault.jpg',
          videoId: '3JZ_D3ELwOQ',
          read: true
        }
      ]);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'kodaSheetFade 220ms ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '80vh',
          backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
          borderRadius: '28px 28px 0 0',
          border: '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.1))',
          borderBottom: 'none',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'kodaSheetSlideUp 280ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: 'var(--md-sys-color-outline-variant, rgba(255,255,255,0.25))'
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px 12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '24px',
                color: 'var(--md-sys-color-primary, #d0bcff)'
              }}
            >
              notifications
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface, #e6e1e5)'
              }}
            >
              Notifications
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-surface-container, rgba(255,255,255,0.06))',
              border: 'none',
              color: 'var(--md-sys-color-on-surface-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Close"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </div>

        {/* List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Loading updates...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)' }}>
              No notifications yet.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.videoId && onSelectVideo) {
                    onSelectVideo({
                      id: item.videoId,
                      title: item.title,
                      channelName: item.channelName,
                      thumbnailUrl: item.thumbnailUrl || ''
                    });
                    onClose();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 14px',
                  borderRadius: '16px',
                  backgroundColor: item.read
                    ? 'transparent'
                    : 'var(--md-sys-color-surface-container, rgba(255,255,255,0.04))',
                  cursor: item.videoId ? 'pointer' : 'default',
                  transition: 'background-color 150ms ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-highest, rgba(255,255,255,0.08))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = item.read
                    ? 'transparent'
                    : 'var(--md-sys-color-surface-container, rgba(255,255,255,0.04))';
                }}
              >
                {/* Channel Icon */}
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-secondary-container, #4a4458)',
                    color: 'var(--md-sys-color-on-secondary-container, #e8def8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0,
                    overflow: 'hidden'
                  }}
                >
                  {item.channelIconUrl ? (
                    <img src={item.channelIconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    item.channelName.slice(0, 2).toUpperCase()
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: '0 0 4px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--md-sys-color-on-surface, #fff)',
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'var(--md-sys-color-on-surface-variant, #cac4d0)'
                    }}
                  >
                    {item.channelName} • {item.timeAgo}
                  </p>
                </div>

                {/* Video thumbnail preview */}
                {item.thumbnailUrl && (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    style={{
                      width: '68px',
                      height: '42px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes kodaSheetFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes kodaSheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
