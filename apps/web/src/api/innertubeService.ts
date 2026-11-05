import { TrackMetadata, SearchFilter } from '../types';
import { bridgeClient } from './bridgeClient';
import { sizedArtwork } from './artworkService';

export interface HomeSection {
  title: string;
  items: TrackMetadata[];
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
   * Helper to extract clean text from any run/simpleText node
   */
  private getNodeText(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node.simpleText) return node.simpleText;
    if (Array.isArray(node.runs)) {
      return node.runs.map((r: any) => r.text || '').join('');
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
   * Universal BitChord InnerTube fetcher:
   * 1. Extension bridge (with signed SAPISID session cookies)
   * 2. Vite dev server proxy (/api/ytmusic/youtubei/v1/...) -> 0 CORS
   * 3. BitChord Simple Request (text/plain) -> 0 CORS preflight OPTIONS check
   */
  public async fetchInnerTubeEndpoint(endpoint: string, bodyPayload: any): Promise<any> {
    const defaultPayload = {
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20251006.03.00',
          hl: 'en',
          gl: 'US'
        }
      },
      ...bodyPayload
    };

    // 1. Try extension bridge
    if (bridgeClient.getIsAvailable()) {
      try {
        const response = await bridgeClient.fetchInnertube({
          url: `https://music.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`,
          method: 'POST',
          body: defaultPayload
        });
        if (response?.data) return response.data;
      } catch (bridgeErr) {
        console.warn(`[Koda Innertube] Bridge ${endpoint} error:`, bridgeErr);
      }
    }

    // 2. Try Vite dev server proxy (/api/ytmusic)
    try {
      const proxyRes = await window.fetch(`/api/ytmusic/youtubei/v1/${endpoint}?prettyPrint=false`, {
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

    try {
      const playlist =
        data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer;
      const contents = playlist?.contents || [];

      for (const item of contents) {
        const r = item?.playlistPanelVideoRenderer;
        if (!r || !r.videoId) continue;

        const title = this.getNodeText(r.title);
        if (!title) continue;

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
      }
    } catch (err) {
      console.warn('[Koda Innertube] Error parsing watch next radio:', err);
    }

    return tracks;
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
   * Fetches user's authentic personal playlists from YouTube Music (FEmusic_liked_playlists)
   */
  public async getUserPlaylists(): Promise<UserPlaylist[]> {
    const data = await this.fetchInnerTubeEndpoint('browse', {
      browseId: 'FEmusic_liked_playlists'
    });

    return this.parseUserPlaylists(data);
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

        const title =
          shelf?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text ||
          shelf?.title?.runs?.[0]?.text ||
          'Recommendations';

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

          // VideoId extraction
          let videoId =
            renderer.navigationEndpoint?.watchEndpoint?.videoId ||
            renderer.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
            renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
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
            highResThumbnailUrl: sizedArtwork(finalThumb, 1200)
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
        data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

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
              highResThumbnailUrl: sizedArtwork(finalThumb, 1200)
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
                  highResThumbnailUrl: sizedArtwork(innerThumb, 1200)
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
              highResThumbnailUrl: sizedArtwork(rawThumb, 1200)
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
              highResThumbnailUrl: sizedArtwork(thumb, 1200)
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
   * Parser for user playlists from FEmusic_liked_playlists
   */
  private parseUserPlaylists(raw: any): UserPlaylist[] {
    const data = this.ensureJsonObject(raw);
    const playlists: UserPlaylist[] = [];
    if (!data) return playlists;

    try {
      const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs;
      const sectionContents =
        tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

      for (const sec of sectionContents) {
        const grid = sec?.gridRenderer || sec?.musicCarouselShelfRenderer;
        const items = grid?.items || grid?.contents || [];

        for (const item of items) {
          const r = item?.musicTwoRowItemRenderer || item?.musicResponsiveListItemRenderer;
          if (!r) continue;

          const title = this.getNodeText(r.title);
          const rawSub = this.getNodeText(r.subtitle);
          const thumb =
            r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
            '';

          const browseId =
            r.navigationEndpoint?.browseEndpoint?.browseId ||
            r.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
            r.navigationEndpoint?.watchPlaylistEndpoint?.playlistId;

          if (!title || !browseId) continue;

          const cleanId = `playlist_${browseId.replace(/^VL/, '')}`;

          playlists.push({
            id: cleanId,
            title,
            subtitle: rawSub || 'Playlist • YouTube Music',
            author: rawSub.split('•')[0]?.trim() || 'You',
            imageUrl: thumb || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80'
          });
        }
      }
    } catch (err) {
      console.warn('[Koda Innertube] Error parsing user playlists:', err);
    }

    return playlists;
  }
}

export const innertubeService = new InnertubeService();
