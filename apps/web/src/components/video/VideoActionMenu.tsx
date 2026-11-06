import React, { useEffect, useRef, useState } from 'react';
import { VideoItem } from '../../types';
import { usePlayerStore } from '../../store/playerStore';

interface VideoActionMenuProps {
  video: VideoItem;
  isOpen: boolean;
  onClose: () => void;
  onPlayVideo: (video: VideoItem) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export const VideoActionMenu: React.FC<VideoActionMenuProps> = ({
  video,
  isOpen,
  onClose,
  onPlayVideo,
  anchorRef
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const { playTrack, addToQueue } = usePlayerStore();

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    playTrack({
      id: video.id,
      title: video.title,
      artist: video.channelName,
      duration: video.duration || 210,
      thumbnailUrl: video.thumbnailUrl,
      highResThumbnailUrl: video.thumbnailUrl
    });
    onClose();
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue({
      id: video.id,
      title: video.title,
      artist: video.channelName,
      duration: video.duration || 210,
      thumbnailUrl: video.thumbnailUrl,
      highResThumbnailUrl: video.thumbnailUrl
    });
    onClose();
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${video.id}`);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 900);
    } catch {
      onClose();
    }
  };

  const handleOpenYouTube = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        right: '0',
        zIndex: 50,
        minWidth: '190px',
        backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
        border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
        borderRadius: '14px',
        padding: '6px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'm3MenuPop 180ms cubic-bezier(0.34, 1.56, 0.64, 1) both'
      }}
    >
      {/* 1. Play Video */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPlayVideo(video);
          onClose();
        }}
        style={menuItemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#ffd8e4' }}>
          smart_display
        </span>
        <span>Play Video</span>
      </button>

      {/* 2. Play Audio Only */}
      <button
        type="button"
        onClick={handlePlayAudio}
        style={menuItemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#d0bcff' }}>
          music_note
        </span>
        <span>Play as Music</span>
      </button>

      {/* 3. Add to Queue */}
      <button
        type="button"
        onClick={handleAddToQueue}
        style={menuItemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
          playlist_add
        </span>
        <span>Add to Queue</span>
      </button>

      <div style={{ height: '1px', backgroundColor: 'var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))', margin: '4px 6px' }} />

      {/* 4. Copy Link */}
      <button
        type="button"
        onClick={handleCopyLink}
        style={menuItemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
          {copied ? 'check' : 'link'}
        </span>
        <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
      </button>

      {/* 5. Open in YouTube */}
      <button
        type="button"
        onClick={handleOpenYouTube}
        style={menuItemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
          open_in_new
        </span>
        <span>Open on YouTube</span>
      </button>

      <style>{`
        @keyframes m3MenuPop {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(-6px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 12px',
  borderRadius: '8px',
  border: 'none',
  background: 'transparent',
  color: 'var(--md-sys-color-on-surface, #e6e1e5)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background-color 140ms ease'
};
