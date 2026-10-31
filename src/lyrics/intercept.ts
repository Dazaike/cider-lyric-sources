import { lookupLyrics, type LyricsResult, type LyricsTrack, type SourceState } from './repository';
import { enabledSources, lyricsSettings } from './settings';
import type { LyricsSourceId } from './sources';
import { blockedHosts } from './http';
import { lyricsState, note, trackForId } from './nowPlaying';
import { line, type LyricLine } from './model';
import { writeTtml } from './ttml';

/**
 * Cider has no public lyric-provider hook, but its built-in "Community" provider is one plain `fetch`
 * (GET exp-rise.cider.sh/api/v1/lyrics/user/<song id>) that answers `{ ttml, syncType, writers, contributorName }`.
 * This answers that call from the user's own source list, so the lyrics go through Cider's own renderer
 * (word-by-word included) and the layout the user already has. Apple Music, Musixmatch and NetEase are left
 * alone: each Cider entry stays what its name says, and Community is the one that means "my sources".
 */

const ttmls = new WeakMap<LyricsResult, string>();
/** The TTML Cider reads for a result, written once however many times it is asked for. */
function ttmlOf(result: LyricsResult): string {
  let ttml = ttmls.get(result);
  if (!ttml) {
    ttml = writeTtml(result.lines);
    ttmls.set(result, ttml);
  }
  return ttml;
}

/**
 * Plain lyrics have no times, so each line gets an estimated one: the lines share the song's length in
 * proportion to their text. It follows the song roughly and scrolls like any lyric, instead of one block
 * that Cider keeps re-centring. Section headers like "[Chorus]" are dropped.
 */
function spreadLines(result: LyricsResult, durationMs: number): LyricLine[] {
  const texts = result.lines.map((l) => l.text.trim()).filter((t) => t && !/^\[[^\]]*\]$/.test(t));
  const weight = (text: string) => text.length + 8;
  const total = texts.reduce((sum, t) => sum + weight(t), 0);
  const length = durationMs > 0 ? durationMs : 180_000;
  const span = length * 0.9;
  let at = length * 0.04;
  return texts.map((text) => {
    const share = (weight(text) / total) * span;
    const entry = line(Math.round(at), text, { sungUntilMs: Math.round(at + share) });
    at += share;
    return entry;
  });
}

const timingOf = (result: LyricsResult) => (result.wordSynced ? 'word' : result.synced ? 'line' : 'plain (estimated line timing)');

/** The TTML Cider reads: the result's own, or for untimed text the estimated lines. */
function documentOf(result: LyricsResult, track: LyricsTrack): string {
  return result.synced ? ttmlOf(result) : writeTtml(spreadLines(result, track.durationMs));
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const report = (source: LyricsSourceId, state: SourceState) => (lyricsState.sources[source] = state);

/** Cider's real community lyrics for the song, if it has any. */
interface RealCommunity {
  ttml?: string;
  syncType?: string;
  language?: string;
  writers?: string[];
  contributorName?: string;
}

async function realCommunity(real: typeof window.fetch, input: RequestInfo | URL, init: RequestInit | undefined): Promise<RealCommunity | null> {
  try {
    const response = await real(input, init);
    if (!response.ok) return null;
    const body = (await response.json()) as RealCommunity & { code?: string };
    return body.ttml && body.code !== 'NOT_FOUND' ? body : null;
  } catch {
    return null;
  }
}

/**
 * With word-by-word lyrics on, Cider rejects any Community lyrics not declared "syllable" before it even
 * reads them, so everything is declared that way; Cider then shows the timing the document really has.
 */
const answer = (ttml: string, contributorName: string, language = 'en', writers: string[] = []) =>
  json({ ttml, syncType: 'syllable', language, writers, contributorName });

const isWordTimed = (community: RealCommunity) => community.syncType === 'syllable' || community.syncType === 'word';

/**
 * What Community shows, best first:
 * 1. word-by-word lyrics from any source, or Cider's real community lyrics if those are word-by-word;
 * 2. line-by-line lyrics from a source, then real community lyrics;
 * 3. Genius, only when nothing above has the song.
 * A source pinned in the lyrics menu is asked alone, with no fallbacks.
 */
async function communityLyrics(real: typeof window.fetch, input: RequestInfo | URL, init: RequestInit | undefined, id: string) {
  const track = trackForId(id);
  if (!track) return real(input, init);
  lyricsState.track = track;
  lyricsState.sources = {};
  lyricsState.winner = null;
  const pinned = lyricsSettings.pinned;

  const [result, community] = await Promise.all([
    lookupLyrics(track, { onSource: report }),
    pinned ? Promise.resolve(null) : realCommunity(real, input, init),
  ]);
  lyricsState.blocked = [...blockedHosts];

  const serve = (found: LyricsResult) => {
    lyricsState.winner = found.label;
    note(`Community lyrics for ${track.title}: served ${found.label}, ${timingOf(found)} timing`);
    return answer(documentOf(found, track), found.label);
  };
  const serveCommunity = (found: RealCommunity) => {
    lyricsState.winner = 'community lyrics';
    note(`Community lyrics for ${track.title}: real community lyrics, ${isWordTimed(found) ? 'word' : 'line'} timing`);
    return answer(found.ttml!, found.contributorName ?? 'Community', found.language, found.writers);
  };

  if (result?.wordSynced) return serve(result);
  if (community && isWordTimed(community)) return serveCommunity(community);
  if (result?.synced) return serve(result);
  if (community) return serveCommunity(community);
  if (result) return serve(result);

  if (enabledSources().includes('genius')) {
    const genius = await lookupLyrics(track, { only: 'genius', onSource: report });
    if (genius) return serve(genius);
  }
  note(`Community lyrics for ${track.title}: nothing found`);
  return json({ code: 'NOT_FOUND' });
}

const COMMUNITY_LYRICS = /^https:\/\/exp-rise\.cider\.sh\/api\/v1\/lyrics\/user\/([^/?]+)(?:\?|$)/;

let original: typeof window.fetch | null = null;

export function startIntercept() {
  if (original) return;
  const real = window.fetch.bind(window);
  original = window.fetch;
  window.fetch = (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const community = COMMUNITY_LYRICS.exec(href);
    if (community) return communityLyrics(real, input, init, decodeURIComponent(community[1]!));
    return real(input, init);
  };
}

export function stopIntercept() {
  if (original) window.fetch = original;
  original = null;
}
