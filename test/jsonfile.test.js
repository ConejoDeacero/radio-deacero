'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readJson, writeJson } = require('../src/jsonfile');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'play-json-'));

test('readJson: devuelve el valor de respaldo si no existe o está dañado', () => {
  const dir = tmp();
  assert.deepEqual(readJson(path.join(dir, 'no.json'), []), []);
  fs.writeFileSync(path.join(dir, 'mal.json'), '{no');
  assert.deepEqual(readJson(path.join(dir, 'mal.json'), { a: 1 }), { a: 1 });
});

test('writeJson: crea la carpeta, escribe y se puede releer', () => {
  const file = path.join(tmp(), 'sub', 'datos.json');
  writeJson(file, [{ a: 1 }]);
  assert.deepEqual(readJson(file, null), [{ a: 1 }]);
  assert.ok(!fs.existsSync(file + '.tmp'), 'no deja el temporal');
});

test('writeJson: si renombrar falla (EPERM en Windows) escribe directo', () => {
  const file = path.join(tmp(), 'd.json');
  const real = fs.renameSync;
  fs.renameSync = () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); };
  try { writeJson(file, { ok: true }); } finally { fs.renameSync = real; }
  assert.deepEqual(readJson(file, null), { ok: true });
});

test('writeJson: si el disco falla, lanza', () => {
  const base = tmp();
  const blocker = path.join(base, 'archivo');
  fs.writeFileSync(blocker, 'x');
  assert.throws(() => writeJson(path.join(blocker, 'x', 'd.json'), {}));
});
