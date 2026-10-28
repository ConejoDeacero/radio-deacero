'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createControl, validateCommand, searchGenres } = require('../src/control');

const GENRES = new Set(['jazz', 'rock']);
const v = (body) => validateCommand(body, GENRES);

test('validateCommand: órdenes simples', () => {
  for (const cmd of ['toggle', 'play', 'pause', 'next', 'prev', 'random', 'mute', 'lyrics']) {
    assert.deepEqual(v({ cmd }), { ok: true, cmd: { cmd } }, cmd);
  }
});

test('validateCommand: genre exige un id que exista', () => {
  assert.deepEqual(v({ cmd: 'genre', id: 'jazz' }), { ok: true, cmd: { cmd: 'genre', id: 'jazz' } });
  assert.equal(v({ cmd: 'genre', id: 'nope' }).ok, false);
  assert.equal(v({ cmd: 'genre' }).ok, false);
});

test('validateCommand: volume por valor o por delta, acotado', () => {
  assert.deepEqual(v({ cmd: 'volume', set: 40 }).cmd, { cmd: 'volume', set: 40 });
  assert.deepEqual(v({ cmd: 'volume', delta: -10 }).cmd, { cmd: 'volume', delta: -10 });
  assert.equal(v({ cmd: 'volume', set: 101 }).ok, false);
  assert.equal(v({ cmd: 'volume', set: -1 }).ok, false);
  assert.equal(v({ cmd: 'volume', delta: 500 }).ok, false);
  assert.equal(v({ cmd: 'volume' }).ok, false);
  assert.equal(v({ cmd: 'volume', set: 'alto' }).ok, false);
});

test('validateCommand: mode y search', () => {
  assert.equal(v({ cmd: 'mode', mode: 'video' }).ok, true);
  assert.equal(v({ cmd: 'mode', mode: 'hd' }).ok, false);
  assert.deepEqual(v({ cmd: 'search', q: '  bad bunny ' }).cmd, { cmd: 'search', q: 'bad bunny' });
  assert.equal(v({ cmd: 'search', q: '   ' }).ok, false);
  assert.equal(v({ cmd: 'search', q: 'x'.repeat(101) }).ok, false);
});

test('validateCommand: descarta lo desconocido y los campos de más', () => {
  assert.equal(v({ cmd: 'reiniciar' }).ok, false);
  assert.equal(v(null).ok, false);
  assert.equal(v('next').ok, false);
  assert.deepEqual(v({ cmd: 'next', extra: 'x', __proto__: { a: 1 } }).cmd, { cmd: 'next' });
});

/* res falso para SSE */
function fakeRes() {
  const r = { chunks: [], head: null, closeCb: null };
  r.writeHead = (code, h) => { r.head = { code, h }; };
  r.write = (c) => { r.chunks.push(String(c)); return true; };
  r.on = (ev, cb) => { if (ev === 'close') r.closeCb = cb; };
  return r;
}

test('control: los suscriptores reciben las órdenes como eventos SSE', () => {
  const c = createControl({ keepAliveMs: 0 });
  const a = fakeRes();
  const b = fakeRes();
  c.subscribe(a);
  c.subscribe(b);
  assert.equal(a.head.code, 200);
  assert.equal(a.head.h['content-type'], 'text/event-stream');

  assert.equal(c.send({ cmd: 'next' }), 2);
  assert.ok(a.chunks.join('').includes('data: {"cmd":"next"}\n\n'));
  assert.ok(b.chunks.join('').includes('data: {"cmd":"next"}\n\n'));
});

test('control: al cerrarse un suscriptor deja de recibir y se cuenta', () => {
  const c = createControl({ keepAliveMs: 0 });
  const a = fakeRes();
  c.subscribe(a);
  assert.equal(c.getState().players, 1);
  a.closeCb();
  assert.equal(c.getState().players, 0);
  assert.equal(c.send({ cmd: 'next' }), 0);
});

test('control: guarda y devuelve el estado que reporta la pantalla', () => {
  const c = createControl({ keepAliveMs: 0, now: () => 1234 });
  c.setState({ paused: false, volume: 70, track: { id: 'a'.repeat(11), title: 'T' } });
  assert.deepEqual(c.getState(), { paused: false, volume: 70, track: { id: 'a'.repeat(11), title: 'T' }, players: 0, updated: 1234 });
});

test('searchGenres: sin acentos ni mayúsculas, por etiqueta o id, acotado', () => {
  const list = [
    { id: 'cafe-jazz', label: 'Café Jazz', emoji: '☕' },
    { id: 'jazz', label: 'Jazz & Soul', emoji: '🎷' },
    { id: 'rock', label: 'Rock', emoji: '🎸' },
    ...Array.from({ length: 50 }, (_, i) => ({ id: `jz${i}`, label: `Jazz ${i}`, emoji: '🎵' }))
  ];
  assert.deepEqual(searchGenres(list, 'CAFE').map((g) => g.id), ['cafe-jazz']);
  assert.equal(searchGenres(list, 'jazz').length, 30, 'tope de 30');
  assert.equal(searchGenres(list, 'jazz')[0].id, 'jazz', 'primero los que empiezan por el texto');
  assert.deepEqual(searchGenres(list, ''), []);
  assert.deepEqual(Object.keys(searchGenres(list, 'rock')[0]).sort(), ['emoji', 'id', 'label']);
});

test('validateCommand: track (una canción o episodio concreto)', () => {
  const t = { id: 'a'.repeat(11), title: 'Episodio 12', channel: 'Mi podcast', duration: 3600 };
  assert.deepEqual(v({ cmd: 'track', kind: 'podcast', track: t }), { ok: true, cmd: { cmd: 'track', kind: 'podcast', track: t } });
  assert.equal(v({ cmd: 'track', track: t }).cmd.kind, 'search', 'por defecto es una pauta de búsqueda');
  assert.deepEqual(v({ cmd: 'track', track: { ...t, evil: 1 } }).cmd.track, t, 'quita campos de más');
  assert.equal(v({ cmd: 'track', kind: 'otra', track: t }).ok, false);
  assert.equal(v({ cmd: 'track', track: { ...t, id: 'corto' } }).ok, false);
  assert.equal(v({ cmd: 'track', track: { ...t, title: '' } }).ok, false);
  assert.equal(v({ cmd: 'track', track: { ...t, title: 'x'.repeat(301) } }).ok, false);
  assert.equal(v({ cmd: 'track', track: { ...t, duration: 'mucho' } }).ok, false);
  assert.equal(v({ cmd: 'track' }).ok, false);
});

test('control: las pantallas conectadas guardan sus datos (IP, equipo, desde cuándo)', () => {
  const c = createControl({ keepAliveMs: 0, now: () => 5000 });
  const a = fakeRes();
  const b = fakeRes();
  c.subscribe(a, { ip: '127.0.0.1', agent: 'Raspberry Pi / Linux ARM (Chrome)' });
  c.subscribe(b, { ip: '10.0.0.5', agent: 'PC Windows (Edge)' });
  assert.deepEqual(c.getScreens(), [
    { ip: '127.0.0.1', agent: 'Raspberry Pi / Linux ARM (Chrome)', since: 5000 },
    { ip: '10.0.0.5', agent: 'PC Windows (Edge)', since: 5000 }
  ]);
  a.closeCb();
  assert.deepEqual(c.getScreens().map((s) => s.ip), ['10.0.0.5']);
  const d = fakeRes();
  c.subscribe(d); // sin datos: no revienta
  assert.equal(c.getScreens().length, 2);
});
