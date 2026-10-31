<script setup lang="ts">
import { LYRICS_SOURCES, sourceById } from "../lyrics/sources";
import { lyricsSettings, moveSource, resetSettings, saveSettings, setEnabled } from "../lyrics/settings";
import { lyricsState } from "../lyrics/nowPlaying";
import { forgetLyrics } from "../lyrics/repository";
const relookup = forgetLyrics;

const rows = computed(() => lyricsSettings.order.map((id) => sourceById(id) ?? LYRICS_SOURCES[0]));
const stateOf = (id: string) => lyricsState.sources[id as keyof typeof lyricsState.sources];

function toggle(id: (typeof LYRICS_SOURCES)[number]["id"], event: Event) {
  setEnabled(id, (event.target as HTMLInputElement).checked);
  relookup();
}
function move(id: (typeof LYRICS_SOURCES)[number]["id"], by: -1 | 1) {
  moveSource(id, by);
  relookup();
}
function onKey() {
  lyricsSettings.paxsenixKey = lyricsSettings.paxsenixKey.trim();
  saveSettings();
}
</script>

<template>
  <div class="q-px-lg plugin-base cls-settings">
    <h3>Lyric sources</h3>
    <p class="hint">
      Sources are tried in this order; word-by-word lyrics always beat line-by-line. Genius is only used when nothing else, not even real community lyrics, has the song.
      They feed Cider's "Community" lyrics provider (word-by-word): pick Community under "Lyrics from", then press "Refresh lyrics". Apple Music, Musixmatch and NetEase stay Cider's own.
    </p>

    <div v-if="lyricsSettings.pinned" class="blocked">Only {{ sourceById(lyricsSettings.pinned)?.label }} is being asked (set in Cider's lyrics menu). Choose "Auto" there to use this list.</div>


    <ul class="sources">
      <li v-for="(row, i) in rows" :key="row.id">
        <input type="checkbox" :checked="!lyricsSettings.disabled.includes(row.id)" @change="toggle(row.id, $event)" />
        <div class="text">
          <strong>{{ row.label }}</strong>
          <small>{{ row.detail }}</small>
        </div>
        <span class="state" v-if="stateOf(row.id)">{{ stateOf(row.id) }}</span>
        <button :disabled="i === 0" @click="move(row.id, -1)">▲</button>
        <button :disabled="i === rows.length - 1" @click="move(row.id, 1)">▼</button>
      </li>
    </ul>

    <label class="key">
      PaxSenix API key (optional, enables the two PaxSenix routes)
      <input type="password" v-model="lyricsSettings.paxsenixKey" @change="onKey" placeholder="not configured" />
    </label>

    <pre v-if="lyricsState.log.length" class="log">{{ lyricsState.log.join("\n") }}</pre>

    <div v-if="lyricsState.blocked.length" class="blocked">
      Blocked by the web view (no CORS headers): {{ lyricsState.blocked.join(", ") }}
    </div>

    <button class="reset" @click="resetSettings(); relookup()">Reset to default</button>
  </div>
</template>

<style scoped>
.cls-settings { display: flex; flex-direction: column; gap: 12px; max-width: 720px; }
.hint { opacity: 0.7; margin: 0; }
.row { display: flex; gap: 8px; align-items: center; }
.sources { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.sources li { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 8px; background: rgba(127, 127, 127, 0.12); }
.text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.text small { opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.state { font-size: 11px; opacity: 0.7; }
button { cursor: pointer; }
.key { display: flex; flex-direction: column; gap: 4px; }
.blocked { font-size: 12px; opacity: 0.7; }
.log { font-size: 11px; opacity: 0.8; white-space: pre-wrap; margin: 0; }
</style>
