'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createThumbs } = require('../src/thumb');

const ID = 'a'.repeat(11);
const img = (status) => ({
  ok: status === 200, status,
  headers: { get: () => 'image/jpeg' },
  arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
});

test('prueba hq720 y cae a mqdefault si no existe', async () => {
  const urls = [];
  const fetchImpl = async (u) => { urls.push(u); return img(u.includes('hq720') ? 404 : 200); };
  const t = await createThumbs({ fetchImpl }).get(ID);
  assert.equal(t.type, 'image/jpeg');
  assert.deepEqual([...t.body], [1, 2, 3]);
  assert.match(urls[0], /i\.ytimg\.com\/vi\/a{11}\/hq720\.jpg/);
  assert.match(urls[1], /mqdefault\.jpg/);
});

test('cachea por id', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return img(200); };
  const th = createThumbs({ fetchImpl });
  await th.get(ID);
  await th.get(ID);
  assert.equal(n, 1);
});

test('null si ninguna variante responde; id inválido ni se intenta', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return img(404); };
  const th = createThumbs({ fetchImpl });
  assert.equal(await th.get(ID), null);
  assert.equal(await th.get('../x'), null);
  assert.equal(n, 2);
});

test('la caché está acotada', async () => {
  const fetchImpl = async () => img(200);
  const th = createThumbs({ fetchImpl, max: 2 });
  for (const c of 'abc') await th.get(c.repeat(11));
  assert.equal(th.size(), 2);
});
