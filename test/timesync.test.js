'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTimeSync } = require('../src/timesync');

/* respuesta falsa con cabecera Date */
const res = (date) => ({ ok: true, status: 200, headers: { get: (h) => (h.toLowerCase() === 'date' ? date : null) } });
const REAL = 'Wed, 28 Oct 2026 18:00:00 GMT';
const REAL_MS = Date.parse(REAL);

function mk(fetchImpl, startLocal = 1_000_000) {
  let t = startLocal;
  const clock = { now: () => t, set: (v) => { t = v; }, advance: (ms) => { t += ms; } };
  return { ts: createTimeSync({ fetchImpl, now: clock.now, sources: ['https://a.example', 'https://b.example'] }), clock };
}

test('sin sincronizar: offset 0 y synced false', () => {
  const { ts } = mk(async () => res(REAL));
  assert.deepEqual({ ...ts.info(), at: null }, { offset: 0, synced: false, source: null, at: null });
  assert.equal(ts.current(), 1_000_000);
});

test('sync: calcula el desfase con la hora de la respuesta (Date + 0,5 s por el redondeo a segundos)', async () => {
  const { ts } = mk(async () => res(REAL), 1_000_000);
  const r = await ts.sync();
  assert.equal(r.ok, true);
  assert.equal(ts.info().synced, true);
  assert.equal(ts.info().offset, REAL_MS + 500 - 1_000_000);
  assert.equal(ts.current(), REAL_MS + 500, 'current() devuelve la hora real');
});

test('sync: usa el punto medio de la petición (compensa la latencia)', async () => {
  let t0;
  const { ts, clock } = mk(async () => { clock.advance(200); return res(REAL); }, 5_000_000);
  await ts.sync();
  // la petición duró 200 ms: la hora del servidor corresponde a mitad → t0 + 100
  assert.equal(ts.info().offset, REAL_MS + 500 - (5_000_000 + 100));
});

test('sync: si la primera fuente falla prueba la siguiente', async () => {
  const urls = [];
  const { ts } = mk(async (u) => { urls.push(u); if (u.includes('a.example')) throw new Error('bloqueado'); return res(REAL); });
  const r = await ts.sync();
  assert.equal(r.ok, true);
  assert.deepEqual(urls.map((u) => new URL(u).hostname), ['a.example', 'b.example']);
  assert.match(ts.info().source, /b\.example/);
});

test('sync: ignora respuestas sin Date o con fecha absurda', async () => {
  const { ts } = mk(async (u) => (u.includes('a.example') ? res(null) : res('Mon, 01 Jan 2001 00:00:00 GMT')));
  const r = await ts.sync();
  assert.equal(r.ok, false);
  assert.equal(ts.info().synced, false);
});

test('sync: si todas fallan, conserva el desfase anterior', async () => {
  let fail = false;
  const { ts } = mk(async () => { if (fail) throw new Error('sin red'); return res(REAL); });
  await ts.sync();
  const before = ts.info().offset;
  fail = true;
  const r = await ts.sync();
  assert.equal(r.ok, false);
  assert.equal(ts.info().offset, before);
  assert.equal(ts.info().synced, true, 'sigue sincronizada con el último dato bueno');
});

test('usa HEAD con tiempo límite', async () => {
  let opts;
  const { ts } = mk(async (u, o) => { opts = o; return res(REAL); });
  await ts.sync();
  assert.equal(opts.method, 'HEAD');
  assert.ok(opts.signal, 'lleva AbortSignal');
});
