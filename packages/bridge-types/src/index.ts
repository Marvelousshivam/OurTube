export type BridgeMessageType =
  | 'KODA_BRIDGE_PING'
  | 'KODA_BRIDGE_PONG'
  | 'KODA_BRIDGE_GET_AUTH'
  | 'KODA_BRIDGE_GET_ACCOUNTS'
  | 'KODA_BRIDGE_SELECT_ACCOUNT'
  | 'KODA_BRIDGE_FETCH'
  | 'KODA_BRIDGE_STREAM_URL'
  | 'KODA_BRIDGE_COOKIE_SYNC'
  | 'KODA_BRIDGE_SCRAPE_HOME'
  | 'KODA_BRIDGE_DISCORD';

export type BridgeRequestChannel = 'OURTUBE_BRIDGE_REQ' | 'KODA_BRIDGE_REQ';
export type BridgeResponseChannel = 'OURTUBE_BRIDGE_RES' | 'KODA_BRIDGE_RES';

export interface BridgeRequest<T = any> {
  channel: BridgeRequestChannel;
  id: string;
  type: BridgeMessageType;
  payload?: T;
}

export interface BridgeResponse<T = any> {
  channel: BridgeResponseChannel;
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

export interface YouTubeAudioTrackOption {
  id: string; // e.g. "en.4", "hi.2"
  displayName: string; // e.g. "English original", "Hindi (auto-dubbed)"
  languageTag?: string; // e.g. "en", "hi"
  isOriginal: boolean;
  isAutoDubbed: boolean;
  url?: string;
  bitrate?: number;
}

export interface StreamResolutionRequest {
  videoId: string;
  quality?: 'auto' | '1080p' | '720p' | '480p' | '360p';
  audioQuality?: 'high' | 'normal' | 'low';
  mode?: 'music' | 'video';
  audioTrackId?: string;
}

export interface StreamResolutionResponse {
  audioUrl?: string;
  videoUrl?: string;
  audioBitrate?: number;
  videoQuality?: string;
  expiresInSeconds?: number;
  format?: string;
  audioTracks?: YouTubeAudioTrackOption[];
  selectedAudioTrackId?: string;
}

export function decodeYouTubeXtags(xtags?: string | null): Record<string, string> {
  if (!xtags) return {};
  try {
    let b64 = xtags.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const binary = typeof atob === 'function'
      ? atob(b64)
      : (typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('binary') : '');
    if (!binary) return {};

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    function readFields(buf: Uint8Array): Array<{ field: number; data: Uint8Array }> {
      const result: Array<{ field: number; data: Uint8Array }> = [];
      let pos = 0;
      while (pos < buf.length) {
        let shift = 0;
        let key = 0;
        let valid = false;
        while (pos < buf.length && shift < 32) {
          const b = buf[pos++];
          key |= (b & 0x7f) << shift;
          if ((b & 0x80) === 0) {
            valid = true;
            break;
          }
          shift += 7;
        }
        if (!valid) break;
        const wire = key & 7;
        const field = key >>> 3;
        if (wire === 0) {
          while (pos < buf.length && (buf[pos++] & 0x80) !== 0) {}
        } else if (wire === 2) {
          let lenShift = 0;
          let len = 0;
          let lenValid = false;
          while (pos < buf.length && lenShift < 32) {
            const b = buf[pos++];
            len |= (b & 0x7f) << lenShift;
            if ((b & 0x80) === 0) {
              lenValid = true;
              break;
            }
            lenShift += 7;
          }
          if (!lenValid || len < 0 || pos + len > buf.length) break;
          result.push({ field, data: buf.slice(pos, pos + len) });
          pos += len;
        } else {
          break;
        }
      }
      return result;
    }

    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
    function bytesToStr(u8: Uint8Array): string {
      if (decoder) return decoder.decode(u8);
      let s = '';
      for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
      try {
        return decodeURIComponent(escape(s));
      } catch {
        return s;
      }
    }

    const out: Record<string, string> = {};
    const topFields = readFields(bytes);
    for (const top of topFields) {
      if (top.field === 1) {
        const subFields = readFields(top.data);
        let key: string | null = null;
        let val: string | null = null;
        for (const sub of subFields) {
          if (sub.field === 1) key = bytesToStr(sub.data);
          if (sub.field === 2) val = bytesToStr(sub.data);
        }
        if (key && val !== null) {
          out[key] = val;
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function parseAudioTracksFromAdaptiveFormats(
  adaptiveFormats: any[],
  audioQuality: 'high' | 'normal' | 'low' = 'high'
): YouTubeAudioTrackOption[] {
  if (!Array.isArray(adaptiveFormats)) return [];
  const byTrack = new Map<string, any[]>();

  for (const f of adaptiveFormats) {
    const mimeType = f.mimeType || f.mime_type;
    if (!mimeType || !mimeType.startsWith('audio/')) continue;
    const isDrc = Boolean(f.isDrc || f.is_drc);
    if (!f.url || isDrc) continue;
    const audioTrackObj = f.audioTrack || f.audio_track;
    const trackId = audioTrackObj?.id || audioTrackObj?.audio_track_id || 'default';
    if (!byTrack.has(trackId)) {
      byTrack.set(trackId, []);
    }
    byTrack.get(trackId)!.push(f);
  }

  const tracks: YouTubeAudioTrackOption[] = [];

  for (const [id, formats] of byTrack.entries()) {
    // Pick format based on audioQuality preference (AAC preferred for compatibility)
    const sorted = [...formats].sort((a, b) => {
      const aMime = a.mimeType || a.mime_type || '';
      const bMime = b.mimeType || b.mime_type || '';
      const aIsAac = aMime.includes('mp4a') ? 1 : 0;
      const bIsAac = bMime.includes('mp4a') ? 1 : 0;
      if (bIsAac !== aIsAac) return bIsAac - aIsAac;
      if (audioQuality === 'low') {
        return (a.bitrate || 0) - (b.bitrate || 0);
      }
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

    const best =
      audioQuality === 'normal' && sorted.length > 1
        ? sorted[Math.floor(sorted.length / 2)]
        : sorted[0];

    if (!best) continue;

    const tags = decodeYouTubeXtags(best.xtags);
    const acont = tags['acont'];
    const audioTrackObj = best.audioTrack || best.audio_track;
    const rawName =
      audioTrackObj?.displayName ||
      audioTrackObj?.display_name ||
      (id === 'default' ? 'Original' : id);
    const isDefault = Boolean(
      audioTrackObj?.audioIsDefault ?? audioTrackObj?.audio_is_default
    );
    const isOriginal = acont === 'original' || (!acont && isDefault);
    const isAutoDubbed = acont === 'dubbed-auto';
    const lang = tags['lang'] || (id !== 'default' ? id.split('.')[0] : undefined);

    let cleanName = rawName;
    if (isOriginal && !cleanName.toLowerCase().includes('original')) {
      cleanName = `${cleanName} (Original)`;
    } else if (isAutoDubbed && !cleanName.toLowerCase().includes('auto-dubbed')) {
      cleanName = `${cleanName} (auto-dubbed)`;
    }

    tracks.push({
      id,
      displayName: cleanName,
      languageTag: lang,
      isOriginal,
      isAutoDubbed,
      url: best.url,
      bitrate: best.bitrate
    });
  }

  // Sort original first, then alphabetically
  return tracks.sort((a, b) => {
    if (a.isOriginal !== b.isOriginal) return a.isOriginal ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
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
