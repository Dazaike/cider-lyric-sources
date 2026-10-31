/**
 * Plugin configuration.
 */
export default {
  /** Custom element prefix, must be unique */
  ce_prefix: 'cls',
  identifier: 'dev.kingm.cider-lyric-sources',
  name: 'Lyric Sources',
  description: "Lyrics from lrc.red, BiniLyrics, LRCLIB, KuGou, Genius and more, through Cider's Community lyrics provider.",
  version: '0.1.1',
  author: 'Dazaike',
  repo: 'https://github.com/Dazaike/cider-lyric-sources',
  pluginKitVersion: '4.0.0',
  entry: {
    'plugin.js': {
      type: 'main',
    },
  },
};
