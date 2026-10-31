import { withBackgroundVocals, type LyricLine } from './model';
import { lyricsGet } from './http';
import type { Parsed } from './parse';
import * as providers from './providers';
import { enabledSources, lyricsSettings } from './settings';
import { artistForLyricsSearch, forLyricsSearch, sourceById, type LyricsSourceId } from './sources';
import { writeTtml } from './ttml';

/**
 * Where the player gets its lyrics: a port of LyricsRepository.kt.
 *
 * - Every enabled source is asked at the same time, but their answers are
 *   taken in priority order: a lower source finishing first never preempts a
 *   higher one still pending.
 * - A word-timed answer always wins. A line-timed answer is only kept as a
 *   fallback while every source is searched for a word-timed one.
 * - Before anyone is asked, BiniLyrics names the recording (an ISRC, in at
 *   most 2.5 s), so lrc.red and LyricsPlus can ask by recording, not name.
 * - Genius (a scraper) is not in the race; see lookupLyrics.
 */

export interface LyricsTrack {
  /** Stable per-track key. */
  videoId: string;
  /** Apple Music catalogue song id, when known. */
  appleId: string | null;
  /** The recording code from the Apple Music metadata, when present. */
  isrc: string | null;
  title: string;
  artist: string;
  durationMs: number;
  album: string | null;
}

export interface LyricsResult {
  source: LyricsSourceId;
  label: string;
  lines: LyricLine[];
  /** What am-lyrics renders: the provider's own TTML, or ours written from the lines. */
  ttml: string;
  wordSynced: boolean;
  synced: boolean;
}

/** One provider's part in a lookup, for the provider picker. */
export type SourceState = 'pending' | 'found' | 'missing';

const IDENTIFY_TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 12 * 60 * 60_000;

/** The recording behind a video id, once something worked it out (bounded, memory only). */
const isrcs = new Map<string, string>();
function remember(videoId: string, isrc: string | null | undefined) {
  if (!isrc || !videoId) return;
  isrcs.delete(videoId);
  isrcs.set(videoId, isrc);
  if (isrcs.size > 100) isrcs.delete(isrcs.keys().next().value!);
}

/** A miss is retried soon: it is often a source being down, not a song with no lyrics. */
const MISS_TTL_MS = 60_000;

const cache = new Map<string, { at: number; result: LyricsResult | null }>();

/** Drops every remembered answer: a newly allowed host may have what was missing. */
export function forgetLyrics() {
  cache.clear();
}

function toResult(source: LyricsSourceId, parsed: Parsed): LyricsResult {
  const lines = withBackgroundVocals(parsed.lines);
  return {
    source,
    label: sourceById(source)?.label ?? source,
    lines,
    ttml: parsed.ttml ?? writeTtml(lines),
    wordSynced: lines.some((l) => l.words.length),
    synced: lines.some((l) => l.timeMs > 0 || l.words.length),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export interface LookupOptions {
  /** Ask this one provider only: the panel's provider picker. */
  only?: LyricsSourceId;
  onSource?: (source: LyricsSourceId, state: SourceState) => void;
}

/** Lookups already running, so repeated requests for the same song share one. */
const inflight = new Map<string, Promise<LyricsResult | null>>();

/**
 * Genius is plain text from a scraper, so it is never part of the race: callers ask it on its own
 * (`only: 'genius'`) once everything else has missed.
 */
export function lookupLyrics(track: LyricsTrack, options: LookupOptions = {}): Promise<LyricsResult | null> {
  const { only } = options;
  const sequence = only ? [only] : enabledSources().filter((id) => id !== 'genius');
  if (!sequence.length) return Promise.resolve(null);
  const key = `${track.videoId}|${track.durationMs}|${track.title}|${track.artist}|${only ?? ''}|${sequence.join(',')}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < (cached.result ? CACHE_TTL_MS : MISS_TTL_MS)) return Promise.resolve(cached.result);
  let job = inflight.get(key);
  if (!job) {
    job = search(track, options, sequence, key).finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  return job;
}

async function search(track: LyricsTrack, { onSource }: LookupOptions, sequence: LyricsSourceId[], key: string): Promise<LyricsResult | null> {
  const { paxsenixKey } = lyricsSettings;

  const query: providers.LyricsQuery = {
    videoId: track.videoId,
    appleId: track.appleId,
    title: forLyricsSearch(track.title),
    artist: artistForLyricsSearch(track.artist),
    durationMs: track.durationMs,
    album: track.album,
    isrc: track.isrc ?? isrcs.get(track.videoId) ?? null,
  };
  let hit: providers.BiniHit | null = null;
  if (!query.isrc && sequence.includes('bini')) {
    hit = await withTimeout(providers.biniIdentify(query).catch(() => null), IDENTIFY_TIMEOUT_MS);
    if (hit?.isrc) {
      remember(track.videoId, hit.isrc);
      query.isrc = hit.isrc;
    }
  }

  const documents = new Map<string, Promise<string | null>>();
  const get: providers.SharedGet = (url) => {
    let pending = documents.get(url);
    if (!pending) {
      pending = lyricsGet(url);
      documents.set(url, pending);
    }
    return pending;
  };

  const fetchFrom = (source: LyricsSourceId): Promise<Parsed | null> => {
    switch (source) {
      case 'lrc-red':
        return providers.lrcRed(query, get);
      case 'bini':
        return providers.bini(query, get, hit).then((found) => {
          remember(track.videoId, found?.isrc);
          return found;
        });
      case 'better-lyrics':
        return providers.betterLyrics(query);
      case 'better-lyrics-portato':
        return providers.betterLyricsPortato(query);
      case 'paxsenix':
        return providers.paxSenix(query);
      case 'paxsenix-spotify':
        return providers.paxSenixSpotify(query, paxsenixKey);
      case 'paxsenix-musixmatch':
        return providers.paxSenixMusixmatch(query, paxsenixKey);
      case 'lyrics-plus':
        return providers.lyricsPlus(query);
      case 'unison':
        return providers.unison(query);
      case 'kugou':
        return providers.kugou(query);
      case 'lrclib':
        return providers.lrclib(query);
      case 'musixmatch':
        return providers.musixmatch(query);
      case 'genius':
        return providers.genius(query);
    }
  };

  const run = (source: LyricsSourceId) => {
    onSource?.(source, 'pending');
    return fetchFrom(source)
      .catch(() => null)
      .then((parsed) => {
        const result = parsed?.lines.some((l) => l.text.trim()) ? toResult(source, parsed) : null;
        onSource?.(source, result ? 'found' : 'missing');
        return result;
      });
  };

  let lineSynced: LyricsResult | null = null;
  let plain: LyricsResult | null = null;
  let winner: LyricsResult | null = null;
  const racing = sequence.map((source) => run(source));
  for (const job of racing) {
    const found = await job;
    if (!found) continue;
    // Word timing always wins; a line-timed answer only stands if no source has words.
    if (found.wordSynced) {
      winner = found;
      break;
    }
    if (found.synced) lineSynced ??= found;
    else plain ??= found;
  }
  winner ??= lineSynced ?? plain;
  cache.set(key, { at: Date.now(), result: winner });
  return winner;
}
