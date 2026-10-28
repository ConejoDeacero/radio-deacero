'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHistory } = require('../src/history');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'play-hist-'));
const mk = (over = {}) => {
  let t = 1_700_000_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  return { h: createHistory({ dir: tmp(), now: clock.now, ...over }), clock };
};

test('vacío al inicio', () => {
  assert.deepEqual(mk().h.list(), []);
});

test('add: guarda tipo, texto, usuario, IP y hora; list devuelve lo más nuevo primero', () => {
  const { h, clock } = mk();
  h.add({ kind: 'song', text: 'dua lipa', user: 'Ana', ip: '10.0.0.5' });
  clock.advance(60_000);
  h.add({ kind: 'podcast', text: 'radio ambulante', user: 'Luis', ip: '10.0.0.9' });
  const l = h.list();
  assert.deepEqual(l.map((x) => x.text), ['radio ambulante', 'dua lipa']);
  assert.deepEqual(Object.keys(l[1]).sort(), ['at', 'id', 'ip', 'kind', 'text', 'user']);
  assert.equal(l[1].user, 'Ana');
  assert.equal(l[1].ip, '10.0.0.5');
  assert.equal(l[1].at, 1_700_000_000_000);
});

test('add: la hora del cliente (at) manda si viene; si no, la del servidor', () => {
  const { h } = mk();
  h.add({ kind: 'song', text: 'a', at: 1_800_000_000_000 });
  h.add({ kind: 'song', text: 'b' });
  const l = h.list();
  assert.equal(l.find((x) => x.text === 'a').at, 1_800_000_000_000);
  assert.equal(l.find((x) => x.text === 'b').at, 1_700_000_000_000);
});

test('add: valida tipo y texto; recorta', () => {
  const { h } = mk();
  assert.equal(h.add({ kind: 'raro', text: 'x' }), null);
  assert.equal(h.add({ kind: 'song', text: '   ' }), null);
  assert.equal(h.add(null), null);
  const e = h.add({ kind: 'episode', text: '  ' + 'x'.repeat(300) + '  ' });
  assert.equal(e.text.length, 200);
});

test('usuario ausente → null; se limpia y se acota', () => {
  const { h } = mk();
  assert.equal(h.add({ kind: 'song', text: 'a' }).user, null);
  assert.equal(h.add({ kind: 'song', text: 'b', user: '  Ana\u0007  ' }).user, 'Ana');
  assert.equal(h.add({ kind: 'song', text: 'c', user: 'x'.repeat(100) }).user.length, 30);
});

test('no repite la misma búsqueda del mismo usuario en 30 s; después sí', () => {
  const { h, clock } = mk();
  h.add({ kind: 'song', text: 'dua lipa', user: 'Ana' });
  clock.advance(10_000);
  assert.equal(h.add({ kind: 'song', text: 'Dua Lipa', user: 'Ana' }), null);
  assert.equal(h.add({ kind: 'song', text: 'dua lipa', user: 'Luis' }) !== null, true, 'otro usuario sí');
  clock.advance(31_000);
  assert.equal(h.add({ kind: 'song', text: 'dua lipa', user: 'Ana' }) !== null, true);
  assert.equal(h.list().length, 3);
});

test('tope de entradas: se descartan las más viejas', () => {
  const { h, clock } = mk({ max: 5 });
  for (let i = 0; i < 8; i++) { h.add({ kind: 'song', text: 'canción ' + i }); clock.advance(40_000); }
  const l = h.list();
  assert.equal(l.length, 5);
  assert.equal(l[0].text, 'canción 7');
  assert.equal(l[4].text, 'canción 3');
});

test('list(limit) acota', () => {
  const { h, clock } = mk();
  for (let i = 0; i < 10; i++) { h.add({ kind: 'genre', text: 'g' + i }); clock.advance(40_000); }
  assert.equal(h.list(3).length, 3);
  assert.equal(h.list(3)[0].text, 'g9');
});

test('clear: vacía y persiste', () => {
  const dir = tmp();
  const h = createHistory({ dir });
  h.add({ kind: 'song', text: 'a' });
  assert.equal(h.clear(), true);
  assert.deepEqual(h.list(), []);
  assert.deepEqual(createHistory({ dir }).list(), []);
});

test('persiste en disco y otra instancia lo ve', () => {
  const dir = tmp();
  createHistory({ dir }).add({ kind: 'podcast', text: 'x', user: 'Ana' });
  const again = createHistory({ dir });
  assert.equal(again.list().length, 1);
  assert.equal(again.list()[0].user, 'Ana');
});

test('archivo corrupto: arranca vacío sin reventar', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'history.json'), '[[[');
  const h = createHistory({ dir });
  assert.deepEqual(h.list(), []);
  assert.ok(h.add({ kind: 'song', text: 'a' }));
});

test('si el disco falla no se pierde la entrada en memoria ni revienta', () => {
  const base = tmp();
  const blocker = path.join(base, 'archivo');
  fs.writeFileSync(blocker, 'x');
  const h = createHistory({ dir: path.join(blocker, 'datos') });
  const e = h.add({ kind: 'song', text: 'a' });
  assert.ok(e, 'el historial sigue funcionando en memoria');
  assert.equal(h.list().length, 1);
});
