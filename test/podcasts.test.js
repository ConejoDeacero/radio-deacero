'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPodcasts } = require('../src/podcasts');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'play-pod-'));

test('lista vacía al inicio', () => {
  assert.deepEqual(createPodcasts({ dir: tmp() }).list(), []);
});

test('add: guarda con id, nombre y consulta; recorta espacios', () => {
  const p = createPodcasts({ dir: tmp() });
  const r = p.add({ name: '  Radio Ambulante ', q: ' radio ambulante podcast ' });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.item).sort(), ['id', 'name', 'q']);
  assert.equal(r.item.name, 'Radio Ambulante');
  assert.equal(r.item.q, 'radio ambulante podcast');
  assert.match(r.item.id, /^[a-z0-9]{6,}$/);
  assert.deepEqual(p.list(), [r.item]);
});

test('add: la misma consulta no se duplica (devuelve la existente)', () => {
  const p = createPodcasts({ dir: tmp() });
  const a = p.add({ name: 'A', q: 'Radio Ambulante' });
  const b = p.add({ name: 'Otro nombre', q: 'radio ambulante' });
  assert.equal(b.ok, true);
  assert.equal(b.item.id, a.item.id);
  assert.equal(p.list().length, 1);
});

test('add: valida nombre y consulta', () => {
  const p = createPodcasts({ dir: tmp() });
  assert.equal(p.add({ name: '', q: 'x' }).ok, false);
  assert.equal(p.add({ name: 'x', q: '   ' }).ok, false);
  assert.equal(p.add({ name: 'x'.repeat(61), q: 'x' }).ok, false);
  assert.equal(p.add({ name: 'x', q: 'x'.repeat(101) }).ok, false);
  assert.equal(p.add(null).ok, false);
  assert.equal(p.add({ name: 5, q: 'x' }).ok, false);
});

test('add: tope de 50 podcasts', () => {
  const p = createPodcasts({ dir: tmp() });
  for (let i = 0; i < 50; i++) assert.equal(p.add({ name: 'P' + i, q: 'consulta ' + i }).ok, true);
  assert.equal(p.add({ name: 'uno más', q: 'otra' }).ok, false);
});

test('remove: quita por id; id inexistente → false', () => {
  const p = createPodcasts({ dir: tmp() });
  const { item } = p.add({ name: 'A', q: 'a' });
  assert.equal(p.remove(item.id), true);
  assert.equal(p.remove(item.id), false);
  assert.deepEqual(p.list(), []);
});

test('persiste en disco y otra instancia lo ve', () => {
  const dir = tmp();
  createPodcasts({ dir }).add({ name: 'A', q: 'a' });
  const again = createPodcasts({ dir });
  assert.equal(again.list().length, 1);
  assert.equal(again.list()[0].name, 'A');
});

test('archivo corrupto: arranca vacío sin reventar y se puede seguir usando', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'podcasts.json'), '{no es json');
  const p = createPodcasts({ dir });
  assert.deepEqual(p.list(), []);
  assert.equal(p.add({ name: 'A', q: 'a' }).ok, true);
  assert.equal(createPodcasts({ dir }).list().length, 1);
});

test('crea la carpeta si no existe', () => {
  const dir = path.join(tmp(), 'sub', 'datos');
  assert.equal(createPodcasts({ dir }).add({ name: 'A', q: 'a' }).ok, true);
  assert.ok(fs.existsSync(path.join(dir, 'podcasts.json')));
});

test('si el disco falla, add devuelve error y NO deja el podcast en memoria', () => {
  const base = tmp();
  const blocker = path.join(base, 'archivo');
  fs.writeFileSync(blocker, 'x'); // una carpeta no puede crearse dentro de un archivo
  const p = createPodcasts({ dir: path.join(blocker, 'datos') });
  const r = p.add({ name: 'A', q: 'a' });
  assert.equal(r.ok, false);
  assert.match(r.error, /guardar/i);
  assert.deepEqual(p.list(), []);
});

test('si renombrar falla (EPERM en Windows), usa escritura directa y sigue funcionando', () => {
  const dir = tmp();
  const realRename = fs.renameSync;
  fs.renameSync = () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); };
  try {
    const p = createPodcasts({ dir });
    assert.equal(p.add({ name: 'A', q: 'a' }).ok, true);
    assert.equal(p.add({ name: 'B', q: 'b' }).ok, true);
  } finally { fs.renameSync = realRename; }
  assert.equal(createPodcasts({ dir }).list().length, 2);
});

test('episodeQuery: añade "podcast" salvo que ya lo traiga', () => {
  const { episodeQuery } = require('../src/podcasts');
  assert.equal(episodeQuery('radio ambulante'), 'radio ambulante podcast');
  assert.equal(episodeQuery('  Radio Ambulante  '), 'Radio Ambulante podcast');
  assert.equal(episodeQuery('mi Podcast favorito'), 'mi Podcast favorito');
  assert.equal(episodeQuery('podcasts de historia'), 'podcasts de historia');
});
