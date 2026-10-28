'use strict';
/* history.js — historial de búsquedas del control remoto (quién buscó qué y cuándo), guardado en disco.
 * La hora que se muestra es la del CLIENTE (`at`): la Pi no sincroniza su reloj y suele estar atrasada. */
const path = require('node:path');
const crypto = require('node:crypto');
const { readJson, writeJson } = require('./jsonfile');
const { cleanUser, cleanIp } = require('./clients');

const KINDS = new Set(['song', 'podcast', 'episode', 'genre']);
const MAX_TEXT = 200;
const DEDUPE_MS = 30 * 1000;
const MIN_AT = 1.5e12; /* ~2017 */
const MAX_AT = 4.1e12; /* ~2100 */

const isEntry = (x) => x && typeof x.id === 'string' && KINDS.has(x.kind) && typeof x.text === 'string' && Number.isFinite(x.at);

function createHistory({ dir, now = Date.now, max = 200 }) {
  const file = path.join(dir, 'history.json');
  const stored = readJson(file, []);
  let items = Array.isArray(stored) ? stored.filter(isEntry).slice(-max) : [];
  const recent = new Map(); /* kind|usuario|texto → hora del servidor de la última vez (anti-repetidos) */

  function save() {
    try { writeJson(file, items); } catch (_) { /* el historial sigue en memoria si el disco falla */ }
  }

  function add(arg) {
    const { kind, text, user, ip, at } = arg || {};
    if (!KINDS.has(kind)) return null;
    const t = String(text == null ? '' : text).trim().slice(0, MAX_TEXT);
    if (!t) return null;
    const u = cleanUser(user);
    const key = `${kind}|${u || ''}|${t.toLowerCase()}`;
    const nowMs = now();
    if (recent.has(key) && nowMs - recent.get(key) < DEDUPE_MS) return null;
    recent.set(key, nowMs);
    if (recent.size > 500) recent.delete(recent.keys().next().value);

    const when = Number.isFinite(at) && at > MIN_AT && at < MAX_AT ? at : nowMs;
    const entry = { id: crypto.randomBytes(4).toString('hex'), kind, text: t, user: u, ip: ip ? cleanIp(ip) : null, at: when };
    items.push(entry);
    if (items.length > max) items = items.slice(-max);
    save();
    return { ...entry };
  }

  const list = (limit = 100) => items.slice().reverse().slice(0, Math.max(1, limit)).map((x) => ({ ...x }));

  function clear() {
    items = [];
    recent.clear();
    save();
    return true;
  }

  return { add, list, clear };
}

module.exports = { createHistory };
