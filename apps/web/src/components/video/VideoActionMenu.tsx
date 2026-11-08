import React, { useEffect, useRef, useState } from 'react';
import { VideoItem } from '../../types';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';

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
  const { playTrack, addToQueue, openChannel } = usePlayerStore();
  const {
    toggleWatchLaterVideo,
    isWatchLaterVideo,
    toggleLikeVideo,
    isVideoLiked
  } = useTasteStore();

  const inWatchLater = isWatchLaterVideo(video.id);
  const isLiked = isVideoLiked(video.id);

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

  const handleToggleWatchLater = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWatchLaterVideo({
      id: video.id,
      title: video.title,
      channelName: video.channelName,
      channelId: video.channelId,
      channelIconUrl: video.channelIconUrl,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      viewCountText: video.viewCount
    });
    onClose();
  };

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLikeVideo({
      id: video.id,
      title: video.title,
      channelName: video.channelName,
      channelId: video.channelId,
      channelIconUrl: video.channelIconUrl,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      viewCountText: video.viewCount
    });
    onClose();
  };

  const handleViewChannel = (e: React.MouseEvent) => {
    e.stopPropagation();
    openChannel({
      id: video.channelId,
      name: video.channelName,
      avatarUrl: video.channelIconUrl
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
        minWidth: '205px',
        backgroundColor: 'rgba(30, 31, 36, 0.96)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '6px',
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        animation: 'm3MenuPop 180ms cubic-bezier(0.22, 1, 0.36, 1) both'
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
        <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#A8C7FA' }}>
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
        <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#D0BCFF' }}>
          headphones
        </span>
        <span>Listen as Music</span>
      </button>

      {/* 3. Save to Watch Later */}
      <button
        type="button"
        onClick={handleToggleWatchLater}
        style={menuItemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span
          className="material-symbols-rounded"
          style={{
            fontSize: '18px',
            color: inWatchLater ? '#81C995' : '#E3E3E3',
            fontVariationSettings: inWatchLater ? "'FILL' 1" : "'FILL' 0"
          }}
        >
          {inWatchLater ? 'task_alt' : 'schedule'}
        </span>
        <span>{inWatchLater ? 'Remove Watch Later' : 'Save to Watch Later'}</span>
      </button>

      {/* 4. Like Video */}
      <button
        type="button"
        onClick={handleToggleLike}
        style={menuItemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span
          className="material-symbols-rounded"
          style={{
            fontSize: '18px',
            color: isLiked ? '#A8C7FA' : '#E3E3E3',
            fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0"
          }}
        >
          thumb_up
        </span>
        <span>{isLiked ? 'Liked Video' : 'Like Video'}</span>
      </button>

      {/* 5. Add to Queue */}
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

      {/* 6. View Channel */}
      <button
        type="button"
        onClick={handleViewChannel}
        style={menuItemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
          person
        </span>
        <span>View Channel</span>
      </button>

      <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '4px 6px' }} />

      {/* 7. Copy Link */}
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

      {/* 8. Open in YouTube */}
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
  borderRadius: '10px',
  border: 'none',
  background: 'transparent',
  color: '#F3F4F6',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background-color 140ms ease'
};
