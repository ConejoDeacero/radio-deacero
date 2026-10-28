'use strict';
/* thumb.js — carátulas de YouTube servidas desde aquí (la red puede bloquear ytimg.com). */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const VARIANTS = ['hq720.jpg', 'mqdefault.jpg'];

function createThumbs({ fetchImpl = fetch, max = 80 } = {}) {
  const cache = new Map();

  async function get(id) {
    if (typeof id !== 'string' || !VIDEO_ID.test(id)) return null;
    if (cache.has(id)) return cache.get(id);
    for (const v of VARIANTS) {
      try {
        const r = await fetchImpl(`https://i.ytimg.com/vi/${id}/${v}`, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) continue;
        const t = { type: r.headers.get('content-type') || 'image/jpeg', body: Buffer.from(await r.arrayBuffer()) };
        if (cache.size >= max) cache.delete(cache.keys().next().value);
        cache.set(id, t);
        return t;
      } catch { /* probar la siguiente variante */ }
    }
    return null;
  }

  return { get, size: () => cache.size };
}

module.exports = { createThumbs };
