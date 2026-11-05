import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useTasteStore } from '../store/tasteStore';

export interface KeyboardShortcutsOptions {
  onOpenShortcuts?: () => void;
}

export function useKeyboardShortcuts(options?: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Guard: do not intercept keystrokes when the user is typing in an input or text field
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // 2. Ignore shortcut if Meta or Ctrl is pressed (avoid overriding browser shortcuts like Ctrl+R, Cmd+W)
      if (e.metaKey || e.ctrlKey) {
        return;
      }

      const key = e.key;
      const lower = key.toLowerCase();
      const player = usePlayerStore.getState();

      switch (lower) {
        // Play / Pause toggle
        case ' ':
        case 'k': {
          e.preventDefault();
          player.togglePlay();
          break;
        }

        // Seek backward 5s (ArrowLeft) or 10s (J)
        case 'arrowleft': {
          e.preventDefault();
          player.seek(Math.max(0, player.currentTime - 5));
          break;
        }
        case 'j': {
          e.preventDefault();
          player.seek(Math.max(0, player.currentTime - 10));
          break;
        }

        // Seek forward 5s (ArrowRight) or 10s (L)
        case 'arrowright': {
          e.preventDefault();
          const maxDur = player.duration || (player.currentTrack?.duration ?? 0);
          player.seek(Math.min(maxDur, player.currentTime + 5));
          break;
        }
        case 'l': {
          // If Alt is held or on 'c', toggle lyrics; otherwise YouTube standard fast-forward 10s
          if (e.altKey) {
            e.preventDefault();
            if (!player.isExpanded) player.setExpanded(true);
            player.setLyricsOpen(!player.isLyricsOpen);
          } else {
            e.preventDefault();
            const maxDur = player.duration || (player.currentTrack?.duration ?? 0);
            player.seek(Math.min(maxDur, player.currentTime + 10));
          }
          break;
        }

        // Lyrics view toggle (C = Captions/Lyrics)
        case 'c': {
          e.preventDefault();
          if (!player.isExpanded) player.setExpanded(true);
          player.setLyricsOpen(!player.isLyricsOpen);
          break;
        }

        // Volume Up / Down (+5% / -5%)
        case 'arrowup': {
          e.preventDefault();
          player.setVolume(Math.min(1, player.volume + 0.05));
          break;
        }
        case 'arrowdown': {
          e.preventDefault();
          player.setVolume(Math.max(0, player.volume - 0.05));
          break;
        }

        // Mute toggle
        case 'm': {
          e.preventDefault();
          player.toggleMute();
          break;
        }

        // Queue Sheet toggle
        case 'q': {
          e.preventDefault();
          if (!player.isExpanded) player.setExpanded(true);
          player.setQueueOpen(!player.isQueueOpen);
          break;
        }

        // Next / Previous Track
        case 'n': {
          e.preventDefault();
          player.nextTrack();
          break;
        }
        case 'p': {
          e.preventDefault();
          player.prevTrack();
          break;
        }

        // Shuffle & Repeat
        case 's': {
          e.preventDefault();
          player.toggleShuffle();
          break;
        }
        case 'r': {
          e.preventDefault();
          player.toggleRepeat();
          break;
        }

        // Like / Favorite Track
        case 'h': {
          e.preventDefault();
          if (player.currentTrack) {
            useTasteStore.getState().toggleLikeTrack(player.currentTrack);
          }
          break;
        }

        // Fullscreen / Stage Mode
        case 'f': {
          e.preventDefault();
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
        }

        // Open Keyboard Shortcuts Cheat Sheet
        case '?': {
          e.preventDefault();
          options?.onOpenShortcuts?.();
          break;
        }

        // Collapse Expanded Player or Close Sheets
        case 'escape': {
          if (player.isLyricsOpen || player.isQueueOpen) {
            e.preventDefault();
            player.setLyricsOpen(false);
            player.setQueueOpen(false);
          } else if (player.isExpanded) {
            e.preventDefault();
            player.setExpanded(false);
          }
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options]);
}
