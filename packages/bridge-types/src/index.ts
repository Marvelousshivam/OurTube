export type BridgeMessageType =
  | 'KODA_BRIDGE_PING'
  | 'KODA_BRIDGE_PONG'
  | 'KODA_BRIDGE_GET_AUTH'
  | 'KODA_BRIDGE_GET_ACCOUNTS'
  | 'KODA_BRIDGE_SELECT_ACCOUNT'
  | 'KODA_BRIDGE_FETCH'
  | 'KODA_BRIDGE_STREAM_URL'
  | 'KODA_BRIDGE_COOKIE_SYNC';

export interface BridgeRequest<T = any> {
  channel: 'KODA_BRIDGE_REQ';
  id: string;
  type: BridgeMessageType;
  payload?: T;
}

export interface BridgeResponse<T = any> {
  channel: 'KODA_BRIDGE_RES';
  id: string;
  type: BridgeMessageType;
  success: boolean;
  data?: T;
  error?: string;
}

export interface YtChannel {
  id: string; // `${authUser}:${pageId ?? 'own'}`
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

export interface FetchRequestPayload {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

export interface FetchResponsePayload {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
}

export interface StreamResolutionRequest {
  videoId: string;
  quality?: 'auto' | '1080p' | '720p' | '480p' | '360p';
  mode?: 'music' | 'video';
}

export interface StreamResolutionResponse {
  audioUrl?: string;
  videoUrl?: string;
  audioBitrate?: number;
  videoQuality?: string;
  expiresInSeconds?: number;
  format?: string;
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
  time: number; // in seconds
  text: string;
  words?: {
    word: string;
    time: number;
    duration?: number;
  }[];
}

export interface LyricsData {
  synced: boolean;
  provider: 'lrclib' | 'innertube' | 'local';
  lines: LyricsLine[];
  rawLrc?: string;
  plainLyrics?: string;
}

export type PlaybackMode = 'music' | 'video';
export type RepeatMode = 'off' | 'all' | 'one';
