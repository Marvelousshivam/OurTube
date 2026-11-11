import { lineEndMs, type LyricLine, type LyricWord } from './model';

/**
 * Writes the LyricLine model into Apple-flavoured TTML for @uimaxbai/am-lyrics:
 * - Syllable / word spans (<span begin end>) with trailing whitespace inside the span so am-lyrics glues multi-span words and separates words cleanly.
 * - Background vocals (<span ttm:role="x-bg">) wrapped in parentheses.
 * - Duet voice alignment (ttm:agent="v1" / "v2").
 */
const xml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function stamp(ms: number): string {
  const clamped = Math.max(0, Math.trunc(ms));
  const totalSec = Math.floor(clamped / 1000);
  const millis = String(clamped % 1000).padStart(3, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  const min = Math.floor((totalSec / 60) % 60);
  const hr = Math.floor(totalSec / 3600);
  return hr > 0
    ? `${hr}:${String(min).padStart(2, '0')}:${sec}.${millis}`
    : `${min}:${sec}.${millis}`;
}

function writeWords(words: readonly LyricWord[], wrapParens = false): string {
  return words
    .map((word, wordIndex) => {
      const prefix = wrapParens && wordIndex === 0 ? '(' : '';
      const suffix =
        (wrapParens && wordIndex === words.length - 1 ? ')' : '') +
        (wordIndex < words.length - 1 ? ' ' : '');
      if (word.syllables.length > 1) {
        return word.syllables
          .map((s, sIndex) => {
            const slice = word.text.slice(s.startChar, s.endChar);
            const pre = sIndex === 0 ? prefix : '';
            const suf = sIndex === word.syllables.length - 1 ? suffix : '';
            return `<span begin="${stamp(s.startMs)}" end="${stamp(s.endMs)}">${xml(pre + slice + suf)}</span>`;
          })
          .join('');
      }
      return `<span begin="${stamp(word.startMs)}" end="${stamp(word.endMs)}">${xml(prefix + word.text + suffix)}</span>`;
    })
    .join('');
}

export function writeTtml(lines: readonly LyricLine[]): string {
  const sung = lines.filter((l) => l.text.trim() !== '');
  const timed = sung.some((l) => l.timeMs > 0 || l.words.length > 0);
  const wordTimed = sung.some((l) => l.words.length > 0);
  const timing = wordTimed ? 'Word' : timed ? 'Line' : 'None';
  const hasSecondVoice = sung.some((l) => l.alignment === 'end');

  const paragraphs = sung.map((l, index) => {
    const nextStart = sung[index + 1]?.timeMs;
    const naturalEnd = lineEndMs(l);
    const end =
      naturalEnd ??
      (nextStart && nextStart > l.timeMs ? nextStart : l.timeMs + 4000);
    const agent = hasSecondVoice
      ? ` ttm:agent="${l.alignment === 'end' ? 'v2' : 'v1'}"`
      : '';
    const timeAttrs = timed ? ` begin="${stamp(l.timeMs)}" end="${stamp(end)}"` : '';
    const lead = l.words.length ? writeWords(l.words) : xml(l.text);
    const bg = l.background
      ? ` <span ttm:role="x-bg" begin="${stamp(l.background.timeMs)}" end="${stamp(lineEndMs(l.background) ?? end)}">${
          l.background.words.length
            ? writeWords(l.background.words, true)
            : xml(`(${l.background.text})`)
        }</span>`
      : '';
    return `<p${timeAttrs}${agent}>${lead}${bg}</p>`;
  });

  const agents = hasSecondVoice
    ? '<head><metadata><ttm:agent type="person" xml:id="v1"/><ttm:agent type="person" xml:id="v2"/></metadata></head>'
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?><tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="${timing}">${agents}<body><div>${paragraphs.join('')}</div></body></tt>`;
}

/** Exports LyricLine[] to standard/enhanced .lrc text for downloading. */
export function writeLrc(lines: readonly LyricLine[]): string {
  return lines
    .filter((l) => l.text.trim() !== '')
    .map((l) => {
      const clamped = Math.max(0, Math.trunc(l.timeMs));
      const min = String(Math.floor(clamped / 60000)).padStart(2, '0');
      const sec = String(Math.floor((clamped % 60000) / 1000)).padStart(2, '0');
      const cs = String(Math.floor((clamped % 1000) / 10)).padStart(2, '0');
      return `[${min}:${sec}.${cs}]${l.text}`;
    })
    .join('\n');
}
