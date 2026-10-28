'use strict';
/* clients.js — qué equipos están usando el control remoto.
 * Las PANTALLAS (quien reproduce) las lleva control.js por su conexión SSE; aquí se llevan los CONTROLES:
 * quien consulta el estado o manda órdenes (web /remote, comando `play`, etc.). */
const dns = require('node:dns').promises;

const LOOPBACK = new Set(['127.0.0.1', '::1']);
const cleanIp = (ip) => String(ip || '').replace(/^::ffff:/, '');

/* Nombre que declara el usuario (cabecera x-user, codificada). Lo escribe cada quien: sirve para distinguir equipos, no es autenticación. */
function cleanUser(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw;
  try { s = decodeURIComponent(raw); } catch (_) { /* codificación rota: se usa tal cual */ }
  s = s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 30);
  return s || null;
}

/* "iPhone (Safari)", "PC Windows (Edge)"… a partir del User-Agent. */
function describeAgent(ua) {
  if (typeof ua !== 'string' || !ua || ua.length > 1000) return 'Desconocido';
  if (/^Python-urllib|python-requests/i.test(ua)) return 'Terminal (play)';
  if (/^curl\//i.test(ua)) return 'curl';
  let device = '';
  if (/iPhone/.test(ua)) device = 'iPhone';
  else if (/iPad/.test(ua)) device = 'iPad';
  else if (/Android/.test(ua)) device = 'Celular Android';
  else if (/CrOS/.test(ua)) device = 'Chromebook';
  else if (/Windows NT/.test(ua)) device = 'PC Windows';
  else if (/Macintosh/.test(ua)) device = 'Mac';
  else if (/Linux (aarch64|armv)/.test(ua)) device = 'Raspberry Pi / Linux ARM';
  else if (/Linux|X11/.test(ua)) device = 'PC Linux';
  let browser = '';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\/|CriOS/.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  if (device && browser) return `${device} (${browser})`;
  return device || browser || 'Desconocido';
}

function createClients({
  now = Date.now, reverse = (ip) => dns.reverse(ip),
  onlineMs = 10000, keepMs = 10 * 60 * 1000, maxEntries = 50, dnsTimeoutMs = 1500
} = {}) {
  const map = new Map();       /* `${ip}|${agente}` → datos del equipo */
  const hostCache = new Map(); /* ip → { host, at } */

  function touch({ ip, ua, cmd, user }) {
    const addr = cleanIp(ip);
    const agent = describeAgent(ua);
    const key = `${addr}|${agent}`;
    const t = now();
    const e = map.get(key) || { ip: addr, agent, via: /^Terminal|^curl$/.test(agent) ? 'terminal' : 'web', firstSeen: t };
    e.lastSeen = t;
    const u = cleanUser(user);
    if (u) e.user = u;
    if (cmd) { e.lastCmd = cmd; e.lastCmdAt = t; }
    map.set(key, e);
    if (map.size > maxEntries) {
      let oldest = null;
      for (const [k, v] of map) if (!oldest || v.lastSeen < oldest.v.lastSeen) oldest = { k, v };
      if (oldest) map.delete(oldest.k);
    }
  }

  /* Nombre del equipo según el DNS de la red (con tiempo límite y caché); null si no se sabe. */
  async function resolveHost(ipRaw) {
    const ip = cleanIp(ipRaw);
    if (LOOPBACK.has(ip)) return 'esta Pi';
    const hit = hostCache.get(ip);
    if (hit && now() - hit.at < keepMs) return hit.host;
    let host = null;
    let timer;
    try {
      const names = await Promise.race([
        Promise.resolve().then(() => reverse(ip)),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('tiempo agotado')), dnsTimeoutMs); if (timer.unref) timer.unref(); })
      ]);
      host = Array.isArray(names) ? (names[0] ? String(names[0]) : null) : (typeof names === 'string' ? names : null);
    } catch { host = null; }
    clearTimeout(timer);
    hostCache.set(ip, { host, at: now() });
    return host;
  }

  async function list() {
    const t = now();
    for (const [k, v] of map) if (t - v.lastSeen > keepMs) map.delete(k);
    const entries = [...map.values()].sort((a, b) => b.lastSeen - a.lastSeen);
    return Promise.all(entries.map(async (e) => ({
      ip: e.ip,
      host: await resolveHost(e.ip),
      agent: e.agent,
      user: e.user || null,
      via: e.via,
      online: t - e.lastSeen < onlineMs,
      seenAgo: Math.floor((t - e.lastSeen) / 1000),
      lastCmd: e.lastCmd || null,
      lastCmdAgo: e.lastCmdAt ? Math.floor((t - e.lastCmdAt) / 1000) : null
    })));
  }

  return { touch, list, resolveHost };
}

module.exports = { createClients, describeAgent, cleanIp, cleanUser };
