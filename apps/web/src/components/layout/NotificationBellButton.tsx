import React, { useState } from 'react';

interface NotificationBellButtonProps {
  onClick: () => void;
  hasUnread?: boolean;
  className?: string;
}

export const NotificationBellButton: React.FC<NotificationBellButtonProps> = ({
  onClick,
  hasUnread = false,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      title="Notifications"
      aria-label="Notifications"
      className={`relative inline-flex items-center justify-center cursor-pointer select-none border-none p-0 ${className}`}
      style={{
        width: '42px',
        height: '42px',
        minWidth: '42px',
        minHeight: '42px',
        padding: 0,
        margin: 0,
        appearance: 'none',
        WebkitAppearance: 'none',
        borderRadius: '50%',
        backgroundColor: isHovered
          ? 'var(--md-sys-color-surface-container-high)'
          : 'var(--md-sys-color-surface-container)',
        border: '1px solid var(--md-sys-color-outline-variant)',
        color: 'var(--md-sys-color-on-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${isPressed ? 0.92 : isHovered ? 1.05 : 1})`,
        transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 150ms ease, box-shadow 150ms ease',
        boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        outline: 'none',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <span
        className="material-symbols-rounded"
        style={{
          fontSize: '20px',
          fontVariationSettings: hasUnread ? "'FILL' 1" : "'FILL' 0"
        }}
      >
        notifications
      </span>

      {hasUnread && (
        <span
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--md-sys-color-primary, #6750a4)',
            boxShadow: '0 0 0 2px var(--md-sys-color-surface, #fff)'
          }}
        />
      )}
    </button>
  );
};
