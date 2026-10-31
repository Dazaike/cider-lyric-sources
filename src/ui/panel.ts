import { LYRICS_SOURCES, type LyricsSourceId } from '../lyrics/sources';
import { lyricsSettings, saveSettings } from '../lyrics/settings';
import { forgetLyrics } from '../lyrics/repository';
import { lyricsState, playingIds } from '../lyrics/nowPlaying';

/**
 * Adds our source picker to Cider's lyrics menu. The menu is Cider's own Vue
 * component, so this works on its DOM (the `lyrics-panel-*` classes) and puts
 * the additions back whenever a re-render drops them.
 *
 * - "Lyrics from" page: a "Lyric source" dropdown (Auto, or one source) for Community.
 * - main page: "Lyrics via <source>" when Community is the active provider.
 */

const MARK = 'data-cls';
const STYLE_ID = 'cls-panel-style';

const css = `
.cls-row { display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: 8px 12px; }
.cls-row .lyrics-panel-row__text { display: flex; flex-direction: column; }
.cls-picker { display: flex; flex-direction: column; gap: 4px; }
.cls-trigger { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 7px 10px; border: 0; border-radius: 8px; font: inherit; font-size: 12px; color: inherit; background: rgba(255,255,255,.08); cursor: pointer; transition: background .15s; }
.cls-trigger:hover, .cls-picker[data-open] .cls-trigger { background: rgba(255,255,255,.14); }
.cls-chevron { opacity: .6; transition: transform .15s; }
.cls-picker[data-open] .cls-chevron { transform: rotate(180deg); }
.cls-list { max-height: 190px; overflow-y: auto; padding: 4px; border-radius: 10px; background: rgba(255,255,255,.06); }
.cls-option { display: block; width: 100%; padding: 6px 10px; border: 0; border-radius: 7px; font: inherit; font-size: 12px; text-align: left; color: inherit; background: transparent; cursor: pointer; }
.cls-option:hover { background: rgba(255,255,255,.12); }
.cls-option[data-active] { background: rgba(255,255,255,.16); font-weight: 600; }
.cls-via { padding: 2px 14px 8px; font-size: 11px; opacity: .65; }
`;

function addStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.append(style);
}

const isCommunity = (el: Element) => el.textContent?.trim().startsWith('Community') ?? false;

/** The part of Cider's `lyric-store` (Pinia) that matters here. */
interface LyricStore {
  lyricStore: unknown[];
  requestRefresh(songId: string): void;
}
interface PiniaHost {
  CiderApp?: { app?: { config?: { globalProperties?: { $pinia?: { _s?: Map<string, unknown> } } } } };
}

function lyricStoreOf(): LyricStore | undefined {
  const pinia = (window as unknown as PiniaHost).CiderApp?.app?.config?.globalProperties?.$pinia;
  // Pinia's store registry is private API; a Cider update that moves it just falls back to clicking.
  const store = pinia?._s?.get('lyric-store') as LyricStore | undefined;
  return store && typeof store.requestRefresh === 'function' ? store : undefined;
}

/** Cider caches fetched lyrics per song, so a re-pick or "Refresh" can be answered without asking the provider. */
function reloadFromStore(): boolean {
  const store = lyricStoreOf();
  if (!store) return false;
  store.lyricStore.splice(0);
  for (const id of playingIds()) store.requestRefresh(id);
  return true;
}

/** Applies a new source choice and makes Cider ask again. */
function choose(page: HTMLElement, value: LyricsSourceId | '') {
  lyricsSettings.pinned = value;
  saveSettings();
  forgetLyrics();
  // Cider serves lyrics it already fetched, so empty its cache and make it reload.
  if (reloadFromStore()) return;
  const community = [...page.querySelectorAll<HTMLElement>('.lyrics-panel-group .lyrics-panel-row')].find(isCommunity);
  // The active provider's row has an icon (the tick) in its lead cell.
  const active = !!community?.querySelector('.lyrics-panel-row__lead')?.children.length;
  if (!active) {
    community?.click();
    return;
  }
  [...page.querySelectorAll<HTMLElement>('button.lyrics-panel-row')]
    .filter((b) => !b.closest('.lyrics-panel-group') && !b.closest('.lyrics-panel-head'))
    .at(-1)
    ?.click();
}

const CHOICES: readonly { value: LyricsSourceId | ''; label: string }[] = [
  { value: '', label: 'Auto (all, in order)' },
  ...LYRICS_SOURCES.map((s) => ({ value: s.id, label: s.label })),
];
const labelOf = (value: LyricsSourceId | '') => CHOICES.find((c) => c.value === value)?.label ?? CHOICES[0]!.label;

/** A dropdown built from the lyrics menu's own look, since the browser's native popup can't be themed. */
function picker(page: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cls-picker';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cls-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  const current = document.createElement('span');
  current.textContent = labelOf(lyricsSettings.pinned);
  const chevron = document.createElement('span');
  chevron.className = 'cls-chevron';
  chevron.textContent = '⌄';
  trigger.append(current, chevron);

  const list = document.createElement('div');
  list.className = 'cls-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  for (const choice of CHOICES) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'cls-option';
    option.setAttribute('role', 'option');
    option.dataset.value = choice.value;
    option.textContent = choice.label;
    option.toggleAttribute('data-active', choice.value === lyricsSettings.pinned);
    list.append(option);
  }

  const stop = (e: Event) => e.stopPropagation();
  wrap.addEventListener('click', stop);
  trigger.addEventListener('click', () => {
    list.hidden = !list.hidden;
    wrap.toggleAttribute('data-open', !list.hidden);
    list.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' });
  });
  // One listener for all options instead of one each.
  list.addEventListener('click', (e) => {
    const option = (e.target as Element).closest<HTMLElement>('.cls-option');
    if (!option) return;
    const value = option.dataset.value as LyricsSourceId | '';
    list.querySelectorAll('[data-active]').forEach((el) => el.removeAttribute('data-active'));
    option.setAttribute('data-active', '');
    current.textContent = labelOf(value);
    list.hidden = true;
    wrap.removeAttribute('data-open');
    choose(page, value);
  });

  wrap.append(trigger, list);
  return wrap;
}

function addPicker(page: HTMLElement) {
  const sep = document.createElement('div');
  sep.className = 'lyrics-panel-sep';
  sep.setAttribute(MARK, '');

  const row = document.createElement('div');
  row.className = 'lyrics-panel-row cls-row';
  row.setAttribute(MARK, '');
  const text = document.createElement('span');
  text.className = 'lyrics-panel-row__text';
  const name = document.createElement('span');
  name.textContent = 'Lyric source';
  const sub = document.createElement('span');
  sub.className = 'lyrics-panel-row__sub';
  sub.textContent = 'Used by Community';
  text.append(name, sub);
  row.append(text, picker(page));
  page.append(sep, row);
}

/**
 * The main page's first row is the active provider; when it is Community, say which source really supplied the lyrics.
 * The note is its own block at the end of the page: Cider re-renders its rows when the provider
 * changes, and a node added inside one of them could upset that.
 */
function addVia(page: HTMLElement) {
  const provider = page.querySelector('.lyrics-panel-row')?.textContent?.trim() ?? '';
  if (!provider.startsWith('Community') || !lyricsState.winner) return;
  const via = document.createElement('div');
  via.className = 'cls-via';
  via.setAttribute(MARK, '');
  via.textContent = `Lyrics via ${lyricsState.winner}`;
  page.append(via);
}

function enhance() {
  for (const page of document.querySelectorAll<HTMLElement>('.lyrics-panel-page')) {
    if (page.querySelector(`[${MARK}]`)) continue;
    if (page.querySelector('.lyrics-panel-head')) addPicker(page);
    else addVia(page);
  }
}

let observer: MutationObserver | null = null;
let queued = false;

const PANEL = '.lyrics-platter-panel__surface';

/**
 * The lyrics view animates constantly, so most DOM changes have nothing to do with the menu.
 * Only a change inside the menu, or the menu itself being added, is worth a look.
 */
function touchesPanel(mutation: MutationRecord): boolean {
  if ((mutation.target as Element).closest?.(PANEL)) return true;
  for (const node of mutation.addedNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    if (el.matches(PANEL) || el.querySelector(PANEL)) return true;
  }
  return false;
}

/**
 * Cider's own "Refresh lyrics" row: it asks the provider again, but both Cider's
 * lyric cache and ours would answer first. Clear them just before it runs.
 */
function onRefreshClick(event: MouseEvent) {
  const row = (event.target as Element | null)?.closest<HTMLElement>('button.lyrics-panel-row');
  if (!row || row.closest('.lyrics-panel-group') || row.closest('.lyrics-panel-head') || !row.closest('.lyrics-panel-page')) return;
  forgetLyrics();
  lyricStoreOf()?.lyricStore.splice(0);
}

export function startPanel() {
  if (observer) return;
  addStyle();
  document.addEventListener('click', onRefreshClick, true);
  observer = new MutationObserver((mutations) => {
    if (queued || !mutations.some(touchesPanel)) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhance();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function stopPanel() {
  observer?.disconnect();
  observer = null;
  document.removeEventListener('click', onRefreshClick, true);
  document.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove());
  document.getElementById(STYLE_ID)?.remove();
}
