'use strict';
/* control.js — control remoto: órdenes hacia la pantalla (SSE) y estado que ella reporta.
 * La música suena en el navegador de la Pi, así que el servidor no reproduce nada:
 * reenvía las órdenes a la página abierta y guarda lo que la página dice que está sonando. */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const TRACK_KINDS = new Set(['search', 'podcast']);
const SIMPLE = new Set(['toggle', 'play', 'pause', 'next', 'prev', 'random', 'mute', 'lyrics']);

/* Valida una orden y devuelve SOLO los campos permitidos. */
function validateCommand(body, genreIds) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Orden inválida' };
  const cmd = body.cmd;
  if (SIMPLE.has(cmd)) return { ok: true, cmd: { cmd } };
  if (cmd === 'genre') {
    if (typeof body.id !== 'string' || !genreIds.has(body.id)) return { ok: false, error: 'Género desconocido' };
    return { ok: true, cmd: { cmd, id: body.id } };
  }
  if (cmd === 'volume') {
    if (Number.isFinite(body.set)) {
      return body.set >= 0 && body.set <= 100 ? { ok: true, cmd: { cmd, set: Math.round(body.set) } } : { ok: false, error: 'Volumen fuera de 0-100' };
    }
    if (Number.isFinite(body.delta)) {
      return Math.abs(body.delta) <= 100 ? { ok: true, cmd: { cmd, delta: Math.round(body.delta) } } : { ok: false, error: 'Cambio de volumen fuera de ±100' };
    }
    return { ok: false, error: 'Falta set o delta' };
  }
  if (cmd === 'mode') {
    return body.mode === 'audio' || body.mode === 'video' ? { ok: true, cmd: { cmd, mode: body.mode } } : { ok: false, error: 'Modo inválido' };
  }
  if (cmd === 'track') {
    const t = body.track;
    const kind = body.kind === undefined ? 'search' : body.kind;
    if (!TRACK_KINDS.has(kind)) return { ok: false, error: 'Tipo inválido' };
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !VIDEO_ID.test(t.id)) return { ok: false, error: 'ID de video inválido' };
    const title = typeof t.title === 'string' ? t.title.trim() : '';
    if (!title || title.length > 300) return { ok: false, error: 'Título vacío o de más de 300 caracteres' };
    const channel = typeof t.channel === 'string' ? t.channel.slice(0, 200) : '';
    if (t.duration !== undefined && !(Number.isFinite(t.duration) && t.duration >= 0 && t.duration <= 1e5)) return { ok: false, error: 'Duración inválida' };
    return { ok: true, cmd: { cmd, kind, track: { id: t.id, title, channel, duration: t.duration === undefined ? 0 : t.duration } } };
  }
  if (cmd === 'search') {
    const q = typeof body.q === 'string' ? body.q.trim() : '';
    return q && q.length <= 100 ? { ok: true, cmd: { cmd, q } } : { ok: false, error: 'Búsqueda vacía o de más de 100 caracteres' };
  }
  return { ok: false, error: 'Orden desconocida' };
}

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* Géneros que coinciden con el texto: primero los que empiezan por él. Máx. 30. */
function searchGenres(genres, q) {
  const t = fold(q).trim();
  if (!t) return [];
  const hits = [];
  for (const g of genres) {
    const label = fold(g.label);
    const id = fold(g.id);
    if (label.startsWith(t) || id.startsWith(t)) hits.push({ g, rank: 0 });
    else if (label.includes(t) || id.includes(t)) hits.push({ g, rank: 1 });
  }
  hits.sort((a, b) => a.rank - b.rank);
  return hits.slice(0, 30).map(({ g }) => ({ id: g.id, label: g.label, emoji: g.emoji }));
}

function createControl({ keepAliveMs = 25000, now = Date.now } = {}) {
  const subs = new Map(); /* res → { ip, agent, since } de cada pantalla conectada */
  let state = {};

  function subscribe(res, meta = {}) {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write(': conectado\n\n');
    subs.set(res, { ip: meta.ip || '', agent: meta.agent || 'Desconocido', since: now() });
    res.on('close', () => subs.delete(res));
  }

  /* Devuelve a cuántas pantallas llegó. */
  function send(cmd) {
    const line = `data: ${JSON.stringify(cmd)}\n\n`;
    let n = 0;
    for (const res of [...subs.keys()]) { try { res.write(line); n++; } catch (_) { subs.delete(res); } }
    return n;
  }

  function setState(s) { state = { ...s }; state.__t = now(); }
  function getState() {
    const { __t, ...rest } = state;
    return { ...rest, players: subs.size, updated: __t || null };
  }

  if (keepAliveMs > 0) {
    const t = setInterval(() => { for (const res of [...subs.keys()]) { try { res.write(': latido\n\n'); } catch (_) { subs.delete(res); } } }, keepAliveMs);
    if (t.unref) t.unref();
  }

  const getScreens = () => [...subs.values()].map((s) => ({ ...s }));

  return { subscribe, send, setState, getState, getScreens };
}

module.exports = { createControl, validateCommand, searchGenres };
