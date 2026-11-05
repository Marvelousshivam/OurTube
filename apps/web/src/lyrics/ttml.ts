import { LyricsLine } from '../types';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clock = (sec: number) => (Math.max(0, sec)).toFixed(3);

/**
 * Writes lyric lines into the standard Apple Music TTML format (<tt>) that <am-lyrics> reads.
 */
export function writeTtml(lines: LyricsLine[], language = 'en'): string {
  if (!lines || lines.length === 0) {
    return `<tt xmlns="http://www.w3.org/ns/ttml" xml:lang="${escape(language)}"><body><div></div></body></tt>`;
  }

  const timed = lines.some((l) => l.time > 0);

  const paragraphs = lines.map((l, index) => {
    if (!timed) return `<p>${escape(l.text)}</p>`;
    const next = lines[index + 1]?.time;
    const end = next ? next : l.time + 4.5;
    return `<p begin="${clock(l.time)}" end="${clock(Math.max(end, l.time + 0.5))}">${escape(l.text)}</p>`;
  });

  return (
    `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" ` +
    `xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xml:lang="${escape(language)}" ` +
    `itunes:timing="${timed ? 'Line' : 'None'}">` +
    `<head><metadata><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div>${paragraphs.join('')}</div></body></tt>`
  );
}
