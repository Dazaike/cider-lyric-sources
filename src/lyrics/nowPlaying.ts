import { reactive } from 'vue';
import { AppleMusic } from '@ciderapp/pluginkit';
import type { LyricsTrack, SourceState } from './repository';
import type { LyricsSourceId } from './sources';

/** The last lookup, for the settings page: which sources answered, and what the interceptor did. */
export const lyricsState = reactive<{
  track: LyricsTrack | null;
  sources: Partial<Record<LyricsSourceId, SourceState>>;
  winner: string | null;
  blocked: string[];
  log: string[];
}>({ track: null, sources: {}, winner: null, blocked: [], log: [] });

/** Keeps the last few interceptor decisions, newest first. */
export function note(message: string) {
  lyricsState.log = [`${new Date().toLocaleTimeString()}  ${message}`, ...lyricsState.log].slice(0, 8);
}

const ISRC = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

/** The fields of Cider's now-playing item that matter here; the host object is loosely typed. */
interface PlayingItem {
  id?: string;
  title?: string;
  name?: string;
  artistName?: string;
  albumName?: string;
  isrc?: string;
  durationInMillis?: number;
  playParams?: { catalogId?: string };
  attributes?: Omit<PlayingItem, 'attributes' | 'id'> & { id?: string };
}

function trackOf(item: PlayingItem | null | undefined): LyricsTrack | null {
  if (!item) return null;
  const attrs = item.attributes ?? {};
  const params = attrs.playParams ?? item.playParams ?? {};
  const title: string | undefined = attrs.name ?? item.title ?? item.name;
  const artist: string | undefined = attrs.artistName ?? item.artistName;
  if (!title || !artist) return null;
  const id = String(params.catalogId ?? item.id ?? attrs.id ?? '');
  const isrc = String(attrs.isrc ?? item.isrc ?? '').replace(/-/g, '').toUpperCase();
  const duration = Number(attrs.durationInMillis ?? item.durationInMillis ?? 0);
  return {
    videoId: id || `${title}|${artist}`,
    // Library songs ("i.xxxx") have no catalogue id; only a numeric id works for the Apple route.
    appleId: /^\d+$/.test(id) ? id : null,
    isrc: ISRC.test(isrc) ? isrc : null,
    title,
    artist,
    album: attrs.albumName ?? item.albumName ?? null,
    durationMs: Number.isFinite(duration) ? duration : 0,
  };
}


/** Every id Cider might key the playing song's cached lyrics by (item id and catalogue id). */
export function playingIds(): string[] {
  try {
    const item = AppleMusic.nowPlayingItem as PlayingItem | null;
    const track = trackOf(item);
    return [...new Set([item?.id, track?.appleId, track?.videoId].filter((id): id is string => !!id))];
  } catch {
    return [];
  }
}

/** The playing track, if `id` is its catalogue id; other songs (prefetches) are left alone. */
export function trackForId(id: string): LyricsTrack | null {
  try {
    const track = trackOf(AppleMusic.nowPlayingItem as PlayingItem | null);
    return track && (track.appleId === id || track.videoId === id) ? track : null;
  } catch {
    return null;
  }
}
