/* util.js — helpers puros del cliente (también se prueban con node:test). */
(function (root) {
  'use strict';

  function fmtTime(s) {
    if (!Number.isFinite(s)) return '–:––';
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var ss = (sec < 10 ? '0' : '') + sec;
    return h ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
  }

  /* Índice de la última línea con t <= tiempo (búsqueda binaria); -1 si aún no empieza. */
  function activeLine(lines, t) {
    var lo = 0, hi = lines.length - 1, ans = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (lines[mid].t <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  /* Pila acotada de pistas ya sonadas, para el botón "anterior". */
  function createHistory(max) {
    var items = [];
    return {
      push: function (x) { items.push(x); if (items.length > max) items.shift(); },
      pop: function () { return items.pop(); },
      size: function () { return items.length; }
    };
  }

  /* Archivo SVG (Twemoji) de un emoji: puntos de código en hex unidos por "-". Mismo criterio que twemoji:
     el selector FE0F solo se conserva dentro de secuencias ZWJ. La Pi no trae fuente de emoji. */
  function emojiSrc(emoji) {
    if (!emoji) return '';
    var cps = Array.from(emoji).map(function (c) { return c.codePointAt(0).toString(16); });
    if (emoji.indexOf('‍') === -1) cps = cps.filter(function (c) { return c !== 'fe0f'; });
    return 'assets/emoji/' + cps.join('-') + '.svg';
  }

  /* Pone el emoji en el elemento como imagen (si falla, como texto). */
  function setEmoji(el, emoji) {
    el.textContent = '';
    if (!emoji) return;
    var img = document.createElement('img');
    img.className = 'emo'; img.alt = emoji; img.decoding = 'async';
    img.onerror = function () { el.textContent = emoji; };
    img.src = emojiSrc(emoji);
    el.appendChild(img);
  }

  /* Reloj del kiosco: hora de 12 h con AM/PM y fecha en español (igual que el kiosco anterior). */
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function clockParts(ms) {
    var d = new Date(ms);
    var h = d.getHours();
    return {
      time: two(h % 12 || 12) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()),
      ampm: h < 12 ? 'AM' : 'PM',
      date: DAYS[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()]
    };
  }

  var api = { clockParts: clockParts, fmtTime: fmtTime, activeLine: activeLine, createHistory: createHistory, emojiSrc: emojiSrc, setEmoji: setEmoji };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Util = api;
})(typeof window !== 'undefined' ? window : globalThis);
