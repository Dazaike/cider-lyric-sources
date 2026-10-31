# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [v0.1.1] - 2026-10-31

First published release (no earlier tags or history).

### Added
- Lyrics for Cider's **Community** provider from an ordered list of sources: lrc.red, BiniLyrics, BetterLyrics,
  BetterLyrics Portato, PaxSenix (plus its keyed Spotify and Musixmatch routes), LyricsPlus, Unison, KuGou, LRCLIB,
  Musixmatch and Genius. Provider code is ported from BitChord (GPL-3.0).
- Selection order: word-by-word from any source (or Cider's real community lyrics when word-timed), then line-by-line
  from a source, then real community lyrics, then Genius only when nothing else has the song.
- Genius plain text gets estimated line timing so it scrolls like a normal lyric; section headers are dropped.
- "Lyric source" picker in Cider's lyrics menu ("Lyrics from" page) to pin one source or use all in order, styled like
  the menu; picking a source or pressing "Refresh lyrics" clears Cider's lyric cache and the plugin's so the song is
  looked up again. A "Lyrics via <source>" note shows which source supplied Community's lyrics.
- Settings page (Settings → Extensions → Lyric Sources): reorder and enable sources, PaxSenix API key, per-source
  status for the last lookup, hosts blocked by the web view, and a log of the plugin's recent decisions.
- Concurrent requests for the same song share one lookup; results are cached for 12 hours, misses for 1 minute.

### Notes
- Apple Music, Musixmatch and NetEase in "Lyrics from" are left as Cider's own providers.
- Uses undocumented Cider internals (the Community request and the `lyric-store` Pinia store); a Cider update may break it.
