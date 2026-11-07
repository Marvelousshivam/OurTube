import {
  TrackMetadata,
  SearchFilter,
  VideoItem,
  TopicChip,
  VideoFeedResult,
  SubscribedChannel,
  SubscriptionsFeedResult,
  VideoWatchDetails,
  VideoCommentItem,
  VideoPlaylist,
  VideoSearchResult,
  VideoSearchCategory,
  VideoSearchSort,
  VideoSearchDateFilter
} from '../types';
import { bridgeClient } from './bridgeClient';
import { sizedArtwork, FALLBACK_ARTWORK_DATA_URI } from './artworkService';
import { getWebInnertube } from './streamResolver';

export interface HomeSection {
  title: string;
  items: TrackMetadata[];
}

const NON_MUSIC_PATTERNS =
  /\b(podcast|episode|ep\.\s*\d+|standup|stand-up|dark comedy|comedy|sketch|roast|trailer|teaser|movie review|film review|explained|reaction|gameplay|walkthrough|playthrough|tutorial|lecture|crash course|breaking news|markets?\s+cheer|stock\s+market|ai\s+bubble|trillion|billion\s+wip|crypto|bitcoin|election|minister|parliament|geopolitics|debate|vlog|unboxing|benchmark|highlights|cricket|ipl|test match|deshbhakt|dhruv rathee|nitish rajput|mohak mangal|abhi and niyu|sofa king|tanmay bhat|samay raina|beerbiceps|ranveer allahbadia|think school|aevy tv|neon man|neuzboy)\b/i;

const MUSIC_SIGNAL_PATTERNS =
  /\b(song|music|audio|lyrics?|cover|ost|unplugged|acoustic|lofi|lo-fi|remix|mashup|medley|feat\.?|ft\.?|prod\.?|sufi|ghazal|qawwali|bhajan|raag|instrumental|chords?|session|studio|records?|soundtrack|melody|orchestra|symphony|single|album|official video)\b/i;

/**
 * Determines whether a candidate track/history item is actually a regular non-music YouTube video
 * (e.g., news, politics, comedy sketch, podcast, tech review) that leaked from shared Google Watch History
 * or Video Mode.
 */
export function isLikelyNonMusicVideo(item: {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  thumbnailUrl?: string;
  musicVideoType?: string;
  rawSubtitle?: string;
}): boolean {
  const title = (item.title || '').trim();
  const artist = (item.artist || '').trim();
  const album = (item.album || '').trim();
  const rawSub = (item.rawSubtitle || '').trim();
  const combined = `${title} ${artist} ${rawSub}`;

  // 1. Explicit InnerTube Podcast Episode type
  if (item.musicVideoType === 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE') {
    return true;
  }

  // 2. Explicit non-music keywords (news, politics, dark comedy, standup, tech, etc.)
  if (NON_MUSIC_PATTERNS.test(combined)) {
    return true;
  }

  // 3. Finance / news headline patterns (e.g. "$3 Trillion Wiped", "Markets Cheer")
  if (/\$[0-9]+(\.[0-9]+)?\s*(million|billion|trillion)/i.test(title)) {
    return true;
  }

  // 4. Long-form videos (> 16 minutes) unless explicitly a music mix/jukebox
  if (
    item.duration &&
    item.duration > 960 &&
    !/\b(jukebox|mix|nonstop|non-stop|lofi|lo-fi|mashup|full album|medley|bhajan|qawwali)\b/i.test(combined)
  ) {
    return true;
  }

  // 5. InnerTube UGC video from shared YouTube watch history without album or music signals
  if (item.musicVideoType === 'MUSIC_VIDEO_TYPE_UGC') {
    const hasSquareMusicCover =
      (item.thumbnailUrl || '').includes('googleusercontent.com') ||
      (item.thumbnailUrl || '').includes('music.youtube.com');
    const hasMusicSignal = MUSIC_SIGNAL_PATTERNS.test(combined) || Boolean(album);
    if (!hasSquareMusicCover && !hasMusicSignal) {
      return true;
    }
  }

  return false;
}

export interface UserPlaylist {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  author: string;
  trackCount?: number;
}

export interface ArtistDetails {
  id: string; // browseId e.g. UCDxKh1gFWeYsqePvgVzmPoQ
  name: string;
  heroImage?: string;
  avatarUrl?: string;
  subscribers?: string;
  description?: string;
  topSongs: TrackMetadata[];
  albums: {
    id: string;
    title: string;
    year?: string;
    imageUrl?: string;
  }[];
  singles: {
    id: string;
    title: string;
    year?: string;
    imageUrl?: string;
  }[];
  relatedArtists: {
    id: string;
    name: string;
    subscribers?: string;
    imageUrl?: string;
  }[];
}

export class InnertubeService {
  /**
   * Helper to ensure JSON parsed object
   */
  private ensureJsonObject(data: any): any {
    if (!data) return null;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return data;
  }

  /**
   * Helper to extract clean text from any YouTube InnerTube node:
   * Handles string, simpleText, content, text (string or nested), runs array,
   * formattedString, accessibility labels, commandRuns, etc.
   */
  private getNodeText(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node.trim();
    if (typeof node === 'number') return String(node);
    if (node.simpleText) return String(node.simpleText).trim();
    if (node.content) {
      return typeof node.content === 'string' ? node.content.trim() : this.getNodeText(node.content);
    }
    if (node.text !== undefined && node.text !== null) {
      if (typeof node.text === 'string') return node.text.trim();
      return this.getNodeText(node.text);
    }
    if (Array.isArray(node.runs)) {
      return node.runs
        .map((r: any) => (typeof r === 'string' ? r : r.text || r.content || ''))
        .join('')
        .trim();
    }
    if (Array.isArray(node)) {
      return node
        .map((item: any) => this.getNodeText(item))
        .filter(Boolean)
        .join(' ')
        .trim();
    }
    if (node.formattedString) {
      return this.getNodeText(node.formattedString);
    }
    if (node.accessibility?.accessibilityData?.label) {
      return String(node.accessibility.accessibilityData.label).trim();
    }
    if (node.title) {
      return this.getNodeText(node.title);
    }
    return '';
  }

  /**
   * Cleans an artist/creator subtitle from InnerTube noise tokens (like "Song •", views, durations)
   */
  private cleanArtistSubtitle(raw: string): string {
    if (!raw) return '';
    const parts = raw
      .split('•')
      .map((s) => s.trim())
      .filter(Boolean);

    // Filter out common badges
    const meaningfulParts = parts.filter(
      (p) => !/^(Song|Album|Single|Video|EP|Podcast|Episode|\d+:\d+|\d+[\.,]?\d*\s*[KMB]?\s*(views?|plays?|subscribers?))/i.test(p)
    );

    if (meaningfulParts.length > 0) {
      return meaningfulParts.join(' • ');
    }
    return parts[0] || '';
  }

  /**
   * Helper to parse string durations like "3:42" or "1:12:05" into integer seconds
   */
  private parseDurationString(text: string): number {
    if (!text) return 210;
    const parts = text.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 210;
  }

  /**
   * Helper to parse spoken duration strings like "45 minutes, 30 seconds" or "1 hour, 14 minutes, 53 seconds"
   */
  private parseAccessibilityDuration(text: string): { seconds: number; formatted: string } | null {
    if (!text || typeof text !== 'string') return null;
    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    const hourMatch = text.match(/(\d+)\s*hours?/i);
    if (hourMatch) hours = parseInt(hourMatch[1], 10);

    const minuteMatch = text.match(/(\d+)\s*minutes?/i);
    if (minuteMatch) minutes = parseInt(minuteMatch[1], 10);

    const secondMatch = text.match(/(\d+)\s*seconds?/i);
    if (secondMatch) seconds = parseInt(secondMatch[1], 10);

    if (hours === 0 && minutes === 0 && seconds === 0) return null;

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    let formatted = '';
    if (hours > 0) {
      formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
      formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    return { seconds: totalSeconds, formatted };
  }

  /**
   * Extracts continuation pagination tokens from browse responses
   */
  public extractContinuationToken(data: any): string | undefined {
    const json = this.ensureJsonObject(data);
    if (!json) return undefined;

    let foundToken: string | undefined;
    const scan = (node: any) => {
      if (!node || typeof node !== 'object' || foundToken) return;
      if (node.continuationCommand?.token) {
        foundToken = node.continuationCommand.token;
        return;
      }
      if (node.nextContinuationData?.continuation) {
        foundToken = node.nextContinuationData.continuation;
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) scan(item);
      } else {
        for (const k of Object.keys(node)) scan(node[k]);
      }
    };

    scan(json);
    return foundToken;
  }

  /**
   * Universal BitChord InnerTube fetcher:
   * 1. Extension bridge (with signed SAPISID session cookies)
   * 2. Direct browser fetch via declarativeNetRequest Rule 1 (credentials: 'include' + X-Goog-AuthUser)
   * 3. Vite dev server proxy (/api/ytmusic/youtubei/v1/...) -> 0 CORS
   * 4. BitChord Simple Request (text/plain) -> 0 CORS preflight OPTIONS check
   */
  public async fetchInnerTubeEndpoint(endpoint: string, bodyPayload: any): Promise<any> {
    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const defaultPayload: any = {
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20251006.03.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://music.youtube.com/',
          platform: 'DESKTOP'
        }
      },
      ...bodyPayload
    };

    if (activePageId) {
      defaultPayload.context.user = { onBehalfOfUser: activePageId };
    }

    // 1. Try extension bridge
    if (bridgeClient.getIsAvailable()) {
      try {
        const bridgeHeaders: Record<string, string> = {
          'X-Goog-AuthUser': activeAuthUser
        };
        if (activePageId) {
          bridgeHeaders['X-Goog-PageId'] = activePageId;
        }

        const response = await bridgeClient.fetchInnertube({
          url: `https://music.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          headers: bridgeHeaders,
          body: defaultPayload
        });
        if (response?.data && !response.data?.error) {
          return response.data;
        }
      } catch (bridgeErr) {
        console.warn(`[Koda Innertube] Bridge ${endpoint} error:`, bridgeErr);
      }
    }

    // 2. Direct browser fetch with declarativeNetRequest Rule 1 header rewriting
    // Uses Chrome's native multi-account session cookies matching Video Mode
    try {
      const directHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': '67',
        'X-YouTube-Client-Version': '1.20251006.03.00',
        'X-Goog-AuthUser': activeAuthUser
      };
      if (activePageId) {
        directHeaders['X-Goog-PageId'] = activePageId;
      }

      const directRes = await window.fetch(
        `https://music.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false&authuser=${activeAuthUser}`,
        {
          method: 'POST',
          headers: directHeaders,
          body: JSON.stringify(defaultPayload),
          credentials: 'include'
        }
      ).catch(() => null);

      if (directRes && directRes.ok) {
        const directData = await directRes.json();
        if (directData && !directData.error) {
          return directData;
        }
      }
    } catch (directErr) {
      console.warn(`[Koda Innertube] Direct browser fetch ${endpoint} error:`, directErr);
    }

    // 2. Try Vite dev server proxy (/api/ytmusic)
    try {
      const proxyRes = await window.fetch(`/api/ytmusic/youtubei/v1/${endpoint}?prettyPrint=false&authuser=${activeAuthUser}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultPayload)
      });
      if (proxyRes.ok) {
        return await proxyRes.json();
      }
    } catch {
      // Continue to Simple Request
    }

    // 3. BitChord Simple Request: text/plain prevents CORS preflight
    try {
      const directRes = await window.fetch(`https://music.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          'Accept': '*/*'
        },
        body: JSON.stringify(defaultPayload),
        credentials: 'omit'
      });
      if (directRes.ok) {
        return await directRes.json();
      }
    } catch (err) {
      console.warn(`[Koda Innertube] Simple request ${endpoint} error:`, err);
    }

    return null;
  }

  /**
   * Universal fetch helper for Desktop YouTube endpoints (www.youtube.com/youtubei/v1/...)
   * Used for Video Mode feeds, Trending, Subscriptions, and Playlists.
   */
  public async fetchDesktopYouTubeEndpoint(endpoint: string, bodyPayload: any): Promise<any> {
    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const defaultPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/',
          platform: 'DESKTOP'
        }
      },
      ...bodyPayload
    };

    if (activePageId) {
      defaultPayload.context.user = { onBehalfOfUser: activePageId };
    }

    // 1. Try extension bridge
    if (bridgeClient.getIsAvailable()) {
      try {
        const bridgeHeaders: Record<string, string> = {
          'X-Goog-AuthUser': activeAuthUser
        };
        if (activePageId) {
          bridgeHeaders['X-Goog-PageId'] = activePageId;
        }

        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          headers: bridgeHeaders,
          body: defaultPayload
        });
        if (response?.data && !response.data?.error) {
          return response.data;
        }
      } catch (bridgeErr) {
        console.warn(`[Koda Innertube] Desktop YouTube Bridge ${endpoint} error:`, bridgeErr);
      }
    }

    // 2. Direct browser fetch with declarativeNetRequest Rule 2 header rewriting
    try {
      const directHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20251006.00.00',
        'X-Goog-AuthUser': activeAuthUser
      };
      if (activePageId) {
        directHeaders['X-Goog-PageId'] = activePageId;
      }

      const directRes = await window.fetch(
        `https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false&authuser=${activeAuthUser}`,
        {
          method: 'POST',
          headers: directHeaders,
          body: JSON.stringify(defaultPayload),
          credentials: 'include'
        }
      ).catch(() => null);

      if (directRes && directRes.ok) {
        const directData = await directRes.json();
        if (directData && !directData.error) {
          return directData;
        }
      }
    } catch (directErr) {
      console.warn(`[Koda Innertube] Direct browser fetch desktop ${endpoint} error:`, directErr);
    }

    return null;
  }

  /**
   * Fetches official YouTube Music Watch Next Radio station (RDAMVM...)
   * Returns up to 50 curated tracks matching the track's mood, genre, and seed artist.
   */
  public async getWatchNextRadio(videoId: string): Promise<TrackMetadata[]> {
    if (!videoId || videoId.startsWith('playlist_')) return [];

    const data = await this.fetchInnerTubeEndpoint('next', {
      videoId,
      playlistId: `RDAMVM${videoId}`,
      isAudioOnly: true
    });

    return this.parseWatchNextRadio(data);
  }

  /**
   * Parses watch next playlistPanelRenderer results
   */
  private parseWatchNextRadio(raw: any): TrackMetadata[] {
    const data = this.ensureJsonObject(raw);
    const tracks: TrackMetadata[] = [];
    if (!data) return tracks;

    const seenIds = new Set<string>();

    const addRenderer = (r: any) => {
      if (!r || !r.videoId || seenIds.has(r.videoId)) return;
      seenIds.add(r.videoId);

      const title = this.getNodeText(r.title);
      if (!title) return;

      const rawArtist = this.getNodeText(r.longBylineText) || this.getNodeText(r.shortBylineText);
      const artist = this.cleanArtistSubtitle(rawArtist) || 'YouTube Music';
      const thumb =
        r.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
        `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`;
      const dur = this.parseDurationString(this.getNodeText(r.lengthText));

      tracks.push({
        id: r.videoId,
        title: title.trim(),
        artist,
        duration: dur,
        thumbnailUrl: thumb,
        highResThumbnailUrl: sizedArtwork(thumb, 1200)
      });
    };

    try {
      // 1. Direct musicQueueRenderer.content.playlistPanelRenderer
      const playlist =
        data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer;
      const contents = playlist?.contents || [];

      for (const item of contents) {
        if (item?.playlistPanelVideoRenderer) {
          addRenderer(item.playlistPanelVideoRenderer);
        } else if (item?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer) {
          addRenderer(item.playlistPanelVideoWrapperRenderer.primaryRenderer.playlistPanelVideoRenderer);
        }
      }

      // 2. If empty, scan entire object recursively for any playlistPanelVideoRenderer
      if (tracks.length === 0) {
        const scan = (node: any) => {
          if (!node || typeof node !== 'object') return;
          if (node.playlistPanelVideoRenderer) {
            addRenderer(node.playlistPanelVideoRenderer);
          }
          if (Array.isArray(node)) {
            for (const el of node) scan(el);
          } else {
            for (const v of Object.values(node)) scan(v);
          }
        };
        scan(data);
      }
    } catch (err) {
      console.warn('[OurTube Innertube] Error parsing watch next radio:', err);
    }

    return tracks;
  }

  /**
   * Fetches plain lyrics from YouTube Music's watch next lyrics tab if available
   */
  public async getSongLyrics(videoId: string): Promise<string | null> {
    if (!videoId) return null;
    try {
      const data = await this.fetchInnerTubeEndpoint('next', { videoId });
      const json = this.ensureJsonObject(data);
      const tabs =
        json?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs;
      const lyricsTab = tabs?.[1]?.tabRenderer;
      const browseId = lyricsTab?.endpoint?.browseEndpoint?.browseId;
      if (!browseId) return null;

      const browseData = await this.fetchInnerTubeEndpoint('browse', { browseId });
      const browseJson = this.ensureJsonObject(browseData);
      const shelf =
        browseJson?.contents?.sectionListRenderer?.contents?.[0]?.musicDescriptionShelfRenderer;
      const desc = this.getNodeText(shelf?.description);
      return desc || null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches personalized YouTube Music home feed recommendations for the active account
   */
  public async getHomeFeed(): Promise<HomeSection[]> {
    const data = await this.fetchInnerTubeEndpoint('browse', {
      browseId: 'FEmusic_home'
    });

    if (data) {
      const sections = this.parseHomeSections(data);
      if (sections.length > 0) return sections;
    }

    return [];
  }

  /**
   * Fetches personalized YouTube Video Home feed (FEwhat_to_watch) matching Koda VideoHomeContent
   * Supports topic filter chips (params) and returns both videos and chips.
   */
  public async getVideoHomeFeed(params?: string): Promise<VideoFeedResult> {
    const bodyPayload: any = {
      browseId: 'FEwhat_to_watch'
    };

    if (params) {
      bodyPayload.params = params;
    }

    let data = await this.fetchDesktopYouTubeEndpoint('browse', bodyPayload);

    let videos = data ? this.parseVideoItemsFromBrowse(data) : [];
    const chips = data ? this.parseChipsFromBrowse(data) : [];

    // 2. Fallback: If account has empty watch history (e.g. secondary account), fetch official YouTube Trending feed
    if (videos.length < 8 && !params) {
      try {
        const trendingData = await this.fetchDesktopYouTubeEndpoint('browse', {
          browseId: 'FEtrending'
        });
        if (trendingData) {
          const trendingVideos = this.parseVideoItemsFromBrowse(trendingData);
          if (trendingVideos.length > 0) {
            const existingIds = new Set(videos.map((v) => v.id));
            for (const tv of trendingVideos) {
              if (!existingIds.has(tv.id)) {
                existingIds.add(tv.id);
                videos.push(tv);
              }
            }
          }
        }
      } catch (trendingErr) {
        console.warn('[InnertubeService] Trending fallback error:', trendingErr);
      }
    }

    // 3. Fallback: If still fewer than 8 videos, scrape YouTube homepage initial data
    if (videos.length < 8 && !params && bridgeClient.getIsAvailable()) {
      try {
        const scrapedData = await bridgeClient.scrapeYouTubePage('https://www.youtube.com/');
        if (scrapedData) {
          const scrapedVideos = this.parseVideoItemsFromBrowse(scrapedData);
          if (scrapedVideos.length > 0) {
            const existingIds = new Set(videos.map((v) => v.id));
            for (const sv of scrapedVideos) {
              if (!existingIds.has(sv.id)) {
                existingIds.add(sv.id);
                videos.push(sv);
              }
            }
          }
        }
      } catch (scrapeErr) {
        console.warn('[InnertubeService] Scrape home fallback error:', scrapeErr);
      }
    }

    // 4. Guarantee feed density: If still fewer than 8 videos, supplement with diverse multi-topic recommendations
    if (videos.length < 8) {
      try {
        const fallbackVideos = await this.getDiverseFallbackVideos(params);
        const existingIds = new Set(videos.map((v) => v.id));
        for (const fv of fallbackVideos) {
          if (!existingIds.has(fv.id)) {
            existingIds.add(fv.id);
            videos.push(fv);
          }
        }
      } catch {
        // keep whatever videos we have
      }
    }

    const continuationToken = data ? this.extractContinuationToken(data) : undefined;

    return {
      videos,
      chips: chips.length > 0 ? chips : this.getDefaultTopicChips(),
      continuationToken
    };
  }

  /**
   * Fetches the next page of videos using YouTube continuation token (Infinite Scroll)
   */
  public async getVideoContinuation(token: string): Promise<{ videos: VideoItem[]; continuationToken?: string }> {
    if (!token) return { videos: [] };

    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const bodyPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/'
        }
      },
      continuation: token
    };

    if (activePageId) {
      bodyPayload.context.user = { onBehalfOfUser: activePageId };
    }

    let data: any = null;
    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          body: bodyPayload
        });
        if (response?.data && !response.data?.error) {
          data = response.data;
        }
      } catch (err) {
        console.warn('[InnertubeService] Video continuation bridge fetch failed:', err);
      }
    }

    if (!data) {
      try {
        const directRes = await window.fetch(
          `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20251006.00.00',
              'X-Goog-AuthUser': activeAuthUser
            },
            body: JSON.stringify(bodyPayload),
            credentials: 'include'
          }
        ).catch(() => null);

        if (directRes && directRes.ok) {
          data = await directRes.json();
        }
      } catch (err) {
        console.warn('[InnertubeService] Video continuation direct fetch failed:', err);
      }
    }

    if (!data) return { videos: [] };

    const videos = this.parseVideoItemsFromBrowse(data);
    const nextToken = this.extractContinuationToken(data);

    return {
      videos,
      continuationToken: nextToken
    };
  }

  /**
   * Search YouTube Videos, Channels, and Playlists (Video Mode Search)
   * Supports categories (all, videos, channels, playlists), sort orders, and upload date filters.
   */
  public async searchVideos(
    query: string,
    options?: {
      category?: VideoSearchCategory;
      sort?: VideoSearchSort;
      dateFilter?: VideoSearchDateFilter;
    }
  ): Promise<VideoSearchResult> {
    if (!query.trim()) {
      return { videos: [], channels: [], playlists: [] };
    }

    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const category = options?.category || 'all';
    const sort = options?.sort || 'relevance';
    const dateFilter = options?.dateFilter || 'any';

    // 1. Calculate effective query with date filter operator
    let effectiveQuery = query.trim();
    if (dateFilter !== 'any') {
      const daysMap: Record<VideoSearchDateFilter, number | null> = {
        any: null,
        today: 1, // Koda verified: today is after: yesterday
        week: 7,
        month: 31,
        year: 366
      };
      const days = daysMap[dateFilter];
      if (days) {
        const d = new Date(Date.now() - days * 86400000);
        const dateStr = d.toISOString().split('T')[0];
        effectiveQuery = `${effectiveQuery} after:${dateStr}`;
      }
    }

    // 2. Map params based on category and sort
    let params: string | undefined;
    if (category === 'channels') {
      params = 'EgIQAg%3D%3D';
    } else if (category === 'playlists') {
      params = 'EgIQAw%3D%3D';
    } else if (category === 'videos') {
      if (sort === 'newest') params = 'CAISAhAB';
      else if (sort === 'views') params = 'CAMSAhAB';
      else if (sort === 'rating') params = 'CAESAhAB';
      else params = 'EgIQAQ%3D%3D';
    } else {
      // category === 'all'
      if (sort === 'newest') params = 'CAISAhAB';
      else if (sort === 'views') params = 'CAMSAhAB';
      else if (sort === 'rating') params = 'CAESAhAB';
      else params = undefined;
    }

    const bodyPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/'
        }
      },
      query: effectiveQuery
    };

    if (params) {
      bodyPayload.params = params;
    }

    if (activePageId) {
      bodyPayload.context.user = { onBehalfOfUser: activePageId };
    }

    let data: any = null;

    // 1. Try extension bridge with www.youtube.com
    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/search?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          body: bodyPayload
        });
        if (response?.data && !response.data?.error) {
          data = response.data;
        }
      } catch (bridgeErr) {
        console.warn('[InnertubeService] Video search bridge fetch failed:', bridgeErr);
      }
    }

    // 2. Direct browser fetch
    if (!data) {
      try {
        let directRes = await window.fetch(
          `https://www.youtube.com/youtubei/v1/search?prettyPrint=false&authuser=${activeAuthUser}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20251006.00.00',
              'X-Goog-AuthUser': activeAuthUser
            },
            body: JSON.stringify(bodyPayload),
            credentials: 'include'
          }
        ).catch(() => null);

        if (!directRes || !directRes.ok) {
          directRes = await window.fetch(
            `https://www.youtube.com/youtubei/v1/search?prettyPrint=false&authuser=${activeAuthUser}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-YouTube-Client-Name': '1',
                'X-YouTube-Client-Version': '2.20251006.00.00'
              },
              body: JSON.stringify(bodyPayload),
              credentials: 'omit'
            }
          ).catch(() => null);
        }

        if (directRes && directRes.ok) {
          data = await directRes.json();
        }
      } catch (directErr) {
        console.warn('[InnertubeService] Video search direct fetch failed:', directErr);
      }
    }

    if (!data) {
      return { videos: [], channels: [], playlists: [] };
    }

    return this.parseVideoSearchResults(data, category);
  }

  /**
   * Fetches the next page of video search results using continuation token
   */
  public async getVideoSearchContinuation(
    token: string,
    category: VideoSearchCategory = 'all'
  ): Promise<VideoSearchResult> {
    if (!token) {
      return { videos: [], channels: [], playlists: [] };
    }

    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const bodyPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/'
        }
      },
      continuation: token
    };

    if (activePageId) {
      bodyPayload.context.user = { onBehalfOfUser: activePageId };
    }

    let data: any = null;
    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/search?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          body: bodyPayload
        });
        if (response?.data && !response.data?.error) {
          data = response.data;
        }
      } catch (err) {
        console.warn('[InnertubeService] Video search continuation bridge fetch failed:', err);
      }
    }

    if (!data) {
      try {
        const directRes = await window.fetch(
          `https://www.youtube.com/youtubei/v1/search?prettyPrint=false&authuser=${activeAuthUser}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20251006.00.00',
              'X-Goog-AuthUser': activeAuthUser
            },
            body: JSON.stringify(bodyPayload),
            credentials: 'include'
          }
        ).catch(() => null);

        if (directRes && directRes.ok) {
          data = await directRes.json();
        }
      } catch (err) {
        console.warn('[InnertubeService] Video search continuation direct fetch failed:', err);
      }
    }

    if (!data) {
      return { videos: [], channels: [], playlists: [] };
    }

    return this.parseVideoSearchResults(data, category);
  }

  /**
   * Comprehensive parser for YouTube Video Search results
   */
  public parseVideoSearchResults(
    raw: any,
    category: VideoSearchCategory = 'all'
  ): VideoSearchResult {
    const json = this.ensureJsonObject(raw);
    if (!json) {
      return { videos: [], channels: [], playlists: [] };
    }

    const videos: VideoItem[] = (category === 'channels' || category === 'playlists')
      ? []
      : this.parseVideoItemsFromBrowse(json);

    const channels: SubscribedChannel[] = [];
    const seenChannelIds = new Set<string>();

    const playlists: VideoPlaylist[] = [];
    const seenPlaylistIds = new Set<string>();

    const scan = (node: any) => {
      if (!node || typeof node !== 'object') return;

      // Parse Channel Renderers
      if (node.channelRenderer) {
        const cr = node.channelRenderer;
        const channelId = cr.channelId || cr.navigationEndpoint?.browseEndpoint?.browseId;
        if (channelId && channelId.startsWith('UC') && !seenChannelIds.has(channelId)) {
          const name = this.getNodeText(cr.title);
          if (name) {
            seenChannelIds.add(channelId);
            const thumbs: any[] = cr.thumbnail?.thumbnails || [];
            const avatarUrl = thumbs.slice(-1)[0]?.url;
            channels.push({
              id: channelId,
              name,
              avatarUrl,
              hasNewVideos: false
            });
          }
        }
      }

      // Parse Playlist Renderers
      if (node.playlistRenderer) {
        const pr = node.playlistRenderer;
        const playlistId = pr.playlistId || pr.navigationEndpoint?.watchEndpoint?.playlistId;
        if (playlistId && !seenPlaylistIds.has(playlistId)) {
          const title = this.getNodeText(pr.title);
          if (title) {
            seenPlaylistIds.add(playlistId);
            const thumbs: any[] =
              pr.thumbnail?.thumbnails ||
              pr.thumbnails?.[0]?.thumbnails ||
              pr.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails ||
              pr.thumbnailRenderer?.playlistCustomThumbnailRenderer?.thumbnail?.thumbnails ||
              pr.sidebarThumbnails?.[0]?.thumbnails ||
              [];
            const thumbnailUrl = thumbs.slice(-1)[0]?.url;
            const videoCountText = this.getNodeText(pr.videoCountText || pr.thumbnailText);
            const channelName = this.getNodeText(pr.shortBylineText || pr.longBylineText);
            playlists.push({
              id: playlistId,
              title,
              thumbnailUrl,
              videoCountText: videoCountText || undefined,
              channelName: channelName || undefined
            });
          }
        }
      }

      // Parse LockupViewModel for Playlist / Podcast
      if (node.lockupViewModel) {
        const lockup = node.lockupViewModel;
        const contentType = lockup.contentType;
        if (contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST' || contentType === 'LOCKUP_CONTENT_TYPE_PODCAST') {
          const playlistId = lockup.contentId;
          if (playlistId && !seenPlaylistIds.has(playlistId)) {
            const metadata = lockup.metadata?.lockupMetadataViewModel;
            const title = metadata?.title?.content;
            if (title) {
              seenPlaylistIds.add(playlistId);
              const thumb = lockup.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources?.slice(-1)[0]?.url;
              const channelName = metadata?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content?.replace(/\s*•\s*Playlist/i, '');
              playlists.push({
                id: playlistId,
                title,
                thumbnailUrl: thumb,
                videoCountText: undefined,
                channelName: channelName || undefined
              });
            }
          }
        }
      }

      if (Array.isArray(node)) {
        for (const item of node) scan(item);
      } else {
        for (const key of Object.keys(node)) {
          if (typeof node[key] === 'object') scan(node[key]);
        }
      }
    };

    scan(json);

    const continuationToken = this.extractContinuationToken(json);

    return {
      videos,
      channels,
      playlists,
      continuationToken
    };
  }

  /**
   * Fetches personalized YouTube Subscriptions feed (FEsubscriptions)
   */
  public async getVideoSubscriptionsFeed(): Promise<VideoItem[]> {
    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const bodyPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/'
        }
      },
      browseId: 'FEsubscriptions'
    };

    if (activePageId) {
      bodyPayload.context.user = { onBehalfOfUser: activePageId };
    }

    let data: any = null;

    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          body: bodyPayload
        });
        if (response?.data && !response.data?.error) {
          data = response.data;
        }
      } catch (bridgeErr) {
        console.warn('[InnertubeService] Subscriptions feed bridge fetch failed:', bridgeErr);
      }
    }

    if (!data) {
      try {
        let directRes = await window.fetch(
          `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20251006.00.00',
              'X-Goog-AuthUser': activeAuthUser
            },
            body: JSON.stringify(bodyPayload),
            credentials: 'include'
          }
        ).catch(() => null);

        if (!directRes || !directRes.ok) {
          directRes = await window.fetch(
            `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-YouTube-Client-Name': '1',
                'X-YouTube-Client-Version': '2.20251006.00.00'
              },
              body: JSON.stringify(bodyPayload),
              credentials: 'omit'
            }
          ).catch(() => null);
        }

        if (directRes && directRes.ok) {
          data = await directRes.json();
        }
      } catch (directErr) {
        console.warn('[InnertubeService] Subscriptions direct fetch failed:', directErr);
      }
    }

    let videos = data ? this.parseVideoItemsFromBrowse(data) : [];

    // Fallback: If no subscriptions videos parsed, scrape subscriptions page
    if (videos.length === 0 && bridgeClient.getIsAvailable()) {
      try {
        const scrapedData = await bridgeClient.scrapeYouTubePage('https://www.youtube.com/feed/subscriptions');
        if (scrapedData) {
          videos = this.parseVideoItemsFromBrowse(scrapedData);
        }
      } catch (scrapeErr) {
        console.warn('[InnertubeService] Scrape subscriptions fallback error:', scrapeErr);
      }
    }

    return videos;
  }

  /**
   * Complete Subscriptions Feed: returns videos, subscribed channels list, and continuation token
   */
  public async getSubscriptionsFeed(): Promise<SubscriptionsFeedResult> {
    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const bodyPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/'
        }
      },
      browseId: 'FEsubscriptions'
    };

    if (activePageId) {
      bodyPayload.context.user = { onBehalfOfUser: activePageId };
    }

    let data: any = null;

    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          body: bodyPayload
        });
        if (response?.data && !response.data?.error) {
          data = response.data;
        }
      } catch (bridgeErr) {
        console.warn('[InnertubeService] Subscriptions feed bridge fetch failed:', bridgeErr);
      }
    }

    if (!data) {
      try {
        let directRes = await window.fetch(
          `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20251006.00.00',
              'X-Goog-AuthUser': activeAuthUser
            },
            body: JSON.stringify(bodyPayload),
            credentials: 'include'
          }
        ).catch(() => null);

        if (!directRes || !directRes.ok) {
          directRes = await window.fetch(
            `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-YouTube-Client-Name': '1',
                'X-YouTube-Client-Version': '2.20251006.00.00'
              },
              body: JSON.stringify(bodyPayload),
              credentials: 'omit'
            }
          ).catch(() => null);
        }

        if (directRes && directRes.ok) {
          data = await directRes.json();
        }
      } catch (directErr) {
        console.warn('[InnertubeService] Subscriptions direct fetch failed:', directErr);
      }
    }

    let videos = data ? this.parseVideoItemsFromBrowse(data) : [];

    // Fallback: If no subscriptions videos parsed, scrape subscriptions page
    if (videos.length === 0 && bridgeClient.getIsAvailable()) {
      try {
        const scrapedData = await bridgeClient.scrapeYouTubePage('https://www.youtube.com/feed/subscriptions');
        if (scrapedData) {
          videos = this.parseVideoItemsFromBrowse(scrapedData);
          if (!data) data = scrapedData;
        }
      } catch (scrapeErr) {
        console.warn('[InnertubeService] Scrape subscriptions fallback error:', scrapeErr);
      }
    }

    // Extract channels from both raw response and parsed videos
    const channelsMap = new Map<string, SubscribedChannel>();

    if (data) {
      const scanChannels = (node: any) => {
        if (!node || typeof node !== 'object') return;
        if (node.channelRenderer) {
          const cr = node.channelRenderer;
          const chId = cr.channelId;
          const chName = this.getNodeText(cr.title);
          const thumb = cr.thumbnail?.thumbnails?.slice(-1)[0]?.url;
          if (chId && chName && !channelsMap.has(chId)) {
            channelsMap.set(chId, {
              id: chId,
              name: chName,
              avatarUrl: thumb,
              hasNewVideos: true
            });
          }
        }
        if (Array.isArray(node)) {
          for (const item of node) scanChannels(item);
        } else {
          for (const k of Object.keys(node)) scanChannels(node[k]);
        }
      };
      scanChannels(data);
    }

    // Also populate channels from videos so all active creators appear
    for (const v of videos) {
      const key = v.channelId || v.channelName;
      if (!channelsMap.has(key)) {
        channelsMap.set(key, {
          id: v.channelId || `ch_${v.channelName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: v.channelName,
          avatarUrl: v.channelIconUrl,
          hasNewVideos: true
        });
      }
    }

    const continuationToken = data ? this.extractContinuationToken(data) : undefined;

    return {
      videos,
      channels: Array.from(channelsMap.values()),
      continuationToken
    };
  }

  /**
   * Fetches authentic YouTube Watch Next metadata (/youtubei/v1/next)
   * Returns creator subscriber count, real like count, description, comments summary, and recommendations
   */
  public async getVideoWatchDetails(videoId: string): Promise<VideoWatchDetails> {
    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const bodyPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/'
        }
      },
      videoId
    };

    if (activePageId) {
      bodyPayload.context.user = { onBehalfOfUser: activePageId };
    }

    let data: any = null;

    // 1. Extension bridge fetch to /youtubei/v1/next
    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/next?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          body: bodyPayload
        });
        if (response?.data && !response.data?.error) {
          data = response.data;
        }
      } catch (err) {
        console.warn('[InnertubeService] Watch details bridge fetch failed:', err);
      }
    }

    // 2. Direct fetch with declarativeNetRequest rules
    if (!data) {
      try {
        const directRes = await window.fetch(
          `https://www.youtube.com/youtubei/v1/next?prettyPrint=false&authuser=${activeAuthUser}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20251006.00.00',
              'X-Goog-AuthUser': activeAuthUser
            },
            body: JSON.stringify(bodyPayload),
            credentials: 'include'
          }
        ).catch(() => null);

        if (directRes && directRes.ok) {
          data = await directRes.json();
        }
      } catch (directErr) {
        console.warn('[InnertubeService] Watch details direct fetch failed:', directErr);
      }
    }

    // Parse data if available
    if (data) {
      const details = this.parseWatchDetailsFromNext(videoId, data);

      // If description or subscriber count were omitted in next, enrich from yt.getInfo
      if (!details.description || details.description.trim().length < 10 || !details.channel.subscriberCount || !details.likeCount) {
        try {
          const yt = await getWebInnertube();
          const info = await yt.getInfo(videoId);
          if (!details.description || details.description.trim().length < 10) {
            details.description =
              info.basic_info?.short_description ||
              (info.secondary_info as any)?.description?.text ||
              (info.secondary_info as any)?.attributed_description?.content ||
              '';
          }
          if (!details.channel.subscriberCount && (info.secondary_info as any)?.owner?.subscriber_count?.text) {
            details.channel.subscriberCount = (info.secondary_info as any).owner.subscriber_count.text;
          }
          if (!details.likeCount && (info.primary_info as any)?.menu?.top_level_buttons?.[0]?.text?.text) {
            details.likeCount = (info.primary_info as any).menu.top_level_buttons[0].text.text;
          }
        } catch (enrichErr) {
          console.warn('[InnertubeService] Failed to enrich watch details with getInfo:', enrichErr);
        }
      }

      return details;
    }

    // 3. Fallback: Query yt.getInfo(videoId) from client-side Innertube
    try {
      const yt = await getWebInnertube();
      const info = await yt.getInfo(videoId);
      return this.parseWatchDetailsFromInfo(videoId, info);
    } catch (infoErr) {
      console.warn('[InnertubeService] Fallback getInfo watch details error:', infoErr);
    }

    // Default minimal fallback
    return {
      videoId,
      title: 'YouTube Video',
      description: '',
      viewCount: '',
      channel: { name: 'YouTube Creator' },
      relatedVideos: []
    };
  }

  private parseWatchDetailsFromNext(videoId: string, data: any): VideoWatchDetails {
    let title = '';
    let description = '';
    let viewCount = '';
    let likeCount: string | undefined;
    let publishedDate: string | undefined;
    let channelName = '';
    let channelId: string | undefined;
    let channelAvatarUrl: string | undefined;
    let subscriberCount: string | undefined;
    let isVerified = false;

    let commentCountText: string | undefined;
    let topComment: { authorName?: string; authorAvatarUrl?: string; text?: string } | undefined;

    const scan = (node: any) => {
      if (!node || typeof node !== 'object') return;

      // Primary Info: Title, views, date
      if (node.videoPrimaryInfoRenderer) {
        const pi = node.videoPrimaryInfoRenderer;
        if (!title) title = this.getNodeText(pi.title);
        if (!viewCount) viewCount = this.getNodeText(pi.viewCount);
        if (!publishedDate) publishedDate = this.getNodeText(pi.dateText) || this.getNodeText(pi.relativeDate);
      }

      // Secondary Info: Channel, subscribers, description
      if (node.videoSecondaryInfoRenderer) {
        const si = node.videoSecondaryInfoRenderer;
        if (!description) {
          if (si.attributedDescription?.content) {
            description = si.attributedDescription.content;
          } else if (Array.isArray(si.description?.runs)) {
            description = si.description.runs.map((r: any) => r.text || '').join('');
          } else if (si.description) {
            description = this.getNodeText(si.description);
          }
        }

        const owner = si.owner?.videoOwnerRenderer;
        if (owner) {
          if (!channelName) channelName = this.getNodeText(owner.title);
          if (!channelId) channelId = owner.navigationEndpoint?.browseEndpoint?.browseId;
          if (!channelAvatarUrl) channelAvatarUrl = owner.thumbnail?.thumbnails?.slice(-1)[0]?.url;
          if (!subscriberCount) subscriberCount = this.getNodeText(owner.subscriberCountText);
          if (Array.isArray(owner.badges)) {
            isVerified = owner.badges.some((b: any) =>
              b.metadataBadgeRenderer?.style?.includes('VERIFIED') ||
              b.metadataBadgeRenderer?.icon?.iconType?.includes('CHECK')
            );
          }
        }
      }

      // Modern Attributed Description & Expandable Description
      if (!description || description.trim().length < 15) {
        if (node.attributedDescription?.content && node.attributedDescription.content.length > 5) {
          description = node.attributedDescription.content;
        } else if (node.expandableVideoDescriptionBodyRenderer) {
          const ev = node.expandableVideoDescriptionBodyRenderer;
          const candidate =
            ev.attributedDescription?.content ||
            this.getNodeText(ev.descriptionBodyText) ||
            (Array.isArray(ev.descriptionBodyText?.runs) ? ev.descriptionBodyText.runs.map((r: any) => r.text || '').join('') : '');
          if (candidate && candidate.trim().length > 5 && !['more', 'show more', '...more'].includes(candidate.trim().toLowerCase())) {
            description = candidate;
          }
        } else if (node.videoDescriptionHeaderRenderer?.description) {
          const candidate = this.getNodeText(node.videoDescriptionHeaderRenderer.description);
          if (candidate && candidate.trim().length > 5 && !['more', 'show more', '...more'].includes(candidate.trim().toLowerCase())) {
            description = candidate;
          }
        } else if (node.descriptionBodyText) {
          const candidate = this.getNodeText(node.descriptionBodyText);
          if (candidate && candidate.trim().length > 5 && !['more', 'show more', '...more'].includes(candidate.trim().toLowerCase())) {
            description = candidate;
          }
        }
      }

      // Segmented Like button
      if (node.segmentedLikeDislikeButtonRenderer?.likeButton) {
        const lb = node.segmentedLikeDislikeButtonRenderer.likeButton.toggleButtonRenderer;
        const text = this.getNodeText(lb?.defaultText);
        if (text && !likeCount) likeCount = text;
      }
      if (node.segmentedLikeDislikeButtonViewModel?.likeButtonViewModel) {
        const vm = node.segmentedLikeDislikeButtonViewModel.likeButtonViewModel;
        const btn = vm.likeButtonViewModel?.toggleButtonViewModel?.toggleButtonViewModel?.defaultButtonViewModel?.buttonViewModel;
        if (btn?.title && !likeCount) likeCount = btn.title;
      }

      // Comments Entry Point
      if (node.commentsEntryPointHeaderRenderer) {
        const ch = node.commentsEntryPointHeaderRenderer;
        if (!commentCountText) commentCountText = this.getNodeText(ch.commentCount) || this.getNodeText(ch.headerText);
        if (ch.teaserContent && !topComment) {
          topComment = {
            authorName: this.getNodeText(ch.teaserAvatar?.accessibility?.accessibilityData?.label) || 'Top comment',
            authorAvatarUrl: ch.teaserAvatar?.thumbnails?.[0]?.url,
            text: this.getNodeText(ch.teaserContent)
          };
        }
      }

      if (Array.isArray(node)) {
        for (const el of node) scan(el);
      } else {
        for (const key of Object.keys(node)) {
          if (typeof node[key] === 'object') scan(node[key]);
        }
      }
    };

    scan(data);

    // Extract authentic recommendations using parseVideoItemsFromBrowse
    const relatedVideos = this.parseVideoItemsFromBrowse(data).filter((v) => v.id !== videoId);

    return {
      videoId,
      title: title || 'YouTube Video',
      description,
      viewCount,
      likeCount,
      publishedDate,
      channel: {
        id: channelId,
        name: channelName || 'YouTube Creator',
        avatarUrl: channelAvatarUrl,
        subscriberCount,
        isVerified
      },
      comments: {
        countText: commentCountText,
        topComment
      },
      relatedVideos
    };
  }

  private parseWatchDetailsFromInfo(videoId: string, info: any): VideoWatchDetails {
    const pi = info.primary_info;
    const si = info.secondary_info;
    const owner = si?.owner;
    const commentsHeader = info.comments_entry_point_header;
    const basicInfo = info.basic_info;

    const description =
      basicInfo?.short_description ||
      si?.description?.text ||
      (si as any)?.attributed_description?.content ||
      '';

    const relatedVideos: VideoItem[] = [];
    if (Array.isArray(info.watch_next_feed)) {
      for (const item of info.watch_next_feed) {
        if (item.id && item.title?.text) {
          relatedVideos.push({
            id: item.id,
            title: item.title.text,
            channelName: item.author?.name || 'YouTube Creator',
            channelId: item.author?.id,
            channelIconUrl: item.author?.thumbnails?.[0]?.url,
            thumbnailUrl: item.thumbnails?.slice(-1)[0]?.url || '',
            duration: item.duration?.seconds || 180,
            durationFormatted: item.duration?.text || '3:00',
            viewCount: item.short_view_count?.text || item.view_count?.text || 'Views',
            uploadedDate: item.published?.text
          });
        }
      }
    }

    return {
      videoId,
      title: pi?.title?.text || basicInfo?.title || 'YouTube Video',
      description,
      viewCount: pi?.view_count?.text || basicInfo?.view_count?.toString() || '',
      likeCount: pi?.menu?.top_level_buttons?.[0]?.text?.text,
      publishedDate: pi?.relative_date?.text || pi?.published?.text,
      channel: {
        id: owner?.author?.id,
        name: owner?.author?.name || 'YouTube Creator',
        avatarUrl: owner?.author?.thumbnails?.[0]?.url,
        subscriberCount: owner?.subscriber_count?.text,
        isVerified: owner?.author?.is_verified
      },
      comments: {
        countText: commentsHeader?.comment_count?.text || commentsHeader?.header?.text,
        topComment: commentsHeader?.teaser_content ? {
          text: commentsHeader.teaser_content.text,
          authorAvatarUrl: commentsHeader.teaser_avatar?.[0]?.url
        } : undefined
      },
      relatedVideos
    };
  }

  /**
   * Fetches actual interactive comment list for the video
   */
  public async getVideoComments(videoId: string): Promise<VideoCommentItem[]> {
    try {
      const yt = await getWebInnertube();
      const commentsData: any = await yt.getComments(videoId);
      const comments: VideoCommentItem[] = [];

      if (Array.isArray(commentsData?.contents)) {
        for (const threadItem of commentsData.contents) {
          const thread = threadItem as any;
          const c = (thread?.comment || thread) as any;
          if (c) {
            const author = c.author || {};
            const thumbs = author.thumbnails || c.thumbnails || [];
            const avatarUrl = thumbs.slice(-1)[0]?.url || thumbs[0]?.url;

            const publishedText =
              c.published?.text ||
              c.published_time?.text ||
              (typeof c.published_time === 'string' ? c.published_time : '') ||
              '';

            const votes =
              c.vote_count?.text ||
              c.like_count ||
              (typeof c.vote_count === 'string' ? c.vote_count : undefined);

            comments.push({
              id: c.comment_id || c.id || String(Math.random()),
              authorName: author.name || c.author_name || 'User',
              authorAvatarUrl: avatarUrl,
              authorChannelId: author.id || c.channel_id,
              text: c.content?.text || (typeof c.content === 'string' ? c.content : ''),
              publishedTime: publishedText,
              likeCount: votes,
              replyCount: typeof thread?.reply_count === 'number' ? thread.reply_count : undefined
            });
          }
        }
      }

      return comments;
    } catch (err) {
      console.warn('[InnertubeService] Error fetching video comments:', err);
      return [];
    }
  }

  /**
   * Fetches authentic YouTube Video Watch History (FEhistory)
   */
  public async getVideoHistory(): Promise<VideoItem[]> {
    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const bodyPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/'
        }
      },
      browseId: 'FEhistory'
    };

    if (activePageId) {
      bodyPayload.context.user = { onBehalfOfUser: activePageId };
    }

    let data: any = null;
    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          body: bodyPayload
        });
        if (response?.data && !response.data?.error) {
          data = response.data;
        }
      } catch (err) {
        console.warn('[InnertubeService] Video history bridge fetch failed:', err);
      }
    }

    if (!data) {
      try {
        const directRes = await window.fetch(
          `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20251006.00.00',
              'X-Goog-AuthUser': activeAuthUser
            },
            body: JSON.stringify(bodyPayload),
            credentials: 'include'
          }
        ).catch(() => null);

        if (directRes && directRes.ok) {
          data = await directRes.json();
        }
      } catch (directErr) {
        console.warn('[InnertubeService] Video history direct fetch failed:', directErr);
      }
    }

    let videos = data ? this.parseVideoItemsFromBrowse(data) : [];

    // Fallback: If no history items found via API, scrape YouTube feed history
    if (videos.length === 0 && bridgeClient.getIsAvailable()) {
      try {
        const scrapedData = await bridgeClient.scrapeYouTubePage('https://www.youtube.com/feed/history');
        if (scrapedData) {
          videos = this.parseVideoItemsFromBrowse(scrapedData);
        }
      } catch (scrapeErr) {
        console.warn('[InnertubeService] Scrape history fallback error:', scrapeErr);
      }
    }

    return videos;
  }

  /**
   * Fetches authentic YouTube Watch Later playlist (VLWL)
   */
  public async getVideoWatchLater(): Promise<VideoItem[]> {
    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const bodyPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/'
        }
      },
      browseId: 'VLWL'
    };

    if (activePageId) {
      bodyPayload.context.user = { onBehalfOfUser: activePageId };
    }

    let data: any = null;
    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          body: bodyPayload
        });
        if (response?.data && !response.data?.error) {
          data = response.data;
        }
      } catch (err) {
        console.warn('[InnertubeService] Watch later bridge fetch failed:', err);
      }
    }

    if (!data) {
      try {
        const directRes = await window.fetch(
          `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20251006.00.00',
              'X-Goog-AuthUser': activeAuthUser
            },
            body: JSON.stringify(bodyPayload),
            credentials: 'include'
          }
        ).catch(() => null);

        if (directRes && directRes.ok) {
          data = await directRes.json();
        }
      } catch {}
    }

    let videos = data ? this.parseVideoItemsFromBrowse(data) : [];
    if (videos.length === 0 && bridgeClient.getIsAvailable()) {
      try {
        const scraped = await bridgeClient.scrapeYouTubePage('https://www.youtube.com/playlist?list=WL');
        if (scraped) {
          videos = this.parseVideoItemsFromBrowse(scraped);
        }
      } catch {}
    }

    return videos;
  }

  /**
   * Fetches authentic YouTube Liked Videos playlist (VLLM / VLLL)
   */
  public async getVideoLikedVideos(): Promise<VideoItem[]> {
    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const bodyPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/'
        }
      },
      browseId: 'VLLM'
    };

    if (activePageId) {
      bodyPayload.context.user = { onBehalfOfUser: activePageId };
    }

    let data: any = null;
    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          body: bodyPayload
        });
        if (response?.data && !response.data?.error) {
          data = response.data;
        }
      } catch (err) {
        console.warn('[InnertubeService] Liked videos bridge fetch failed:', err);
      }
    }

    if (!data) {
      try {
        const directRes = await window.fetch(
          `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20251006.00.00',
              'X-Goog-AuthUser': activeAuthUser
            },
            body: JSON.stringify(bodyPayload),
            credentials: 'include'
          }
        ).catch(() => null);

        if (directRes && directRes.ok) {
          data = await directRes.json();
        }
      } catch {}
    }

    let videos = data ? this.parseVideoItemsFromBrowse(data) : [];
    if (videos.length === 0 && bridgeClient.getIsAvailable()) {
      try {
        const scraped = await bridgeClient.scrapeYouTubePage('https://www.youtube.com/playlist?list=LL');
        if (scraped) {
          videos = this.parseVideoItemsFromBrowse(scraped);
        }
      } catch {}
    }

    return videos;
  }

  /**
   * Default topic filter chips matching YouTube desktop
   */
  public getDefaultTopicChips(): TopicChip[] {
    return [
      { id: 'all', title: 'All' },
      { id: 'podcasts', title: 'Podcasts' },
      { id: 'marvel_comics', title: 'Marvel Comics' },
      { id: 'satire', title: 'Satire' },
      { id: 'sitcoms', title: 'Sitcoms' },
      { id: 'filmmaking', title: 'Filmmaking' },
      { id: 'music', title: 'Music' },
      { id: 'gaming', title: 'Gaming' },
      { id: 'mixes', title: 'Mixes' },
      { id: 'dramedy', title: 'Dramedy' },
      { id: 'ai', title: 'AI' },
      { id: 'live', title: 'Live' },
      { id: 'thrillers', title: 'Thrillers' },
      { id: 'gadgets', title: 'Gadgets' }
    ];
  }

  /**
   * Parses topic filter chips from YouTube browse responses
   */
  private parseChipsFromBrowse(data: any): TopicChip[] {
    const json = this.ensureJsonObject(data);
    if (!json) return [];
    const chips: TopicChip[] = [];
    const seenTitles = new Set<string>();

    const scan = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.chipCloudChipRenderer) {
        const c = node.chipCloudChipRenderer;
        const title = this.getNodeText(c.text);
        if (title && !seenTitles.has(title.toLowerCase())) {
          seenTitles.add(title.toLowerCase());
          const params =
            c.navigationEndpoint?.continuationEndpoint?.continuationCommand?.token ||
            c.navigationEndpoint?.browseEndpoint?.params ||
            c.navigationEndpoint?.searchEndpoint?.params;
          chips.push({
            id: title.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            title,
            params: params || undefined,
            continuationToken: c.navigationEndpoint?.continuationEndpoint?.continuationCommand?.token
          });
        }
      }
      if (Array.isArray(node)) {
        for (const item of node) scan(item);
      } else {
        for (const key of Object.keys(node)) {
          if (typeof node[key] === 'object') scan(node[key]);
        }
      }
    };

    scan(json);
    return chips;
  }

  /**
   * High-diversity fallback generator that fetches popular, diverse videos
   * across multiple varied categories, enforcing a max 2 videos per creator rule.
   */
  private async getDiverseFallbackVideos(searchTopic?: string): Promise<VideoItem[]> {
    const topics = searchTopic ? [searchTopic] : ['latest news', 'podcasts', 'marvel studios', 'popular science', 'music', 'technology'];
    const results: VideoItem[] = [];
    const seenIds = new Set<string>();
    const creatorCount: Record<string, number> = {};

    for (const q of topics) {
      try {
        // 1. Try Desktop YouTube Search for authentic video cards
        const searchData = await this.fetchDesktopYouTubeEndpoint('search', { query: q });
        if (searchData) {
          const parsed = this.parseVideoItemsFromBrowse(searchData);
          for (const v of parsed) {
            if (seenIds.has(v.id)) continue;
            const count = creatorCount[v.channelName] || 0;
            if (count >= 2) continue;
            seenIds.add(v.id);
            creatorCount[v.channelName] = count + 1;
            results.push(v);
            if (results.length >= 24) break;
          }
        }
      } catch {}

      if (results.length >= 24) break;

      // 2. Secondary fallback via music search
      try {
        const tracks = await this.search(q, 'all');
        for (const t of tracks) {
          if (seenIds.has(t.id)) continue;
          const creator = t.artist || 'YouTube Creator';
          const count = creatorCount[creator] || 0;
          if (count >= 2) continue;

          seenIds.add(t.id);
          creatorCount[creator] = count + 1;

          results.push({
            id: t.id,
            title: t.title,
            channelName: creator,
            channelId: t.artistId,
            thumbnailUrl: t.highResThumbnailUrl || t.thumbnailUrl,
            duration: t.duration || 240,
            durationFormatted: `${Math.floor((t.duration || 240) / 60)}:${String((t.duration || 240) % 60).padStart(2, '0')}`,
            viewCount: `${Math.floor(Math.random() * 450 + 45)}K views`,
            uploadedDate: 'Recently'
          });

          if (results.length >= 24) break;
        }
      } catch {
        // continue to next query
      }
      if (results.length >= 24) break;
    }

    return results;
  }

  /**
   * Robust parser for YouTube Video Home & Subscriptions (richGridRenderer, lockupViewModel, videoRenderer)
   */
  private parseVideoItemsFromBrowse(data: any): VideoItem[] {
    const json = this.ensureJsonObject(data);
    if (!json) return [];

    const videos: VideoItem[] = [];
    const seenIds = new Set<string>();

    const parseVideoRenderer = (vr: any) => {
      if (!vr) return;
      const videoId = vr.videoId || vr.contentId;
      if (!videoId || seenIds.has(videoId)) return;

      const title = this.getNodeText(vr.title);
      if (!title) return;

      seenIds.add(videoId);

      const channelName =
        this.getNodeText(vr.ownerText) ||
        this.getNodeText(vr.shortBylineText) ||
        this.getNodeText(vr.longBylineText) ||
        'YouTube Creator';

      let channelId: string | undefined;
      const runs = vr.ownerText?.runs || vr.shortBylineText?.runs;
      if (runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId) {
        channelId = runs[0].navigationEndpoint.browseEndpoint.browseId;
      }

      const channelThumbnails = vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails;
      let channelIconUrl = channelThumbnails?.slice(-1)[0]?.url;

      const viewCount =
        this.getNodeText(vr.viewCountText) ||
        this.getNodeText(vr.shortViewCountText) ||
        '';

      const durationText = this.getNodeText(vr.lengthText) || '';
      const durationSeconds = this.parseDurationString(durationText) || 180;

      const thumbs: any[] = vr.thumbnail?.thumbnails || [];
      const bestThumb = thumbs.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      const uploadedDate = this.getNodeText(vr.publishedTimeText) || '';

      // Check badges (e.g. Members only)
      let badge = '';
      let isMembersOnly = false;
      const badges = vr.badges || [];
      for (const b of badges) {
        const lbl = this.getNodeText(b.metadataBadgeRenderer?.label || b.badgeRenderer?.label);
        if (lbl) {
          badge = lbl;
          if (lbl.toLowerCase().includes('member')) isMembersOnly = true;
          break;
        }
      }

      // Check verified status
      let isVerified = false;
      const scanForVerified = (obj: any) => {
        if (!obj || isVerified) return;
        if (typeof obj === 'string') {
          if (obj.toLowerCase().includes('verified') || obj === 'CHECK') {
            isVerified = true;
            return;
          }
        }
        if (typeof obj === 'object') {
          if (
            obj.style === 'BADGE_STYLE_TYPE_VERIFIED' ||
            obj.badgeStyle === 'BADGE_STYLE_TYPE_VERIFIED' ||
            obj.icon?.iconType === 'CHECK'
          ) {
            isVerified = true;
            return;
          }
          if (Array.isArray(obj)) {
            for (const item of obj) scanForVerified(item);
          } else {
            for (const v of Object.values(obj)) scanForVerified(v);
          }
        }
      };
      scanForVerified(vr.ownerBadges);

      // Check resume watch progress
      let watchedPercentage: number | undefined;
      const overlays = vr.thumbnailOverlays || [];
      for (const ov of overlays) {
        if (typeof ov.thumbnailOverlayResumePlaybackRenderer?.percentDurationWatched === 'number') {
          watchedPercentage = ov.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched;
          break;
        }
      }

      videos.push({
        id: videoId,
        title: title.trim(),
        channelName,
        channelId,
        channelIconUrl,
        thumbnailUrl: bestThumb,
        duration: durationSeconds,
        durationFormatted: durationText || `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`,
        viewCount: viewCount || 'Recommended',
        uploadedDate: uploadedDate || undefined,
        badge: badge || (isMembersOnly ? 'Members only' : undefined),
        isMembersOnly,
        isVerified,
        watchedPercentage
      });
    };

    const parseLockupViewModel = (lvm: any) => {
      if (!lvm) return;

      // Extract video ID from every known path
      let videoId = lvm.contentId;
      if (!videoId) {
        videoId =
          lvm.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId ||
          lvm.onTap?.innertubeCommand?.watchEndpoint?.videoId ||
          lvm.metadata?.lockupMetadataViewModel?.title?.commandRuns?.[0]?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
      }
      if (!videoId && lvm.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url) {
        const m = lvm.onTap.innertubeCommand.commandMetadata.webCommandMetadata.url.match(/v=([a-zA-Z0-9_-]{11})/);
        if (m) videoId = m[1];
      }
      if (!videoId && lvm.contentImage?.thumbnailViewModel?.image?.sources?.[0]?.url) {
        const m = lvm.contentImage.thumbnailViewModel.image.sources[0].url.match(/vi\/([a-zA-Z0-9_-]{11})/);
        if (m) videoId = m[1];
      }

      if (!videoId || seenIds.has(videoId)) return;

      const metadata = lvm.metadata?.lockupMetadataViewModel;

      // Title extraction (supports { content: string }, string, runs, accessibility)
      let title = '';
      if (metadata?.title) {
        title = this.getNodeText(metadata.title);
      }
      if (!title && lvm.accessibilityText) {
        title = lvm.accessibilityText;
      }
      if (!title && lvm.contentImage?.thumbnailViewModel?.image?.accessibilityText) {
        title = lvm.contentImage.thumbnailViewModel.image.accessibilityText;
      }
      if (!title) return;

      seenIds.add(videoId);

      // Metadata rows: Channel name, View count, Uploaded date
      let channelName = '';
      let viewCount = '';
      let uploadedDate = '';

      const contentMeta = metadata?.metadata?.contentMetadataViewModel;
      const rows = contentMeta?.metadataRows || contentMeta?.rowItems || [];
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const parts = row.metadataParts || row.items || [];
          for (const part of parts) {
            const txt = this.getNodeText(part.text || part);
            if (!txt) continue;
            if (!channelName) {
              channelName = txt;
            } else if (!viewCount && (txt.toLowerCase().includes('view') || txt.toLowerCase().includes('watching') || /^\d+[\.,]?\d*\s*[KMB]?/i.test(txt))) {
              viewCount = txt;
            } else if (!uploadedDate && (txt.toLowerCase().includes('ago') || txt.toLowerCase().includes('stream') || txt.toLowerCase().includes('yesterday') || txt.toLowerCase().includes('hour') || txt.toLowerCase().includes('day') || txt.toLowerCase().includes('month') || txt.toLowerCase().includes('year'))) {
              uploadedDate = txt;
            } else if (!viewCount) {
              viewCount = txt;
            }
          }
        }
      }

      if (!channelName) {
        channelName = 'YouTube Creator';
      }

      // Channel Icon Avatar: deep scanner for avatar sources
      let channelIconUrl = '';
      const scanForAvatar = (obj: any) => {
        if (!obj || channelIconUrl) return;
        if (obj.sources && Array.isArray(obj.sources) && obj.sources.length > 0) {
          const url = obj.sources.slice(-1)[0]?.url || obj.sources[0]?.url;
          if (url && (url.includes('ggpht.com') || url.includes('googleusercontent') || url.includes('/ytc/'))) {
            channelIconUrl = url;
            return;
          }
        }
        if (obj.image?.sources && Array.isArray(obj.image.sources) && obj.image.sources.length > 0) {
          const url = obj.image.sources.slice(-1)[0]?.url || obj.image.sources[0]?.url;
          if (url && (url.includes('ggpht.com') || url.includes('googleusercontent') || url.includes('/ytc/'))) {
            channelIconUrl = url;
            return;
          }
        }
        if (typeof obj === 'object') {
          if (Array.isArray(obj)) {
            for (const item of obj) scanForAvatar(item);
          } else {
            for (const [k, v] of Object.entries(obj)) {
              if (k !== 'thumbnailViewModel' && k !== 'contentImage') {
                scanForAvatar(v);
              }
            }
          }
        }
      };

      scanForAvatar(metadata?.avatar);
      if (!channelIconUrl) scanForAvatar(metadata?.image);
      if (!channelIconUrl) scanForAvatar(metadata);

      // Thumbnail
      const thumbs = lvm.contentImage?.thumbnailViewModel?.image?.sources || [];
      const bestThumb = thumbs.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      // Deep duration scanner: checks overlays, timeStatus, accessibility labels
      let durationFormatted = '';
      let durationSeconds = 0;

      const scanForTime = (obj: any) => {
        if (!obj || durationFormatted) return;
        if (typeof obj === 'string') {
          const trimmed = obj.trim();
          if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
            durationFormatted = trimmed;
            durationSeconds = this.parseDurationString(durationFormatted);
            return;
          }
          const spoken = this.parseAccessibilityDuration(trimmed);
          if (spoken) {
            durationFormatted = spoken.formatted;
            durationSeconds = spoken.seconds;
            return;
          }
        }
        if (typeof obj === 'object') {
          if (obj.simpleText && /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(obj.simpleText).trim())) {
            durationFormatted = String(obj.simpleText).trim();
            durationSeconds = this.parseDurationString(durationFormatted);
            return;
          }
          if (obj.content && /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(obj.content).trim())) {
            durationFormatted = String(obj.content).trim();
            durationSeconds = this.parseDurationString(durationFormatted);
            return;
          }
          if (obj.accessibility?.accessibilityData?.label) {
            const spoken = this.parseAccessibilityDuration(String(obj.accessibility.accessibilityData.label));
            if (spoken) {
              durationFormatted = spoken.formatted;
              durationSeconds = spoken.seconds;
              return;
            }
          }
          if (Array.isArray(obj)) {
            for (const item of obj) scanForTime(item);
          } else {
            for (const v of Object.values(obj)) scanForTime(v);
          }
        }
      };

      scanForTime(lvm.contentImage?.thumbnailViewModel?.overlays);
      if (!durationFormatted) {
        scanForTime(lvm.contentImage?.thumbnailViewModel?.image?.accessibilityText);
      }
      if (!durationFormatted) {
        scanForTime(lvm.accessibilityText);
      }

      // Fallback: estimate from length if seconds was missing
      if (!durationSeconds) durationSeconds = this.parseDurationString(durationFormatted) || 240;
      if (!durationFormatted) durationFormatted = '14:53';

      // Members only & Badges check
      let isMembersOnly = false;
      let badge = '';
      const overlays = lvm.contentImage?.thumbnailViewModel?.overlays || [];
      for (const ov of overlays) {
        const badgeRenderer = ov.thumbnailOverlayBadgeRenderer;
        if (badgeRenderer) {
          const lbl = this.getNodeText(badgeRenderer.thumbnailBadges?.[0]?.metadataBadgeRenderer?.label);
          if (lbl) {
            badge = lbl;
            if (lbl.toLowerCase().includes('member')) isMembersOnly = true;
          }
        }
      }
      const topBadges = metadata?.badgeViewModels || [];
      for (const bvm of topBadges) {
        const txt = this.getNodeText(bvm.badgeViewModel?.text);
        if (txt) {
          badge = txt;
          if (txt.toLowerCase().includes('member')) isMembersOnly = true;
        }
      }

      // Check verified creator
      let isVerified = false;
      const scanForVerified = (obj: any) => {
        if (!obj || isVerified) return;
        if (typeof obj === 'string') {
          if (obj.toLowerCase().includes('verified') || obj === 'CHECK') {
            isVerified = true;
            return;
          }
        }
        if (typeof obj === 'object') {
          if (
            obj.style === 'BADGE_STYLE_TYPE_VERIFIED' ||
            obj.badgeStyle === 'BADGE_STYLE_TYPE_VERIFIED' ||
            obj.icon?.iconType === 'CHECK'
          ) {
            isVerified = true;
            return;
          }
          if (Array.isArray(obj)) {
            for (const item of obj) scanForVerified(item);
          } else {
            for (const v of Object.values(obj)) scanForVerified(v);
          }
        }
      };
      scanForVerified(metadata?.ownerBadges);
      scanForVerified(metadata?.avatar?.decoratedAvatarViewModel?.avatarBadges);

      // Check resume watch progress
      let watchedPercentage: number | undefined;
      for (const ov of overlays) {
        if (typeof ov.thumbnailOverlayResumePlaybackRenderer?.percentDurationWatched === 'number') {
          watchedPercentage = ov.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched;
          break;
        }
        if (typeof ov.thumbnailBottomOverlayViewModel?.progressBar?.percentDurationWatched === 'number') {
          watchedPercentage = ov.thumbnailBottomOverlayViewModel.progressBar.percentDurationWatched;
          break;
        }
      }

      videos.push({
        id: videoId,
        title: title.trim(),
        channelName,
        channelIconUrl: channelIconUrl || undefined,
        thumbnailUrl: bestThumb,
        duration: durationSeconds,
        durationFormatted,
        viewCount: viewCount || 'Recommended',
        uploadedDate: uploadedDate || undefined,
        badge: badge || (isMembersOnly ? 'Members only' : undefined),
        isMembersOnly,
        isVerified,
        watchedPercentage
      });
    };

    // Recursive traversal to find all videoRenderers, lockupViewModels, and richItemContainers
    const scan = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.videoRenderer) {
        parseVideoRenderer(node.videoRenderer);
      }
      if (node.lockupViewModel) {
        parseLockupViewModel(node.lockupViewModel);
      }
      if (node.gridVideoRenderer) {
        parseVideoRenderer(node.gridVideoRenderer);
      }
      if (node.compactVideoRenderer) {
        parseVideoRenderer(node.compactVideoRenderer);
      }
      if (node.playlistVideoRenderer) {
        parseVideoRenderer(node.playlistVideoRenderer);
      }
      if (Array.isArray(node)) {
        for (const item of node) scan(item);
      } else {
        for (const key of Object.keys(node)) {
          if (typeof node[key] === 'object') scan(node[key]);
        }
      }
    };

    scan(json);
    return videos;
  }

  /**
   * Fetches user's authentic personal playlists from YouTube Music (FEmusic_liked_playlists + FEmusic_library_landing)
   */
  public async getUserPlaylists(): Promise<UserPlaylist[]> {
    const playlists: UserPlaylist[] = [];
    const seen = new Set<string>();

    try {
      // 1. Fetch Liked Playlists
      const likedData = await this.fetchInnerTubeEndpoint('browse', {
        browseId: 'FEmusic_liked_playlists'
      });
      const parsedLiked = this.parseUserPlaylists(likedData);
      for (const pl of parsedLiked) {
        if (!seen.has(pl.id)) {
          seen.add(pl.id);
          playlists.push(pl);
        }
      }
    } catch (err) {
      console.warn('[Koda Innertube] Failed to fetch FEmusic_liked_playlists:', err);
    }

    // 2. Also query FEmusic_library_landing
    try {
      const libraryData = await this.fetchInnerTubeEndpoint('browse', {
        browseId: 'FEmusic_library_landing'
      });
      const parsedLib = this.parseUserPlaylists(libraryData);
      for (const pl of parsedLib) {
        if (!seen.has(pl.id)) {
          seen.add(pl.id);
          playlists.push(pl);
        }
      }
    } catch (err) {
      console.warn('[Koda Innertube] Failed to fetch FEmusic_library_landing:', err);
    }

    // 3. Also query YouTube FEplaylist_aggregation (video playlists and synced playlists)
    try {
      const videoPlaylists = await this.getVideoPlaylists();
      for (const vp of videoPlaylists) {
        const cleanId = `playlist_${vp.id.replace(/^VL/, '')}`;
        const resolvedThumb = vp.thumbnailUrl ? sizedArtwork(vp.thumbnailUrl, 544) : '';
        if (!seen.has(cleanId)) {
          seen.add(cleanId);
          playlists.push({
            id: cleanId,
            title: vp.title,
            subtitle: vp.videoCountText || `${vp.channelName ? `${vp.channelName} • ` : ''}Playlist`,
            author: vp.channelName || 'You',
            imageUrl: resolvedThumb || FALLBACK_ARTWORK_DATA_URI,
            trackCount: vp.videoCountText ? parseInt(vp.videoCountText, 10) || undefined : undefined
          });
        } else if (resolvedThumb && resolvedThumb !== FALLBACK_ARTWORK_DATA_URI) {
          const existing = playlists.find((p) => p.id === cleanId);
          if (
            existing &&
            (!existing.imageUrl ||
              existing.imageUrl === FALLBACK_ARTWORK_DATA_URI ||
              existing.imageUrl.includes('unsplash.com') ||
              existing.imageUrl.includes('/image/mixart'))
          ) {
            existing.imageUrl = resolvedThumb;
          }
        }
      }
    } catch (err) {
      console.warn('[Koda Innertube] Failed to fetch video playlists for user playlists:', err);
    }

    // Filter out redundant auto-playlists like Liked Music (VLLM / LM) from custom user playlists
    return playlists.filter((pl) => {
      const id = pl.id.toLowerCase();
      const title = pl.title.toLowerCase();
      return (
        id !== 'playlist_lm' &&
        id !== 'playlist_vllm' &&
        title !== 'liked songs' &&
        title !== 'your likes'
      );
    });
  }

  /**
   * Fetches authentic user video playlists from YouTube (FEplaylist_aggregation / FElibrary)
   */
  public async getVideoPlaylists(): Promise<VideoPlaylist[]> {
    const authState = bridgeClient.getAuthState();
    const activeAuthUser = authState?.selectedChannel?.authUser || '0';
    const activePageId = authState?.selectedChannel?.pageId || null;

    const bodyPayload: any = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20251006.00.00',
          hl: 'en',
          gl: 'IN',
          originalUrl: 'https://www.youtube.com/'
        }
      },
      browseId: 'FEplaylist_aggregation'
    };

    if (activePageId) {
      bodyPayload.context.user = { onBehalfOfUser: activePageId };
    }

    let data: any = null;
    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          method: 'POST',
          body: bodyPayload
        });
        if (response?.data && !response.data?.error) {
          data = response.data;
        }
      } catch (err) {
        console.warn('[InnertubeService] Video playlists bridge fetch error:', err);
      }
    }

    if (!data) {
      try {
        const directRes = await window.fetch(
          `https://www.youtube.com/youtubei/v1/browse?prettyPrint=false&authuser=${activeAuthUser}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20251006.00.00',
              'X-Goog-AuthUser': activeAuthUser
            },
            body: JSON.stringify(bodyPayload),
            credentials: 'include'
          }
        ).catch(() => null);

        if (directRes && directRes.ok) {
          data = await directRes.json();
        }
      } catch (err) {
        console.warn('[InnertubeService] Video playlists direct fetch error:', err);
      }
    }

    if (!data) return [];

    const json = this.ensureJsonObject(data);
    const playlists: VideoPlaylist[] = [];
    const seenIds = new Set<string>();

    const scan = (node: any) => {
      if (!node || typeof node !== 'object') return;

      if (node.playlistRenderer) {
        const pr = node.playlistRenderer;
        const playlistId = pr.playlistId || pr.navigationEndpoint?.watchEndpoint?.playlistId;
        if (playlistId && !seenIds.has(playlistId) && playlistId !== 'LL' && playlistId !== 'WL') {
          const title = this.getNodeText(pr.title);
          if (title) {
            seenIds.add(playlistId);
            const thumbs: any[] =
              pr.thumbnail?.thumbnails ||
              pr.thumbnails?.[0]?.thumbnails ||
              pr.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails ||
              pr.thumbnailRenderer?.playlistCustomThumbnailRenderer?.thumbnail?.thumbnails ||
              pr.sidebarThumbnails?.[0]?.thumbnails ||
              [];
            playlists.push({
              id: playlistId,
              title,
              thumbnailUrl: thumbs.slice(-1)[0]?.url,
              videoCountText: this.getNodeText(pr.videoCountText || pr.thumbnailText) || undefined,
              channelName: this.getNodeText(pr.shortBylineText || pr.longBylineText) || undefined
            });
          }
        }
      }

      if (node.gridPlaylistRenderer) {
        const gpr = node.gridPlaylistRenderer;
        const playlistId = gpr.playlistId;
        if (playlistId && !seenIds.has(playlistId) && playlistId !== 'LL' && playlistId !== 'WL') {
          const title = this.getNodeText(gpr.title);
          if (title) {
            seenIds.add(playlistId);
            const thumbs: any[] =
              gpr.thumbnail?.thumbnails ||
              gpr.thumbnails?.[0]?.thumbnails ||
              gpr.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails ||
              gpr.thumbnailRenderer?.playlistCustomThumbnailRenderer?.thumbnail?.thumbnails ||
              gpr.sidebarThumbnails?.[0]?.thumbnails ||
              [];
            playlists.push({
              id: playlistId,
              title,
              thumbnailUrl: thumbs.slice(-1)[0]?.url,
              videoCountText: this.getNodeText(gpr.videoCountText) || undefined,
              channelName: this.getNodeText(gpr.shortBylineText) || undefined
            });
          }
        }
      }

      if (node.lockupViewModel) {
        const lockup = node.lockupViewModel;
        const contentType = lockup.contentType;
        if (
          contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST' ||
          contentType === 'LOCKUP_CONTENT_TYPE_PODCAST' ||
          lockup.contentId?.startsWith('PL')
        ) {
          const playlistId = lockup.contentId;
          if (playlistId && !seenIds.has(playlistId) && playlistId !== 'LL' && playlistId !== 'WL') {
            const metadata = lockup.metadata?.lockupMetadataViewModel;
            const title = metadata?.title?.content;
            if (title) {
              seenIds.add(playlistId);
              const thumb =
                lockup.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image
                  ?.sources?.slice(-1)[0]?.url ||
                lockup.contentImage?.collectionThumbnailViewModel?.stackThumbnails?.[0]?.thumbnailViewModel?.image
                  ?.sources?.slice(-1)[0]?.url ||
                lockup.contentImage?.thumbnailViewModel?.image?.sources?.slice(-1)[0]?.url;
              const channelName = metadata?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content?.replace(
                /\s*•\s*Playlist/i,
                ''
              );
              playlists.push({
                id: playlistId,
                title,
                thumbnailUrl: thumb,
                videoCountText: undefined,
                channelName: channelName || undefined
              });
            }
          }
        }
      }

      if (Array.isArray(node)) {
        for (const item of node) scan(item);
      } else {
        for (const key of Object.keys(node)) {
          if (typeof node[key] === 'object') scan(node[key]);
        }
      }
    };

    scan(json);
    return playlists;
  }

  /**
   * Fetches the user's authentic listening history from YouTube Music (FEmusic_history)
   */
  public async getRecentlyPlayed(): Promise<TrackMetadata[]> {
    try {
      const data = await this.fetchInnerTubeEndpoint('browse', {
        browseId: 'FEmusic_history'
      });
      if (!data) return [];
      const json = this.ensureJsonObject(data);
      const tracks: TrackMetadata[] = [];
      const seenIds = new Set<string>();

      const addRenderer = (r: any) => {
        if (!r) return;
        const watchEndpoint =
          r.navigationEndpoint?.watchEndpoint ||
          r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint ||
          r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint ||
          r.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint;

        const videoId = r.playlistItemData?.videoId || watchEndpoint?.videoId;

        if (!videoId || seenIds.has(videoId)) return;

        const musicVideoType: string | undefined =
          watchEndpoint?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;

        const title =
          r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || '';
        const rawArtist =
          r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || '';
        const rawAlbum =
          r.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || '';
        const artist = this.cleanArtistSubtitle(rawArtist) || 'YouTube Music';
        const thumb =
          r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        if (!title) return;

        // Filter out regular non-music YouTube videos that leak into FEmusic_history from www.youtube.com
        if (
          isLikelyNonMusicVideo({
            title,
            artist,
            album: rawAlbum || undefined,
            thumbnailUrl: thumb,
            musicVideoType,
            rawSubtitle: rawArtist
          })
        ) {
          return;
        }

        seenIds.add(videoId);
        tracks.push({
          id: videoId,
          title: title.trim(),
          artist,
          album: rawAlbum ? rawAlbum.trim() : undefined,
          duration: 210,
          thumbnailUrl: thumb,
          highResThumbnailUrl: sizedArtwork(thumb, 544)
        });
      };

      const scan = (node: any) => {
        if (!node || typeof node !== 'object') return;
        if (node.musicResponsiveListItemRenderer) {
          addRenderer(node.musicResponsiveListItemRenderer);
        }
        if (Array.isArray(node)) {
          for (const item of node) scan(item);
        } else {
          for (const val of Object.values(node)) scan(val);
        }
      };

      scan(json);
      return tracks.slice(0, 30);
    } catch (err) {
      console.warn('[OurTube Innertube] Failed to fetch recently played:', err);
      return [];
    }
  }

  /**
   * Resolves tracks inside a playlist or album
   */
  public async resolvePlaylistTracks(playlistId: string): Promise<TrackMetadata[]> {
    const cleanId = playlistId.replace(/^playlist_/, '').replace(/^VL/, '');
    const browseId = `VL${cleanId}`;

    const data = await this.fetchInnerTubeEndpoint('browse', { browseId });
    if (!data) return [];

    const json = this.ensureJsonObject(data);
    const tracks: TrackMetadata[] = [];
    try {
      const list =
        json?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents ||
        json?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents ||
        [];

      for (const item of list) {
        const r = item.musicResponsiveListItemRenderer;
        if (!r) continue;

        const videoId =
          r.playlistItemData?.videoId ||
          r.navigationEndpoint?.watchEndpoint?.videoId ||
          r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
          r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

        const title =
          r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || '';
        const rawArtist =
          r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || '';
        const artist = this.cleanArtistSubtitle(rawArtist) || 'YouTube Music';
        const thumb =
          r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
          (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');

        if (videoId && title) {
          tracks.push({
            id: videoId,
            title,
            artist,
            duration: 210,
            thumbnailUrl: thumb,
            highResThumbnailUrl: sizedArtwork(thumb, 544)
          });
        }
      }
    } catch (err) {
      console.warn('Error parsing playlist tracks:', err);
    }
    return tracks;
  }

  /**
   * Resolves an artist's channel browseId (UC...) from their name via search
   */
  public async resolveArtistBrowseId(artistName: string): Promise<string | null> {
    if (!artistName.trim()) return null;

    const data = await this.fetchInnerTubeEndpoint('search', {
      query: artistName,
      params: 'Eg-KAQwBAggBEAMgACgBMAA%3D' // Filter: Artists
    });
    if (!data) return null;

    const json = this.ensureJsonObject(data);
    const sectionList =
      json?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    for (const section of sectionList) {
      if (section.musicCardShelfRenderer) {
        const card = section.musicCardShelfRenderer;
        const browseId =
          card.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
          card.on_tap?.payload?.browseId;
        if (browseId && (browseId.startsWith('UC') || browseId.startsWith('FEmusic'))) {
          return browseId;
        }
      }

      const items = section?.itemSectionRenderer?.contents || section?.musicShelfRenderer?.contents || [];
      for (const item of items) {
        const r = item?.musicResponsiveListItemRenderer;
        if (!r) continue;
        const browseId =
          r.navigationEndpoint?.browseEndpoint?.browseId ||
          r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
        if (browseId && (browseId.startsWith('UC') || browseId.startsWith('FEmusic'))) {
          return browseId;
        }
      }
    }

    return null;
  }

  /**
   * Fetches full artist details (hero, top songs, albums, singles, related artists, bio)
   */
  public async getArtistDetails(browseIdOrName: string): Promise<ArtistDetails | null> {
    let browseId = browseIdOrName;
    let fallbackName = browseIdOrName;

    // If it's not a UC... or FEmusic browseId, resolve via search first
    if (!browseId.startsWith('UC') && !browseId.startsWith('FEmusic')) {
      const resolved = await this.resolveArtistBrowseId(browseIdOrName);
      if (resolved) {
        browseId = resolved;
      } else {
        // Fallback: Synthesize an artist view from song search
        const songs = await this.search(browseIdOrName, 'songs');
        if (songs.length === 0) return null;
        return {
          id: `artist_${browseIdOrName}`,
          name: browseIdOrName,
          topSongs: songs.slice(0, 10),
          albums: [],
          singles: [],
          relatedArtists: []
        };
      }
    }

    const data = await this.fetchInnerTubeEndpoint('browse', { browseId });
    if (!data) return null;

    return this.parseArtistDetails(data, fallbackName, browseId);
  }

  /**
   * Searches YouTube Music for songs, videos, artists, albums, or playlists
   */
  public async search(query: string, filter: SearchFilter['id'] = 'all'): Promise<TrackMetadata[]> {
    if (!query.trim()) return [];

    const data = await this.fetchInnerTubeEndpoint('search', {
      query,
      params: this.getSearchFilterParam(filter)
    });

    if (data) {
      const results = this.parseSearchResults(data);
      if (results.length > 0) {
        return results;
      }
    }

    return [];
  }

  private getSearchFilterParam(filter: SearchFilter['id']): string | undefined {
    switch (filter) {
      case 'songs':
        return 'Eg-KAQwIABAAGAEgASgBMAA%3D';
      case 'videos':
        return 'Eg-KAQwIABABGAYgACgBMAA%3D';
      case 'albums':
        return 'Eg-KAQwBAggBEAUgACgBMAA%3D';
      case 'artists':
        return 'Eg-KAQwBAggBEAMgACgBMAA%3D';
      default:
        return undefined;
    }
  }

  /**
   * Robust parser for YouTube Music home sections
   */
  private parseHomeSections(raw: any): HomeSection[] {
    const data = this.ensureJsonObject(raw);
    const sections: HomeSection[] = [];
    if (!data) return sections;

    try {
      const contents =
        data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

      for (const section of contents) {
        const shelf = section?.musicCarouselShelfRenderer || section?.musicShelfRenderer;
        if (!shelf) continue;

        const headerTitleNode = shelf?.header?.musicCarouselShelfBasicHeaderRenderer?.title || shelf?.title;
        const straplineNode = shelf?.header?.musicCarouselShelfBasicHeaderRenderer?.strapline;
        let title = this.getNodeText(headerTitleNode);
        const strapline = this.getNodeText(straplineNode);
        if (strapline) {
          title = title ? `${strapline} • ${title}` : strapline;
        }
        if (!title) title = 'Recommendations';

        const items: TrackMetadata[] = [];

        for (const item of shelf.contents || []) {
          const renderer = item?.musicTwoRowItemRenderer || item?.musicResponsiveListItemRenderer;
          if (!renderer) continue;

          // Title extraction
          let titleText = '';
          if (renderer.title) {
            titleText = this.getNodeText(renderer.title);
          } else if (renderer.flexColumns?.[0]) {
            titleText = this.getNodeText(renderer.flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text);
          }

          if (!titleText || titleText.trim().length === 0) continue;

          // Artist extraction
          let artistText = '';
          if (renderer.subtitle) {
            artistText = this.cleanArtistSubtitle(this.getNodeText(renderer.subtitle));
          } else if (renderer.flexColumns?.[1]) {
            artistText = this.cleanArtistSubtitle(this.getNodeText(renderer.flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text));
          }

          // Thumbnail extraction
          const thumbnail =
            renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            '';

          // VideoId & musicVideoType extraction
          const watchEndpoint =
            renderer.navigationEndpoint?.watchEndpoint ||
            renderer.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint ||
            renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint ||
            renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint;

          const musicVideoType: string | undefined =
            watchEndpoint?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;

          let videoId =
            watchEndpoint?.videoId ||
            renderer.playlistItemData?.videoId ||
            thumbnail?.match(/vi\/([a-zA-Z0-9_-]{11})/)?.[1];

          // Playlist ID if watchEndpoint was omitted
          const playlistId =
            renderer.navigationEndpoint?.watchPlaylistEndpoint?.playlistId ||
            renderer.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchPlaylistEndpoint?.playlistId ||
            renderer.navigationEndpoint?.browseEndpoint?.browseId;

          if (!videoId && playlistId) {
            videoId = `playlist_${playlistId.replace(/^VL/, '')}`;
          }

          if (!videoId) continue;

          // Skip non-music YouTube videos or podcast episodes on the Music Home feed
          if (
            !videoId.startsWith('playlist_') &&
            isLikelyNonMusicVideo({
              title: titleText,
              artist: artistText,
              thumbnailUrl: thumbnail,
              musicVideoType
            })
          ) {
            continue;
          }

          const finalThumb =
            thumbnail ||
            (videoId && !videoId.startsWith('playlist_')
              ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
              : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80');

          items.push({
            id: videoId,
            title: titleText.trim(),
            artist: artistText || 'YouTube Music',
            duration: 210,
            thumbnailUrl: finalThumb,
            highResThumbnailUrl: sizedArtwork(finalThumb, 544)
          });
        }

        if (items.length > 0) {
          sections.push({ title, items });
        }
      }
    } catch (e) {
      console.warn('[Koda Innertube] Error parsing home sections:', e);
    }
    return sections;
  }

  /**
   * Robust parser for YouTube Music search results
   */
  private parseSearchResults(raw: any): TrackMetadata[] {
    const data = this.ensureJsonObject(raw);
    const results: TrackMetadata[] = [];
    if (!data) return results;

    const seenIds = new Set<string>();

    const addTrack = (track: TrackMetadata) => {
      if (!track.id || seenIds.has(track.id)) return;
      seenIds.add(track.id);
      results.push(track);
    };

    try {
      const sectionList =
        data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ||
        data?.contents?.sectionListRenderer?.contents ||
        data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ||
        [];

      for (const section of sectionList) {
        // 1. Check musicCardShelfRenderer (Top result card)
        if (section.musicCardShelfRenderer) {
          const card = section.musicCardShelfRenderer;
          const title = this.getNodeText(card.title);
          const subtitle = this.cleanArtistSubtitle(this.getNodeText(card.subtitle));

          const videoId =
            card.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
            card.on_tap?.payload?.videoId ||
            card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url?.match(/vi\/([a-zA-Z0-9_-]{11})/)?.[1] ||
            card.buttons?.find((b: any) => b.buttonRenderer?.navigationEndpoint?.watchEndpoint?.videoId)?.buttonRenderer?.navigationEndpoint?.watchEndpoint?.videoId;

          const thumbnail =
            card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');

          if (videoId && title) {
            const finalThumb = thumbnail || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80';
            addTrack({
              id: videoId,
              title,
              artist: subtitle || 'YouTube Music',
              duration: 240,
              thumbnailUrl: finalThumb,
              highResThumbnailUrl: sizedArtwork(finalThumb, 544)
            });
          }

          // If the top card contains child song items (e.g., Radiohead / Barkha song listings)
          if (Array.isArray(card.contents)) {
            for (const inner of card.contents) {
              const r = inner?.musicResponsiveListItemRenderer;
              if (!r) continue;

              const innerVideoId =
                r.playlistItemData?.videoId ||
                r.navigationEndpoint?.watchEndpoint?.videoId ||
                r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
                r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

              const innerTitle =
                r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || '';
              const innerArtist = this.cleanArtistSubtitle(
                r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || ''
              );

              const innerThumb =
                r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
                (innerVideoId ? `https://i.ytimg.com/vi/${innerVideoId}/hqdefault.jpg` : '') ||
                thumbnail;

              if (innerVideoId && innerTitle) {
                addTrack({
                  id: innerVideoId,
                  title: innerTitle,
                  artist: innerArtist || subtitle || 'YouTube Music',
                  duration: 210,
                  thumbnailUrl: innerThumb,
                  highResThumbnailUrl: sizedArtwork(innerThumb, 544)
                });
              }
            }
          }
        }

        // 2. Check itemSectionRenderer & musicShelfRenderer contents
        const items =
          section?.itemSectionRenderer?.contents ||
          section?.musicShelfRenderer?.contents ||
          [];

        for (const item of items) {
          const r = item?.musicResponsiveListItemRenderer;
          if (!r) continue;

          const videoId =
            r.playlistItemData?.videoId ||
            r.navigationEndpoint?.watchEndpoint?.videoId ||
            r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
            r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

          const title =
            r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || '';
          const rawArtist =
            r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || '';
          const artist = this.cleanArtistSubtitle(rawArtist) || 'YouTube Music';

          const rawThumb =
            r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '') ||
            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80';

          if (videoId && title) {
            addTrack({
              id: videoId,
              title,
              artist,
              duration: 210,
              thumbnailUrl: rawThumb,
              highResThumbnailUrl: sizedArtwork(rawThumb, 544)
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Koda Innertube] Error parsing search results:', err);
    }
    return results;
  }

  /**
   * Parser for full artist details (/browse)
   */
  private parseArtistDetails(raw: any, fallbackName: string, targetId: string): ArtistDetails {
    const data = this.ensureJsonObject(raw);
    const header =
      data?.header?.musicImmersiveHeaderRenderer ||
      data?.header?.musicVisualHeaderRenderer ||
      data?.header?.musicHeaderRenderer;

    const name = this.getNodeText(header?.title) || fallbackName;
    const subscribers =
      this.getNodeText(header?.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText) ||
      this.getNodeText(header?.straplineTextOne);

    const description = this.getNodeText(header?.description);

    const heroImage =
      header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
      header?.foregroundThumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;

    const topSongs: TrackMetadata[] = [];
    const albums: ArtistDetails['albums'] = [];
    const singles: ArtistDetails['singles'] = [];
    const relatedArtists: ArtistDetails['relatedArtists'] = [];

    const sections =
      data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    for (const sec of sections) {
      const shelf = sec?.musicShelfRenderer || sec?.musicCarouselShelfRenderer;
      if (!shelf) continue;

      const shelfTitle = (
        shelf?.title?.runs?.[0]?.text ||
        shelf?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text ||
        ''
      ).toLowerCase();

      // Top songs
      if (shelfTitle.includes('top songs') || shelfTitle.includes('songs')) {
        for (const item of shelf.contents || []) {
          const r = item?.musicResponsiveListItemRenderer;
          if (!r) continue;

          const videoId =
            r.playlistItemData?.videoId ||
            r.navigationEndpoint?.watchEndpoint?.videoId ||
            r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
            r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

          const title =
            r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || '';
          const rawArtist =
            r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x: any) => x.text).join('') || '';
          const artist = this.cleanArtistSubtitle(rawArtist) || name;
          const thumb =
            r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');

          if (videoId && title) {
            topSongs.push({
              id: videoId,
              title,
              artist,
              duration: 210,
              thumbnailUrl: thumb,
              highResThumbnailUrl: sizedArtwork(thumb, 544)
            });
          }
        }
      }

      // Albums
      else if (shelfTitle.includes('albums')) {
        for (const item of shelf.contents || []) {
          const r = item?.musicTwoRowItemRenderer;
          if (!r) continue;

          const title = this.getNodeText(r.title);
          const rawYear = this.getNodeText(r.subtitle);
          const year = rawYear.match(/\b(19\d\d|20\d\d)\b/)?.[0] || rawYear;
          const thumb =
            r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';

          const browseId =
            r.navigationEndpoint?.browseEndpoint?.browseId ||
            r.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;

          if (title && browseId) {
            albums.push({
              id: `playlist_${browseId.replace(/^VL/, '')}`,
              title,
              year,
              imageUrl: thumb
            });
          }
        }
      }

      // Singles & EPs
      else if (shelfTitle.includes('singles') || shelfTitle.includes('eps')) {
        for (const item of shelf.contents || []) {
          const r = item?.musicTwoRowItemRenderer;
          if (!r) continue;

          const title = this.getNodeText(r.title);
          const rawYear = this.getNodeText(r.subtitle);
          const year = rawYear.match(/\b(19\d\d|20\d\d)\b/)?.[0] || rawYear;
          const thumb =
            r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';

          const browseId =
            r.navigationEndpoint?.browseEndpoint?.browseId ||
            r.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;

          if (title && browseId) {
            singles.push({
              id: `playlist_${browseId.replace(/^VL/, '')}`,
              title,
              year,
              imageUrl: thumb
            });
          }
        }
      }

      // Fans also like / Similar artists
      else if (shelfTitle.includes('fans') || shelfTitle.includes('similar') || shelfTitle.includes('like')) {
        for (const item of shelf.contents || []) {
          const r = item?.musicTwoRowItemRenderer;
          if (!r) continue;

          const artistName = this.getNodeText(r.title);
          const rawSub = this.getNodeText(r.subtitle);
          const thumb =
            r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';

          const browseId =
            r.navigationEndpoint?.browseEndpoint?.browseId ||
            r.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;

          if (artistName && browseId) {
            relatedArtists.push({
              id: browseId,
              name: artistName,
              subscribers: rawSub,
              imageUrl: thumb
            });
          }
        }
      }
    }

    return {
      id: targetId,
      name,
      heroImage,
      subscribers,
      description,
      topSongs,
      albums,
      singles,
      relatedArtists
    };
  }

  /**
   * Robust parser for user playlists from FEmusic_liked_playlists or FEmusic_library_landing
   * Recursively traverses any shelf, tab, grid, carousel, or continuation format.
   */
  public parseUserPlaylists(raw: any): UserPlaylist[] {
    const data = this.ensureJsonObject(raw);
    const playlists: UserPlaylist[] = [];
    if (!data) return playlists;

    const seenIds = new Set<string>();

    const parseRenderer = (r: any) => {
      if (!r) return;

      const title =
        this.getNodeText(r.title) ||
        this.getNodeText(r.metadata?.lockupMetadataViewModel?.title) ||
        r.accessibilityText ||
        '';
      if (!title) return;

      // Extract browseId or playlistId from all known variations
      const browseId =
        r.navigationEndpoint?.browseEndpoint?.browseId ||
        r.navigationEndpoint?.watchPlaylistEndpoint?.playlistId ||
        r.navigationEndpoint?.watchEndpoint?.playlistId ||
        r.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
        r.contentId ||
        r.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint?.browseId ||
        r.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.playlistId ||
        r.onTap?.innertubeCommand?.browseEndpoint?.browseId ||
        r.onTap?.innertubeCommand?.watchEndpoint?.playlistId;

      if (!browseId) return;

      // Must be a playlist (VL..., PL..., RD...)
      const cleanRawId = browseId.replace(/^VL/, '');
      if (
        !browseId.startsWith('VL') &&
        !browseId.startsWith('PL') &&
        !browseId.startsWith('RD') &&
        !cleanRawId.startsWith('PL') &&
        cleanRawId !== 'LM'
      ) {
        return;
      }

      const cleanId = `playlist_${cleanRawId}`;
      if (seenIds.has(cleanId)) return;
      seenIds.add(cleanId);

      const rawSub =
        this.getNodeText(r.subtitle) ||
        this.getNodeText(r.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]) ||
        this.getNodeText(r.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.rowItems?.[0]) ||
        '';

      const thumbs: any[] =
        r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
        r.thumbnailRenderer?.musicAnimatedThumbnailRenderer?.backupRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
        r.thumbnailRenderer?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ||
        r.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails ||
        r.thumbnailRenderer?.playlistCustomThumbnailRenderer?.thumbnail?.thumbnails ||
        r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
        r.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ||
        r.thumbnail?.thumbnails ||
        r.thumbnails?.[0]?.thumbnails ||
        r.sidebarThumbnails?.[0]?.thumbnails ||
        r.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources ||
        r.contentImage?.collectionThumbnailViewModel?.stackThumbnails?.[0]?.thumbnailViewModel?.image?.sources ||
        r.contentImage?.thumbnailViewModel?.image?.sources ||
        [];

      let thumb = thumbs.slice(-1)[0]?.url || '';
      if (thumb) {
        thumb = sizedArtwork(thumb, 544);
      }

      // Determine track count
      let trackCount: number | undefined;
      const countMatch = rawSub.match(/(\d+)\s*(?:tracks|songs|videos)/i);
      if (countMatch?.[1]) {
        trackCount = parseInt(countMatch[1], 10);
      }

      playlists.push({
        id: cleanId,
        title,
        subtitle: rawSub || 'Playlist • YouTube Music',
        author: rawSub ? rawSub.split('•')[0]?.trim() || 'You' : 'You',
        imageUrl: thumb || FALLBACK_ARTWORK_DATA_URI,
        trackCount
      });
    };

    const scan = (node: any) => {
      if (!node || typeof node !== 'object') return;

      if (node.musicTwoRowItemRenderer) {
        parseRenderer(node.musicTwoRowItemRenderer);
      }
      if (node.musicResponsiveListItemRenderer) {
        parseRenderer(node.musicResponsiveListItemRenderer);
      }
      if (node.playlistRenderer) {
        parseRenderer(node.playlistRenderer);
      }
      if (node.gridPlaylistRenderer) {
        parseRenderer(node.gridPlaylistRenderer);
      }
      if (node.lockupViewModel) {
        const ct = node.lockupViewModel.contentType;
        const cid = node.lockupViewModel.contentId;
        const bId =
          node.lockupViewModel.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint?.browseId ||
          node.lockupViewModel.onTap?.innertubeCommand?.browseEndpoint?.browseId ||
          node.lockupViewModel.onTap?.innertubeCommand?.watchEndpoint?.playlistId;

        if (
          ct === 'LOCKUP_CONTENT_TYPE_PLAYLIST' ||
          ct === 'LOCKUP_CONTENT_TYPE_PODCAST' ||
          (typeof cid === 'string' && (cid.startsWith('PL') || cid.startsWith('VL') || cid.startsWith('RD'))) ||
          (typeof bId === 'string' && (bId.includes('PL') || bId.includes('VL')))
        ) {
          parseRenderer(node.lockupViewModel);
        }
      }

      if (Array.isArray(node)) {
        for (const item of node) scan(item);
      } else {
        for (const key of Object.keys(node)) {
          if (typeof node[key] === 'object') scan(node[key]);
        }
      }
    };

    try {
      scan(data);
    } catch (err) {
      console.warn('[Koda Innertube] Error parsing user playlists:', err);
    }

    return playlists;
  }
}

export const innertubeService = new InnertubeService();
