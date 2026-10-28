'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fmtTime, activeLine, createHistory } = require('../public/js/util');

test('fmtTime', () => {
  assert.equal(fmtTime(0), '0:00');
  assert.equal(fmtTime(65.9), '1:05');
  assert.equal(fmtTime(3600 + 61), '1:01:01');
  assert.equal(fmtTime(NaN), '–:––');
  assert.equal(fmtTime(Infinity), '–:––');
  assert.equal(fmtTime(-3), '0:00');
});

test('activeLine: línea vigente según el tiempo', () => {
  const lines = [{ t: 5, text: 'a' }, { t: 10, text: 'b' }, { t: 20, text: 'c' }];
  assert.equal(activeLine(lines, 0), -1);
  assert.equal(activeLine(lines, 5), 0);
  assert.equal(activeLine(lines, 9.99), 0);
  assert.equal(activeLine(lines, 10), 1);
  assert.equal(activeLine(lines, 999), 2);
  assert.equal(activeLine([], 3), -1);
});

test('history: anterior vuelve por las pistas ya sonadas', () => {
  const h = createHistory(3);
  h.push({ id: 1 }); h.push({ id: 2 }); h.push({ id: 3 }); h.push({ id: 4 });
  assert.equal(h.size(), 3, 'acotado');
  assert.equal(h.pop().id, 4);
  assert.equal(h.pop().id, 3);
  assert.equal(h.pop().id, 2);
  assert.equal(h.pop(), undefined);
});

test('emojiSrc: archivo SVG según los puntos de código (como twemoji)', () => {
  const { emojiSrc } = require('../public/js/util');
  assert.equal(emojiSrc('🎷'), 'assets/emoji/1f3b7.svg');
  assert.equal(emojiSrc('☕'), 'assets/emoji/2615.svg');
  assert.equal(emojiSrc('🌶'), 'assets/emoji/1f336.svg');
  assert.equal(emojiSrc('🌶️'), 'assets/emoji/1f336.svg', 'con selector de variación (FE0F) da lo mismo');
  assert.equal(emojiSrc('🇲🇽'), 'assets/emoji/1f1f2-1f1fd.svg');
  assert.equal(emojiSrc('🏳️‍🌈'), 'assets/emoji/1f3f3-fe0f-200d-1f308.svg', 'en secuencias ZWJ se conserva FE0F');
  assert.equal(emojiSrc(''), '');
  assert.equal(emojiSrc(undefined), '');
});

test('todos los emoji de data/genres.json tienen su SVG en public/assets/emoji', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { emojiSrc } = require('../public/js/util');
  const genres = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'genres.json'), 'utf8'));
  const missing = [];
  for (const e of new Set([...genres.map((g) => g.emoji), '🎵', '🔎', '🎙️'].filter(Boolean))) {
    if (!fs.existsSync(path.join(__dirname, '..', 'public', emojiSrc(e)))) missing.push(e);
  }
  assert.deepEqual(missing, []);
});
