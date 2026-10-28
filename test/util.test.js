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

test('clockParts: hora de 12 h con AM/PM y fecha en español (como el kiosco anterior)', () => {
  const { clockParts } = require('../public/js/util');
  assert.deepEqual(clockParts(new Date(2026, 9, 29, 15, 7, 9).getTime()), { time: '03:07:09', ampm: 'PM', date: 'jueves, 29 de octubre' });
  assert.deepEqual(clockParts(new Date(2026, 9, 28, 0, 5, 0).getTime()), { time: '12:05:00', ampm: 'AM', date: 'miércoles, 28 de octubre' }, 'medianoche = 12 AM');
  assert.equal(clockParts(new Date(2026, 0, 1, 12, 0, 0).getTime()).time, '12:00:00', 'mediodía = 12 PM');
  assert.equal(clockParts(new Date(2026, 0, 1, 12, 0, 0).getTime()).ampm, 'PM');
  assert.equal(clockParts(new Date(2026, 11, 31, 23, 59, 59).getTime()).date, 'jueves, 31 de diciembre');
});
