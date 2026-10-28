'use strict';
/* timesync.js — hora real cuando el reloj del equipo está mal.
 * La Raspberry Pi no tiene reloj de hardware y, si la red bloquea NTP, su hora se atrasa. Los servidores HTTPS a los
 * que sí llega (YouTube, Google) mandan la hora real en la cabecera `Date`: de ahí se calcula el desfase.
 * No toca el reloj del sistema (eso pide root); solo sirve para MOSTRAR la hora correcta. */

const DEFAULT_SOURCES = ['https://www.youtube.com/', 'https://www.google.com/', 'https://i.ytimg.com/'];
const MIN_PLAUSIBLE = Date.UTC(2020, 0, 1);

function createTimeSync({ fetchImpl = fetch, now = Date.now, sources = DEFAULT_SOURCES, timeoutMs = 5000 } = {}) {
  let offset = 0;
  let synced = false;
  let source = null;
  let at = null;

  async function sync() {
    for (const url of sources) {
      try {
        const t0 = now();
        const r = await fetchImpl(url, { method: 'HEAD', signal: AbortSignal.timeout(timeoutMs) });
        const t1 = now();
        const header = r && r.headers && r.headers.get('date');
        const ms = header ? Date.parse(header) : NaN;
        if (!Number.isFinite(ms) || ms < MIN_PLAUSIBLE) continue;
        /* La cabecera Date llega redondeada a segundos hacia abajo (+0,5 s de media) y la respuesta tardó t1-t0:
         * la hora del servidor corresponde a la mitad de la petición. */
        offset = ms + 500 - Math.round((t0 + t1) / 2);
        synced = true;
        source = url;
        at = t1;
        return { ok: true, offset, source };
      } catch (_) { /* fuente bloqueada o lenta: se prueba la siguiente */ }
    }
    return { ok: false };
  }

  const current = () => now() + offset;
  const info = () => ({ offset, synced, source, at });

  /* Sincroniza al arrancar y cada cierto tiempo (el reloj sin hardware se desvía despacio). */
  function start(intervalMs = 10 * 60 * 1000) {
    sync();
    const t = setInterval(sync, intervalMs);
    if (t.unref) t.unref();
    return t;
  }

  return { sync, current, info, start };
}

module.exports = { createTimeSync };
