export type PlaybackMode = 'music' | 'video';
export type VideoQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';
export * from './video';
export type RepeatMode = 'off' | 'all' | 'one';
export type PlayerStyle = 'EDITORIAL' | 'CLASSIC' | 'BENTO' | 'CANVAS' | 'GESTURE' | 'STICKER' | 'HERO' | 'MORPH' | 'DIAL';

export type QueueTier = 'context' | 'user' | 'autoplay';

export interface QueueEntry {
  entryId: string;
  track: TrackMetadata;
  tier: QueueTier;
  sourceTitle?: string;
}

export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration: number; // in seconds
  thumbnailUrl: string;
  highResThumbnailUrl?: string;
  isExplicit?: boolean;
  viewCount?: number;
  audioStreamUrl?: string;
  videoStreamUrl?: string;
}

export interface LyricsLine {
  time: number; // seconds
  text: string;
  words?: {
    word: string;
    time: number;
    duration?: number;
  }[];
}

export interface LyricsData {
  synced: boolean;
  wordSynced?: boolean;
  provider: 'lrc.red' | 'lrclib' | 'innertube' | 'local';
  lines: LyricsLine[];
  ttml?: string;
}

export interface YtChannel {
  id: string;
  name: string;
  handle?: string | null;
  avatarUrl?: string | null;
  brand: boolean;
  authUser: string;
  pageId?: string | null;
  selectedOnWeb?: boolean;
}

export interface YtAccount {
  authUser: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  channels: YtChannel[];
}

export interface AuthState {
  isAuthenticated: boolean;
  sapisid?: string;
  sapisidHash?: string;
  accounts: YtAccount[];
  selectedChannelId?: string | null;
  selectedChannel?: YtChannel | null;
  cookies?: Record<string, string>;
}

export interface SearchFilter {
  id: 'all' | 'songs' | 'videos' | 'albums' | 'artists' | 'playlists';
  label: string;
}

export interface TasteEntry {
  trackId: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  thumbnailUrl?: string;
  highResThumbnailUrl?: string;
  duration?: number;
  playedAt: number;
  playCount: number;
  completionRate: number; // 0 to 1
  isLiked?: boolean;
}

export type { YouTubeAudioTrackOption, StreamResolutionRequest, StreamResolutionResponse } from '@koda/bridge-types';

