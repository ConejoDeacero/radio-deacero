'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanTitle, parseLrc, createLyrics } = require('../src/lyrics');

test('cleanTitle: "Artista - Canción (Official Video)"', () => {
  assert.deepEqual(cleanTitle('Bad Bunny - Tití Me Preguntó (Official Video)', 'Bad Bunny'),
    { artist: 'Bad Bunny', track: 'Tití Me Preguntó' });
});

test('cleanTitle: quita corchetes, feat. y ruido', () => {
  const r = cleanTitle('Daft Punk - Get Lucky (feat. Pharrell Williams) [Official Audio] HD', 'Daft Punk');
  assert.equal(r.artist, 'Daft Punk');
  assert.equal(r.track, 'Get Lucky');
});

test('cleanTitle: sin guion usa el canal sin "- Topic" ni VEVO', () => {
  assert.deepEqual(cleanTitle('Bohemian Rhapsody', 'Queen - Topic'), { artist: 'Queen', track: 'Bohemian Rhapsody' });
  assert.deepEqual(cleanTitle('Hello', 'AdeleVEVO'), { artist: 'Adele', track: 'Hello' });
});

test('cleanTitle: conserva paréntesis que sí son parte del título', () => {
  assert.equal(cleanTitle('Oasis - Wonderwall (Remastered)', 'Oasis').track, 'Wonderwall (Remastered)');
});

test('parseLrc: líneas con tiempo, ordenadas, ignora etiquetas y vacías', () => {
  const lrc = '[ar:Alguien]\n[00:12.50]Segunda\n[00:01.00]Primera\n[01:02.5]  \n[01:03.25]Tercera';
  assert.deepEqual(parseLrc(lrc), [
    { t: 1, text: 'Primera' },
    { t: 12.5, text: 'Segunda' },
    { t: 63.25, text: 'Tercera' }
  ]);
});

test('parseLrc: varias marcas por línea', () => {
  assert.deepEqual(parseLrc('[00:10.00][00:20.00]Coro'), [{ t: 10, text: 'Coro' }, { t: 20, text: 'Coro' }]);
});

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('getLyrics: usa lrclib (sincronizada) y cachea', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return res(200, { syncedLyrics: '[00:01.00]Hola', plainLyrics: 'Hola' });
  };
  const ly = createLyrics({ fetchImpl });
  const a = await ly.get({ title: 'Artista - Canción (Official Video)', channel: 'x', duration: 200 });
  const b = await ly.get({ title: 'Artista - Canción (Official Video)', channel: 'x', duration: 200 });

  assert.deepEqual(a, { synced: [{ t: 1, text: 'Hola' }], plain: 'Hola', source: 'lrclib' });
  assert.deepEqual(b, a);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /lrclib\.net\/api\/get\?/);
  assert.match(urls[0], /artist_name=Artista/);
  assert.match(urls[0], /track_name=Canci%C3%B3n/);
  assert.match(urls[0], /duration=200/);
});

test('getLyrics: si lrclib no tiene, cae a lyrics.ovh (solo texto)', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('lrclib')) return res(404, {});
    return res(200, { lyrics: 'Letra plana' });
  };
  const r = await createLyrics({ fetchImpl }).get({ title: 'A - B', channel: 'A', duration: 100 });
  assert.deepEqual(r, { synced: null, plain: 'Letra plana', source: 'lyrics.ovh' });
});

test('getLyrics: sin letra en ninguna fuente → null (y se cachea el fallo)', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return res(404, {}); };
  const ly = createLyrics({ fetchImpl });
  assert.equal(await ly.get({ title: 'A - B', channel: 'A' }), null);
  const calls = n;
  assert.equal(await ly.get({ title: 'A - B', channel: 'A' }), null);
  assert.equal(n, calls);
});

test('getLyrics: errores de red no revientan', async () => {
  const fetchImpl = async () => { throw new Error('offline'); };
  assert.equal(await createLyrics({ fetchImpl }).get({ title: 'A - B', channel: 'A' }), null);
});
