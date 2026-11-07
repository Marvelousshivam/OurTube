import { TrackMetadata, QueueTier, QueueEntry } from '../types';

export type { QueueTier, QueueEntry };

let counter = 0;
export function makeEntryId(prefix: string = 'qe'): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}_${Math.random().toString(36).substring(2, 7)}`;
}

export function asEntry(
  track: TrackMetadata,
  tier: QueueTier = 'context',
  sourceTitle?: string
): QueueEntry {
  return {
    entryId: makeEntryId(tier),
    track,
    tier,
    sourceTitle
  };
}

/**
 * Builds a queue from an album, playlist, or source context.
 * BitChord Invariant: [Preceding Context] + [Selected Track] + [Preserved USER_QUEUE] + [Following Context Tracks]
 */
export function buildContextQueue(
  tracks: TrackMetadata[],
  startIndex: number = 0,
  sourceTitle?: string,
  preservedUserQueue: QueueEntry[] = []
): { queue: QueueEntry[]; queueIndex: number } {
  if (tracks.length === 0) {
    return { queue: [], queueIndex: 0 };
  }
  const entries = tracks.map((t) => asEntry(t, 'context', sourceTitle));
  const validIndex = Math.max(0, Math.min(startIndex, entries.length - 1));
  const precedingContext = entries.slice(0, validIndex);
  const selected = entries[validIndex];
  const followingContext = entries.slice(validIndex + 1);

  const queue = [
    ...precedingContext,
    selected,
    ...preservedUserQueue,
    ...followingContext
  ];

  return { queue, queueIndex: precedingContext.length };
}

/**
 * Builds a single-track queue (e.g. from Search or Top Match) intended to trigger an autoplay station.
 */
export function buildOneOffQueue(track: TrackMetadata): { queue: QueueEntry[]; queueIndex: number } {
  return {
    queue: [asEntry(track, 'context')],
    queueIndex: 0
  };
}

/**
 * Adds a track to the user tier (Play Next or Add to End of user queue).
 */
export function addToUserQueue(
  currentQueue: QueueEntry[],
  currentIndex: number,
  track: TrackMetadata,
  playNext: boolean = false
): { queue: QueueEntry[]; insertIndex: number } {
  const newEntry = asEntry(track, 'user');
  const queue = [...currentQueue];

  if (playNext) {
    const insertPos = Math.min(currentIndex + 1, queue.length);
    queue.splice(insertPos, 0, newEntry);
    return { queue, insertIndex: insertPos };
  }

  // Add to end of user queue (or right after context items, before autoplay)
  let lastUserOrContextIndex = currentIndex;
  for (let i = currentIndex + 1; i < queue.length; i++) {
    if (queue[i].tier === 'user' || queue[i].tier === 'context') {
      lastUserOrContextIndex = i;
    } else {
      break;
    }
  }

  const insertPos = lastUserOrContextIndex + 1;
  queue.splice(insertPos, 0, newEntry);
  return { queue, insertIndex: insertPos };
}

/**
 * Clears hand-queued user items that are ahead of the playhead.
 */
export function clearUpcomingUserQueue(
  currentQueue: QueueEntry[],
  currentIndex: number
): QueueEntry[] {
  return currentQueue.filter((item, idx) => {
    if (idx <= currentIndex) return true; // keep history
    return item.tier !== 'user';
  });
}

/**
 * Station extension: appends candidates to the autoplay tier with:
 * 1. Global deduplication against existing queue tracks
 * 2. Artist flood capping (max 2 per artist in station)
 */
export function extendStation(
  currentQueue: QueueEntry[],
  candidates: TrackMetadata[],
  maxAddition: number = 25,
  maxPerArtist: number = 2
): QueueEntry[] {
  const existingIds = new Set<string>(currentQueue.map((e) => e.track.id));
  const artistCounts = new Map<string, number>();

  for (const e of currentQueue) {
    if (e.tier === 'autoplay') {
      const art = (e.track.artist || '').toLowerCase().trim();
      if (art) {
        artistCounts.set(art, (artistCounts.get(art) || 0) + 1);
      }
    }
  }

  const additions: QueueEntry[] = [];

  for (const cand of candidates) {
    if (additions.length >= maxAddition) break;
    if (!cand.id || existingIds.has(cand.id)) continue;

    const art = (cand.artist || '').toLowerCase().trim();
    if (art) {
      const curCount = artistCounts.get(art) || 0;
      if (curCount >= maxPerArtist) continue;
      artistCounts.set(art, curCount + 1);
    }

    existingIds.add(cand.id);
    additions.push(asEntry(cand, 'autoplay'));
  }

  return additions;
}

/**
 * Handles queue jumping logic with BitChord station pivoting:
 * - If target is in 'context' or 'user' tier: jump directly along timeline without wiping.
 * - If target is in 'autoplay' tier: station pivot occurs! The autoplay track becomes the new pivot,
 *   preserving past history and discarding subsequent autoplay entries for a fresh station seed.
 */
export function computeJump(
  currentQueue: QueueEntry[],
  currentIndex: number,
  targetIndex: number
): {
  newQueue: QueueEntry[];
  newIndex: number;
  shouldPivotStation: boolean;
} {
  if (targetIndex < 0 || targetIndex >= currentQueue.length) {
    return {
      newQueue: currentQueue,
      newIndex: currentIndex,
      shouldPivotStation: false
    };
  }

  const targetEntry = currentQueue[targetIndex];

  // If jumping to an autoplay track, pivot station around this track!
  if (targetEntry.tier === 'autoplay') {
    // Keep history up to current, plus convert target track into new context pivot
    const history = currentQueue.slice(0, targetIndex);
    const pivotEntry: QueueEntry = {
      ...targetEntry,
      tier: 'context'
    };

    return {
      newQueue: [...history, pivotEntry],
      newIndex: history.length,
      shouldPivotStation: true
    };
  }

  // Normal navigation along context or user tier: timeline is intact
  return {
    newQueue: currentQueue,
    newIndex: targetIndex,
    shouldPivotStation: false
  };
}

/**
 * Shuffles upcoming non-user tracks in the queue using Fisher-Yates while keeping history and hand-queued 'user' tracks intact.
 */
export function shuffleUpcomingQueue(
  currentQueue: QueueEntry[],
  currentIndex: number
): QueueEntry[] {
  if (currentQueue.length <= currentIndex + 2) return currentQueue;

  const historyAndCurrent = currentQueue.slice(0, currentIndex + 1);
  const upcoming = currentQueue.slice(currentIndex + 1);

  const userEntries = upcoming.filter((e) => e.tier === 'user');
  const shuffleable = upcoming.filter((e) => e.tier !== 'user');

  for (let i = shuffleable.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffleable[i], shuffleable[j]] = [shuffleable[j], shuffleable[i]];
  }

  return [...historyAndCurrent, ...userEntries, ...shuffleable];
}
