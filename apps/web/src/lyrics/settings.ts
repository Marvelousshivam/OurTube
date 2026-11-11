import { create } from 'zustand';
import { LYRICS_SOURCES, orderedSources, type LyricsSourceId } from './sources';

export interface LyricsSettingsState {
  order: LyricsSourceId[];
  disabled: LyricsSourceId[];
  /** Keep looking past a line-timed answer for a word/syllable-timed one. */
  preferSyllables: boolean;
  /** Optional PaxSenix key for Spotify and Musixmatch routes. */
  paxsenixKey: string;
  setEnabled: (id: LyricsSourceId, on: boolean) => void;
  move: (id: LyricsSourceId, by: -1 | 1) => void;
  setPreferSyllables: (on: boolean) => void;
  setPaxsenixKey: (key: string) => void;
  reset: () => void;
}

const STORAGE_KEY = 'ourtube:lyrics-settings';
type Saved = Pick<
  LyricsSettingsState,
  'order' | 'disabled' | 'preferSyllables' | 'paxsenixKey'
>;

const DEFAULTS: Saved = {
  order: LYRICS_SOURCES.map((s) => s.id),
  disabled: ['paxsenix-spotify', 'paxsenix-musixmatch'],
  preferSyllables: true,
  paxsenixKey: ''
};

function load(): Saved {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Saved>;
    return {
      ...DEFAULTS,
      ...saved,
      order: orderedSources(saved.order ?? DEFAULTS.order)
    };
  } catch {
    return DEFAULTS;
  }
}

export const useLyricsSettings = create<LyricsSettingsState>()((set, get) => {
  const save = (change: Partial<Saved>) => {
    set(change);
    const { order, disabled, preferSyllables, paxsenixKey } = get();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ order, disabled, preferSyllables, paxsenixKey })
      );
    } catch {
      // ignore storage errors
    }
  };
  return {
    ...load(),
    setEnabled: (id, on) =>
      save({
        disabled: on
          ? get().disabled.filter((d) => d !== id)
          : [...new Set([...get().disabled, id])]
      }),
    move: (id, by) => {
      const order = [...get().order];
      const at = order.indexOf(id);
      const to = at + by;
      if (at < 0 || to < 0 || to >= order.length) return;
      [order[at], order[to]] = [order[to]!, order[at]!];
      save({ order });
    },
    setPreferSyllables: (preferSyllables) => save({ preferSyllables }),
    setPaxsenixKey: (paxsenixKey) => save({ paxsenixKey: paxsenixKey.trim() }),
    reset: () => save(DEFAULTS)
  };
});

export function enabledSources(): LyricsSourceId[] {
  const { order, disabled } = useLyricsSettings.getState();
  return order.filter((id) => !disabled.includes(id));
}
