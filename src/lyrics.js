'use strict';
/* lyrics.js — letras: lrclib (sincronizada) → lyrics.ovh (solo texto). Sin claves. */

/* Marcas de ruido entre paréntesis/corchetes; (Remastered), (Live)... se conservan. */
const BRACKET_NOISE = /official|video|audio|lyrics?|letra|visuali[sz]er|hd|4k|mv|clip/i;

function stripNoise(s) {
  return s
    .replace(/[([]([^)\]]*)[)\]]/g, (m, inner) => (BRACKET_NOISE.test(inner) || /^(feat|ft)\b/i.test(inner.trim()) ? '' : m))
    .replace(/\s+(feat|ft)\.?\s.*$/i, '')
    .replace(/\s+\b(HD|4K)\b\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanTitle(title, channel = '') {
  const t = stripNoise(String(title || ''));
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(t);
  if (m) return { artist: m[1].trim(), track: m[2].trim() };
  const artist = String(channel || '').replace(/\s*-\s*Topic$/i, '').replace(/\s*VEVO$/i, '').trim();
  return { artist, track: t };
}

function parseLrc(text) {
  const out = [];
  for (const raw of String(text || '').split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const line = raw.replace(/\[[^\]]*\]/g, '').trim();
    if (!line) continue;
    for (const s of stamps) out.push({ t: Number(s[1]) * 60 + Number(s[2]), text: line });
  }
  return out.sort((a, b) => a.t - b.t);
}

function createLyrics({ fetchImpl = fetch, max = 200 } = {}) {
  const cache = new Map();

  async function json(url) {
    const r = await fetchImpl(url, { headers: { 'user-agent': 'play-lite/0.1' }, signal: AbortSignal.timeout(6000) });
    return r.ok ? r.json() : null;
  }

  async function lookup({ artist, track, duration }) {
    try {
      const q = new URLSearchParams({ artist_name: artist, track_name: track });
      if (duration) q.set('duration', String(Math.round(duration)));
      const d = await json(`https://lrclib.net/api/get?${q}`);
      if (d && (d.syncedLyrics || d.plainLyrics)) {
        return { synced: d.syncedLyrics ? parseLrc(d.syncedLyrics) : null, plain: d.plainLyrics || null, source: 'lrclib' };
      }
    } catch { /* siguiente fuente */ }
    try {
      const d = await json(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`);
      if (d && d.lyrics) return { synced: null, plain: d.lyrics, source: 'lyrics.ovh' };
    } catch { /* sin letra */ }
    return null;
  }

  async function get({ title, channel, duration }) {
    const { artist, track } = cleanTitle(title, channel);
    if (!track) return null;
    const key = `${artist}|${track}`.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const r = await lookup({ artist, track, duration });
    if (cache.size >= max) cache.delete(cache.keys().next().value);
    cache.set(key, r);
    return r;
  }

  return { get };
}

module.exports = { createLyrics, cleanTitle, parseLrc };
