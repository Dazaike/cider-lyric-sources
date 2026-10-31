# Cider Lyric Sources

Cider 2 plugin that feeds Cider's own lyrics view from an ordered list of sources (lrc.red, BiniLyrics, BetterLyrics,
LyricsPlus, Unison, KuGou, LRCLIB, Musixmatch, Genius, PaxSenix), so the immersive layout you already use keeps working.

Cider has no lyric-provider API, so the plugin answers the request of its built-in **Community** provider. Apple Music,
Musixmatch and NetEase are untouched: each entry in "Lyrics from" stays what its name says, and Community means "my sources".

- Word-by-word lyrics survive (Community carries a TTML document).
- Plain text (Genius) gets estimated line timing so it scrolls like any lyric.
- Community picks, best first: word-by-word from any source (or real community lyrics if word-timed), then line-by-line from a source, then real community lyrics, and Genius only when nothing else has the song.

A "Lyric source" dropdown is added to the lyrics menu ("Lyrics from" page) to pin one source or use them all in order.
Order and on/off live in Settings → Extensions → Lyric Sources, which also logs what the plugin last did.

Current version: **v0.1.2**. See [CHANGELOG.md](CHANGELOG.md).

## Install

Download `daz-public-sources-lr.zip` from the [latest release](https://github.com/Dazaike/cider-lyric-sources/releases/latest),
extract it into `%APPDATA%\sh.cider.dotnet\plugins\daz-public-sources-lr\`, then restart Cider.

## License

Provider code is ported from [BitChord](https://github.com/kushagrasinghx/BitChord) (GPL-3.0), so this plugin is GPL-3.0
(`LICENSE`). The build setup comes from Cider's plugin template (MIT, `LICENSE-plugin-template-MIT`).

## Build

    npm install
    npm run build        # dist/
    # copy dist/plugin.js + dist/plugin.yml to %APPDATA%\sh.cider.dotnet\plugins\daz-public-sources-lr\
