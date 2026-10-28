'use strict';
/* podcasts.js — lista de podcasts guardados (nombre + consulta de búsqueda), en un JSON en disco.
 * Un podcast guardado es solo una búsqueda: al tocarlo se buscan sus episodios en YouTube. */
const path = require('node:path');
const crypto = require('node:crypto');
const { readJson, writeJson } = require('./jsonfile');

const MAX_ITEMS = 50;
const MAX_NAME = 60;
const MAX_QUERY = 100;

const isItem = (x) => x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.q === 'string';

/* Consulta de episodios: se añade "podcast" para que salgan episodios y no clips (salvo que ya lo traiga). */
function episodeQuery(q) {
  const t = String(q || '').trim();
  return /podcast/i.test(t) ? t : t + ' podcast';
}

function createPodcasts({ dir }) {
  const file = path.join(dir, 'podcasts.json');
  const stored = readJson(file, []);
  let items = Array.isArray(stored) ? stored.filter(isItem).map(({ id, name, q }) => ({ id, name, q })) : [];

  const list = () => items.map((x) => ({ ...x }));

  function add(body) {
    const name = body && typeof body.name === 'string' ? body.name.trim() : '';
    const q = body && typeof body.q === 'string' ? body.q.trim() : '';
    if (!name || name.length > MAX_NAME) return { ok: false, error: `El nombre es obligatorio (máx. ${MAX_NAME} caracteres)` };
    if (!q || q.length > MAX_QUERY) return { ok: false, error: `La búsqueda es obligatoria (máx. ${MAX_QUERY} caracteres)` };
    const existing = items.find((x) => x.q.toLowerCase() === q.toLowerCase());
    if (existing) return { ok: true, item: { ...existing }, existed: true };
    if (items.length >= MAX_ITEMS) return { ok: false, error: `Máximo ${MAX_ITEMS} podcasts guardados` };
    const item = { id: crypto.randomBytes(5).toString('hex'), name, q };
    items.push(item);
    try { writeJson(file, items); }
    catch (_) { items.pop(); return { ok: false, error: 'No se pudo guardar en el disco' }; }
    return { ok: true, item: { ...item }, existed: false };
  }

  function remove(id) {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return false;
    const [gone] = items.splice(i, 1);
    try { writeJson(file, items); } catch (_) { items.splice(i, 0, gone); return false; }
    return true;
  }

  return { list, add, remove };
}

module.exports = { createPodcasts, episodeQuery };
