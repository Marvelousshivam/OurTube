import { bridgeClient } from './bridgeClient';

export type SponsorCategoryKey =
  | 'sponsor'
  | 'selfpromo'
  | 'interaction'
  | 'intro'
  | 'outro'
  | 'preview'
  | 'music_offtopic'
  | 'filler';

export interface SponsorSegment {
  uuid: string;
  category: SponsorCategoryKey;
  label: string;
  color: string;
  startSec: number;
  endSec: number;
}

export interface VideoChapterItem {
  title: string;
  startSec: number;
  endSec: number;
}

export interface CaptionCueItem {
  startSec: number;
  endSec: number;
  text: string;
}

export const SPONSOR_CATEGORY_META: Record<
  SponsorCategoryKey,
  { label: string; shortLabel: string; color: string }
> = {
  sponsor: { label: 'Sponsor', shortLabel: 'Sponsor', color: '#00D400' },
  selfpromo: { label: 'Unpaid / Self Promo', shortLabel: 'Self Promo', color: '#FFFF00' },
  interaction: { label: 'Interaction Reminder', shortLabel: 'Reminder', color: '#CC00FF' },
  intro: { label: 'Intermission / Intro', shortLabel: 'Intro', color: '#00FFFF' },
  outro: { label: 'Endcards / Credits', shortLabel: 'Outro', color: '#3B82F6' },
  preview: { label: 'Preview / Recap', shortLabel: 'Recap', color: '#008FD6' },
  music_offtopic: { label: 'Non-Music Section', shortLabel: 'Off-topic', color: '#FF9900' },
  filler: { label: 'Filler Tangent', shortLabel: 'Filler', color: '#7300FF' }
};

const sponsorCache = new Map<string, { segments: SponsorSegment[]; storedAt: number }>();
const dislikeCache = new Map<string, { count: number; formatted: string }>();
const captionCueCache = new Map<string, CaptionCueItem[]>();

async function sha256HexPrefix(input: string, prefixLen = 4): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex.slice(0, prefixLen);
  }
  return '';
}

/**
 * Ported from temp_koda SponsorBlockRepository.kt:
 * Privacy-preserving 4-hex-character SHA-256 prefix lookup against sponsor.ajay.app
 */
export async function fetchSponsorSegments(videoId: string): Promise<SponsorSegment[]> {
  if (!videoId || videoId.length < 5) return [];

  const cached = sponsorCache.get(videoId);
  if (cached && Date.now() - cached.storedAt < 30 * 60 * 1000) {
    return cached.segments;
  }

  try {
    const prefix = await sha256HexPrefix(videoId, 4);
    const categoriesParam = encodeURIComponent(
      JSON.stringify([
        'sponsor',
        'selfpromo',
        'interaction',
        'intro',
        'outro',
        'preview',
        'music_offtopic',
        'filler'
      ])
    );
    const url = prefix
      ? `https://sponsor.ajay.app/api/skipSegments/${prefix}?categories=${categoriesParam}`
      : `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}&categories=${categoriesParam}`;

    const res = await fetch(url, {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) {
      sponsorCache.set(videoId, { segments: [], storedAt: Date.now() });
      return [];
    }

    const payload = await res.json();
    const list = Array.isArray(payload) ? payload : [];
    const out: SponsorSegment[] = [];

    for (const item of list) {
      if (prefix && item?.videoID !== videoId) continue;
      const segs = Array.isArray(item?.segments) ? item.segments : [item];
      for (const node of segs) {
        if (!node) continue;
        if (node.actionType && node.actionType !== 'skip') continue;
        const cat = node.category as SponsorCategoryKey;
        const meta = SPONSOR_CATEGORY_META[cat];
        if (!meta) continue;
        const range = node.segment;
        if (!Array.isArray(range) || range.length < 2) continue;
        const startSec = Number(range[0]);
        const endSec = Number(range[1]);
        if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || startSec < 0 || endSec <= startSec) {
          continue;
        }
        out.push({
          uuid: node.UUID || `${cat}-${startSec.toFixed(1)}`,
          category: cat,
          label: meta.shortLabel,
          color: meta.color,
          startSec,
          endSec
        });
      }
    }

    out.sort((a, b) => a.startSec - b.startSec);
    sponsorCache.set(videoId, { segments: out, storedAt: Date.now() });
    return out;
  } catch {
    return [];
  }
}

export function formatCompactCount(num: number): string {
  if (!Number.isFinite(num) || num < 0) return '';
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(num >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(num >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  }
  return String(num);
}

/**
 * Ported from temp_koda ReturnDislikeRepository.kt:
 * Live dislike counts from returnyoutubedislikeapi.com
 */
export async function fetchReturnYouTubeDislikes(
  videoId: string
): Promise<{ count: number; formatted: string } | null> {
  if (!videoId || videoId.length !== 11) return null;
  if (dislikeCache.has(videoId)) return dislikeCache.get(videoId)!;

  try {
    const res = await fetch(
      `https://returnyoutubedislikeapi.com/votes?videoId=${encodeURIComponent(videoId)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const dislikes = Number(data?.dislikes);
    if (!Number.isFinite(dislikes) || dislikes < 0) return null;
    const entry = {
      count: dislikes,
      formatted: formatCompactCount(dislikes)
    };
    dislikeCache.set(videoId, entry);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Parses timestamp chapters from video description lines (e.g. "0:00 Intro", "02:15 - Architecture")
 */
export function parseVideoChaptersFromDescription(
  description: string,
  totalDurationSec: number
): VideoChapterItem[] {
  if (!description || !totalDurationSec || totalDurationSec <= 0) return [];
  const lines = description.split(/\r?\n/);
  const rawChapters: { title: string; startSec: number }[] = [];
  const timeRegex = /(?:^|[\s([•-])(\d{1,2}:)?(\d{1,2}):(\d{2})(?:[\s)\]-•:]+|$)/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = timeRegex.exec(line);
    if (!match) continue;

    const hours = match[1] ? parseInt(match[1].replace(':', ''), 10) : 0;
    const mins = parseInt(match[2], 10);
    const secs = parseInt(match[3], 10);
    const startSec = hours * 3600 + mins * 60 + secs;
    if (startSec >= totalDurationSec) continue;

    const cleanedTitle = line
      .replace(match[0], ' ')
      .replace(/^[\s\-–—:•|[\]()]+|[\s\-–—:•|[\]()]+$/g, '')
      .trim();

    if (!cleanedTitle || cleanedTitle.length < 2) continue;
    if (!rawChapters.some((c) => Math.abs(c.startSec - startSec) < 2)) {
      rawChapters.push({ title: cleanedTitle, startSec });
    }
  }

  if (rawChapters.length < 2) return [];
  rawChapters.sort((a, b) => a.startSec - b.startSec);

  return rawChapters.map((ch, idx) => ({
    title: ch.title,
    startSec: ch.startSec,
    endSec: idx + 1 < rawChapters.length ? rawChapters[idx + 1].startSec : totalDurationSec
  }));
}

/**
 * Extracts timestamped comments (e.g. "1:24 this shot is incredible") for TimedCommentsOverlay
 */
export function parseTimedComments(
  comments: Array<{
    id: string;
    authorName: string;
    authorAvatarUrl?: string;
    text?: string;
    contentText?: string;
    likeCount?: string;
  }>,
  totalDurationSec: number
): Array<{
  id: string;
  timestampSec: number;
  timestampLabel: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
}> {
  if (!Array.isArray(comments) || comments.length === 0) return [];
  const out: Array<{
    id: string;
    timestampSec: number;
    timestampLabel: string;
    authorName: string;
    authorAvatarUrl?: string;
    text: string;
  }> = [];

  const tsRegex = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/;
  for (const c of comments) {
    const rawBody = c?.text || c?.contentText || '';
    if (!rawBody) continue;
    const match = tsRegex.exec(rawBody);
    if (!match) continue;
    const h = match[1] ? parseInt(match[1], 10) : 0;
    const m = parseInt(match[2], 10);
    const s = parseInt(match[3], 10);
    const sec = h * 3600 + m * 60 + s;
    if (totalDurationSec > 0 && sec >= totalDurationSec) continue;

    out.push({
      id: c.id,
      timestampSec: sec,
      timestampLabel: match[0],
      authorName: c.authorName,
      authorAvatarUrl: c.authorAvatarUrl,
      text: rawBody.replace(/\s+/g, ' ').trim()
    });
  }

  return out.sort((a, b) => a.timestampSec - b.timestampSec);
}

/**
 * Fetches & parses YouTube timedtext captions (supports json3 and XML formats)
 */
export async function fetchCaptionCues(baseUrl: string): Promise<CaptionCueItem[]> {
  if (!baseUrl) return [];
  if (captionCueCache.has(baseUrl)) return captionCueCache.get(baseUrl)!;

  try {
    const json3Url = baseUrl.includes('fmt=')
      ? baseUrl.replace(/fmt=[^&]+/, 'fmt=json3')
      : `${baseUrl}&fmt=json3`;

    let payload: any = null;

    try {
      const res = await fetch(json3Url, { credentials: 'omit' });
      if (res.ok) {
        const text = await res.text();
        payload = text.trim().startsWith('{') ? JSON.parse(text) : text;
      }
    } catch {}

    if (!payload && bridgeClient.getIsAvailable()) {
      try {
        const bridgeRes = await bridgeClient.fetchInnertube({ url: json3Url, method: 'GET' });
        payload = bridgeRes?.data;
      } catch {}
    }

    const cues: CaptionCueItem[] = [];

    if (payload && typeof payload === 'object' && Array.isArray(payload.events)) {
      for (const ev of payload.events) {
        if (!ev?.segs || typeof ev.tStartMs !== 'number') continue;
        const text = ev.segs
          .map((s: any) => s?.utf8 || '')
          .join('')
          .replace(/\n+/g, ' ')
          .trim();
        if (!text) continue;
        const startSec = ev.tStartMs / 1000;
        const durSec = (ev.dDurationMs || 3500) / 1000;
        cues.push({
          startSec,
          endSec: startSec + durSec,
          text
        });
      }
    } else if (typeof payload === 'string' && payload.includes('<text')) {
      const regex = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(payload)) !== null) {
        const startSec = parseFloat(match[1]);
        const durSec = match[2] ? parseFloat(match[2]) : 3.5;
        const rawText = match[3]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/<[^>]+>/g, '')
          .trim();
        if (rawText && Number.isFinite(startSec)) {
          cues.push({ startSec, endSec: startSec + durSec, text: rawText });
        }
      }
    }

    captionCueCache.set(baseUrl, cues);
    return cues;
  } catch {
    return [];
  }
}
