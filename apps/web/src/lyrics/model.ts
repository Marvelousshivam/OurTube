export type LyricAlignment = 'start' | 'end';

export interface LyricSyllable {
  startMs: number;
  endMs: number;
  /** Half-open character range in the enclosing LyricWord.text. */
  startChar: number;
  endChar: number;
}

export interface LyricWord {
  startMs: number;
  endMs: number;
  text: string;
  syllables: LyricSyllable[];
}

export interface LyricLine {
  timeMs: number;
  text: string;
  words: LyricWord[];
  /** Explicit end time when a line has no word stamps. */
  sungUntilMs: number | null;
  alignment: LyricAlignment;
  background: LyricLine | null;
}

export function line(
  timeMs: number,
  text: string,
  rest: Partial<Omit<LyricLine, 'timeMs' | 'text'>> = {}
): LyricLine {
  return {
    timeMs,
    text,
    words: rest.words ?? [],
    sungUntilMs: rest.sungUntilMs ?? null,
    alignment: rest.alignment ?? 'start',
    background: rest.background ?? null
  };
}

/**
 * Ensures syllable spans partition [0, wordLength) cleanly so every character
 * in a word is painted once.
 */
export function normalizedSyllables(
  syllables: readonly LyricSyllable[],
  wordLength: number
): LyricSyllable[] {
  if (wordLength <= 0 || syllables.length <= 1) return [];
  const sorted = [...syllables].sort((a, b) => a.startChar - b.startChar || a.startMs - b.startMs);
  let cursor = 0;
  const clamped: LyricSyllable[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const s = sorted[index]!;
    const startChar = Math.max(cursor, Math.min(s.startChar, wordLength));
    const endChar =
      index === sorted.length - 1
        ? wordLength
        : Math.max(startChar, Math.min(s.endChar, wordLength));
    if (endChar <= startChar) continue;
    const startMs = Math.max(0, s.startMs);
    clamped.push({
      startMs,
      endMs: Math.max(startMs, s.endMs),
      startChar,
      endChar
    });
    cursor = endChar;
  }
  if (clamped.length <= 1) return [];
  if (clamped[0]!.startChar > 0) {
    clamped[0] = { ...clamped[0]!, startChar: 0 };
  }
  return clamped;
}

export const MIN_GAP_MS = 5000;

export function lineEndMs(l: LyricLine): number | null {
  return l.words.at(-1)?.endMs ?? l.sungUntilMs;
}

/** Inserts an empty line at instrumental gaps of >= 5s so <am-lyrics> shows the 3-dot interlude. */
export function withInstrumentalGaps(lines: readonly LyricLine[]): LyricLine[] {
  if (!lines.length) return [];
  const out: LyricLine[] = [];
  if (lines[0]!.text && lines[0]!.timeMs >= MIN_GAP_MS) {
    out.push(line(0, ''));
  }
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i]!;
    out.push(current);
    const next = lines[i + 1];
    if (!next || !current.text || !next.text) continue;
    const endedAt = lineEndMs(current);
    if (endedAt !== null && next.timeMs - endedAt >= MIN_GAP_MS) {
      out.push(line(endedAt, ''));
    }
  }
  return out;
}

const PARENTHETICAL = /^\([^()]+\)$/;
const OVERLAP_SLOP_MS = 400;

function stripParens(l: LyricLine): LyricLine {
  const words = l.words.map((w, i, all) => {
    let text = w.text;
    let trimLeft = 0;
    if (i === 0 && text.startsWith('(')) {
      text = text.slice(1);
      trimLeft = 1;
    }
    if (i === all.length - 1 && text.endsWith(')')) {
      text = text.slice(0, -1);
    }
    if (!text) return null;
    const syllables = normalizedSyllables(
      w.syllables.map((s) => ({
        ...s,
        startChar: Math.max(0, s.startChar - trimLeft),
        endChar: Math.min(text.length, s.endChar - trimLeft)
      })),
      text.length
    );
    return { ...w, text, syllables };
  });
  return {
    ...l,
    text: l.text.trim().slice(1, -1).trim(),
    words: words.filter((w): w is LyricWord => !!w)
  };
}

/** Folds a parenthetical answer line "(yeah)" into the preceding line's background vocals when overlapping. */
export function withBackgroundVocals(lines: readonly LyricLine[]): LyricLine[] {
  if (lines.length < 2) return [...lines];
  const out: LyricLine[] = [];
  for (const current of lines) {
    const prev = out.at(-1);
    const prevEnd = prev ? lineEndMs(prev) : null;
    const overlaps =
      !!prev &&
      prev.text !== '' &&
      prev.background === null &&
      current.background === null &&
      PARENTHETICAL.test(current.text.trim()) &&
      prevEnd !== null &&
      current.timeMs >= prev.timeMs - OVERLAP_SLOP_MS &&
      current.timeMs <= prevEnd + OVERLAP_SLOP_MS;
    if (overlaps) {
      out[out.length - 1] = { ...prev, background: stripParens(current) };
    } else {
      out.push(current);
    }
  }
  return out;
}

/** Duet alignment: first solo voice stays left ('start'), other solo voices go right ('end'). */
export function lineAlignments(
  agents: readonly (string | null)[],
  agentTypes: Readonly<Record<string, string>> = {}
): LyricAlignment[] {
  const isGroup = (id: string) => {
    const type = agentTypes[id]?.toLowerCase();
    return type === 'group' || type === 'other' || (!type && id.toLowerCase() === 'v1000');
  };
  const distinct = new Set(agents.map((a) => a?.trim()).filter((a): a is string => !!a));
  if (distinct.size < 2) return agents.map(() => 'start');
  let lead: string | null = null;
  return agents.map((raw) => {
    const id = raw?.trim();
    if (!id || isGroup(id)) return 'start';
    lead ??= id;
    return id === lead ? 'start' : 'end';
  });
}

export interface TimedRun {
  startMs: number;
  endMs: number;
  raw: string;
}

/**
 * Merges timed runs into words: whitespace (not the span boundary) ends a word.
 */
export function wordsFromRuns(runs: readonly TimedRun[], hypheney = false): LyricWord[] {
  if (!runs.length) return [];
  const words: LyricWord[] = [];
  let text = '';
  let syllables: LyricSyllable[] = [];
  let wordStart = 0;
  let wordEnd = 0;
  const flush = () => {
    if (!text) return;
    words.push({
      startMs: wordStart,
      endMs: Math.max(wordStart, wordEnd),
      text,
      syllables: normalizedSyllables(syllables, text.length)
    });
    text = '';
    syllables = [];
  };
  for (const run of runs) {
    if (!run.raw) continue;
    const piece = run.raw.trim();
    if (!piece) {
      flush();
      continue;
    }
    if (/^\s/.test(run.raw)) flush();
    const continuing = text.length > 0 && (!hypheney || text.endsWith('-'));
    if (!continuing) {
      flush();
      wordStart = run.startMs;
    }
    const startChar = text.length;
    text += piece;
    syllables.push({
      startMs: run.startMs,
      endMs: Math.max(run.startMs, run.endMs),
      startChar,
      endChar: text.length
    });
    wordEnd = Math.max(run.startMs, run.endMs);
    if (/\s$/.test(run.raw)) flush();
  }
  flush();
  return words;
}
