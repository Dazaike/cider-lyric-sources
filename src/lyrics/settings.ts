import { reactive } from 'vue';
import { LYRICS_SOURCES, orderedSources, type LyricsSourceId } from './sources';

/**
 * Which lyric providers are asked, and in what order. Kept in localStorage; a
 * source added in a later build lands where a fresh install would put it.
 */
interface Saved {
  order: LyricsSourceId[];
  disabled: LyricsSourceId[];
  /** PaxSenix's Spotify and Musixmatch routes need the user's own key. */
  paxsenixKey: string;
  /** Ask only this source (set from Cider's lyrics menu); empty means all enabled sources in order. */
  pinned: LyricsSourceId | '';
}

const KEY = 'cider-lyric-sources:settings';

const DEFAULTS: Saved = {
  order: LYRICS_SOURCES.map((s) => s.id),
  // The keyed routes do nothing without a key; off until one is entered.
  disabled: ['paxsenix-spotify', 'paxsenix-musixmatch'],
  paxsenixKey: '',
  pinned: '',
};

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
    return { ...DEFAULTS, ...saved, order: orderedSources(saved.order ?? DEFAULTS.order) };
  } catch {
    return { ...DEFAULTS };
  }
}

export const lyricsSettings = reactive<Saved>(load());

export function saveSettings() {
  const { order, disabled, paxsenixKey, pinned } = lyricsSettings;
  localStorage.setItem(KEY, JSON.stringify({ order, disabled, paxsenixKey, pinned }));
}

export function setEnabled(id: LyricsSourceId, on: boolean) {
  lyricsSettings.disabled = on ? lyricsSettings.disabled.filter((d) => d !== id) : [...new Set([...lyricsSettings.disabled, id])];
  saveSettings();
}

export function moveSource(id: LyricsSourceId, by: -1 | 1) {
  const order = [...lyricsSettings.order];
  const at = order.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= order.length) return;
  [order[at], order[to]] = [order[to]!, order[at]!];
  lyricsSettings.order = order;
  saveSettings();
}

export function resetSettings() {
  Object.assign(lyricsSettings, { ...DEFAULTS, order: [...DEFAULTS.order], disabled: [...DEFAULTS.disabled] });
  saveSettings();
}

/** The sources that will be asked, in the order they're asked: just the pinned one when there is one. */
export function enabledSources(): LyricsSourceId[] {
  if (lyricsSettings.pinned) return [lyricsSettings.pinned];
  return lyricsSettings.order.filter((id) => !lyricsSettings.disabled.includes(id));
}
