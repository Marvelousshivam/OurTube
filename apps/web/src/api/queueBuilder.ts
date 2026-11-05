import { TrackMetadata } from '../types';

/**
 * Normalizes a song title to its core canonical representation
 * by stripping suffixes like "(Official Video)", "[HD]", "feat. XYZ", etc.
 */
export function normalisedTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .toLowerCase()
    .replace(/\s*[\(\[](official\s*(music\s*)?(video|audio|visualizer|lyric\s*video)?|lyrics?|audio|hd|4k|remaster(ed)?|explicit|live)[\)\]]/gi, '')
    .replace(/\s*[\(\[](feat|ft)\.?\s+[^\)\]]+[\)\]]/gi, '')
    .replace(/\s*-\s*(official\s*(music\s*)?video|audio|lyrics?).*$/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses an artist string into a Set of individual canonical artist names
 */
export function artistSet(rawArtist: string): Set<string> {
  const set = new Set<string>();
  if (!rawArtist) return set;

  // Split on delimiters: comma, &, x, feat, ft, •
  const parts = rawArtist
    .split(/[,&•]|\s+(?:feat\.?|ft\.?|x|with|vs\.?)\s+/i)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && !/^\d+[\.,]?\d*\s*[kmb]?\s*(views?|plays?|subscribers?)$/i.test(s));

  for (const part of parts) {
    // Strip trailing years or noise
    const cleaned = part.replace(/\s*\(\d{4}\)$/, '').trim();
    if (cleaned) set.add(cleaned);
  }

  return set;
}

/**
 * Checks whether two track entries represent the same musical recording
 * (e.g. lyric video vs official audio of the exact same song)
 */
export function isSameRecording(a: TrackMetadata, b: TrackMetadata): boolean {
  if (a.id === b.id) return true;

  const titleA = normalisedTitle(a.title);
  const titleB = normalisedTitle(b.title);

  if (titleA && titleB && titleA === titleB) {
    const artistsA = artistSet(a.artist);
    const artistsB = artistSet(b.artist);

    // If any artist matches or both have no parsed artist
    for (const art of artistsA) {
      if (artistsB.has(art)) return true;
    }

    if (artistsA.size === 0 || artistsB.size === 0) {
      return true;
    }
  }

  return false;
}

const PER_ARTIST_LIMIT = 2;
const SEED_ARTIST_LIMIT = 4;

/**
 * Intelligent BitChord Radio Station Queue Extension
 * Takes the current queue and candidate watch-next tracks,
 * deduplicates recordings, and applies diversity caps so the queue feels curated.
 */
export function extendStation(
  existingQueue: TrackMetadata[],
  candidateTracks: TrackMetadata[],
  limit: number = 25
): TrackMetadata[] {
  if (!candidateTracks || candidateTracks.length === 0) return [];

  // Determine seed artist from current playing track or first track in queue
  const seedTrack = existingQueue[0] || candidateTracks[0];
  const seedArtists = seedTrack ? artistSet(seedTrack.artist) : new Set<string>();

  // Count existing songs per artist
  const artistCounts = new Map<string, number>();
  for (const track of existingQueue) {
    const artists = artistSet(track.artist);
    for (const art of artists) {
      artistCounts.set(art, (artistCounts.get(art) || 0) + 1);
    }
  }

  const accepted: TrackMetadata[] = [];

  for (const candidate of candidateTracks) {
    if (accepted.length >= limit) break;

    // 1. Check if recording already exists in queue or already accepted
    const alreadyQueued = existingQueue.some((q) => isSameRecording(q, candidate));
    if (alreadyQueued) continue;

    const alreadyAccepted = accepted.some((acc) => isSameRecording(acc, candidate));
    if (alreadyAccepted) continue;

    // 2. Diversity caps
    const candidateArtists = artistSet(candidate.artist);
    let isSeed = false;
    for (const art of candidateArtists) {
      if (seedArtists.has(art)) {
        isSeed = true;
        break;
      }
    }

    const maxAllowed = isSeed ? SEED_ARTIST_LIMIT : PER_ARTIST_LIMIT;
    let exceedsCap = false;

    for (const art of candidateArtists) {
      const count = artistCounts.get(art) || 0;
      if (count >= maxAllowed) {
        exceedsCap = true;
        break;
      }
    }

    if (exceedsCap) continue;

    // Accept candidate track
    accepted.push(candidate);

    // Update counts
    for (const art of candidateArtists) {
      artistCounts.set(art, (artistCounts.get(art) || 0) + 1);
    }
  }

  return accepted;
}
