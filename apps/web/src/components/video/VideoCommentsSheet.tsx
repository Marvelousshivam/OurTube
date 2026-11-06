import React, { useEffect, useState } from 'react';
import { VideoCommentItem } from '../../types';
import { innertubeService } from '../../api/innertubeService';

interface VideoCommentsSheetProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
  totalCommentCount?: string;
}

export const VideoCommentsSheet: React.FC<VideoCommentsSheetProps> = ({
  videoId,
  isOpen,
  onClose,
  totalCommentCount
}) => {
  const [comments, setComments] = useState<VideoCommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !videoId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    innertubeService
      .getVideoComments(videoId)
      .then((items) => {
        if (!isMounted) return;
        setComments(items);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[VideoCommentsSheet] Failed to load comments:', err);
        setError('Unable to load comments at this time.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, videoId]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'kodaFadeIn 200ms ease'
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          margin: '0 auto',
          maxHeight: '82vh',
          backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
          color: 'var(--md-sys-color-on-surface, #e6e1e5)',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'kodaSheetSlideUp 280ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle Pill */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: '12px',
            paddingBottom: '4px'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: 'var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.2))'
            }}
          />
        </div>

        {/* Sheet Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px 16px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: 'var(--md-sys-color-on-surface, #fff)'
              }}
            >
              Comments
            </h2>
            {totalCommentCount && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                  backgroundColor: 'var(--md-sys-color-surface-container-highest, rgba(255, 255, 255, 0.08))',
                  padding: '2px 10px',
                  borderRadius: '9999px'
                }}
              >
                {totalCommentCount}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close comments"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-surface-container, rgba(255, 255, 255, 0.08))',
              color: 'var(--md-sys-color-on-surface, #fff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 150ms ease'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </div>

        {/* Scrollable Comments List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {loading ? (
            /* Skeleton list */
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    flexShrink: 0,
                    animation: 'kodaPulse 1.5s infinite ease-in-out'
                  }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      width: '140px',
                      height: '14px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      animation: 'kodaPulse 1.5s infinite ease-in-out'
                    }}
                  />
                  <div
                    style={{
                      width: '90%',
                      height: '12px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      animation: 'kodaPulse 1.5s infinite ease-in-out'
                    }}
                  />
                  <div
                    style={{
                      width: '60%',
                      height: '12px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      animation: 'kodaPulse 1.5s infinite ease-in-out'
                    }}
                  />
                </div>
              </div>
            ))
          ) : error ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--md-sys-color-on-surface-variant, #cac4d0)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '36px', opacity: 0.6, marginBottom: '8px' }}>
                forum
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '14px' }}>{error}</p>
            </div>
          ) : comments.length === 0 ? (
            <div
              style={{
                padding: '50px 20px',
                textAlign: 'center',
                color: 'var(--md-sys-color-on-surface-variant, #cac4d0)'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '40px', opacity: 0.5, marginBottom: '10px' }}>
                chat_bubble_outline
              </span>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>No comments to display</p>
              <p style={{ margin: '6px 0 0', fontSize: '13px', opacity: 0.7 }}>
                Comments may be restricted or disabled for this video.
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start'
                }}
              >
                {/* Author Avatar */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-surface-container-highest, rgba(255, 255, 255, 0.12))',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--md-sys-color-on-surface, #fff)'
                  }}
                >
                  {comment.authorAvatarUrl ? (
                    <img
                      src={comment.authorAvatarUrl}
                      alt={comment.authorName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    comment.authorName.slice(0, 1).toUpperCase()
                  )}
                </div>

                {/* Comment Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--md-sys-color-on-surface, #fff)'
                      }}
                    >
                      {comment.authorName}
                    </span>
                    {comment.publishedTime && (
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                          opacity: 0.8
                        }}
                      >
                        • {comment.publishedTime}
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      margin: '0 0 8px',
                      fontSize: '14px',
                      lineHeight: '1.45',
                      color: 'var(--md-sys-color-on-surface, #e6e1e5)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
                    {comment.text}
                  </p>

                  {/* Actions & Likes */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                        thumb_up
                      </span>
                      {comment.likeCount && <span>{comment.likeCount}</span>}
                    </div>

                    {comment.replyCount !== undefined && comment.replyCount > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'var(--md-sys-color-primary, #d0bcff)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
                          forum
                        </span>
                        <span>{comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes kodaFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes kodaSheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes kodaPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};
