'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { describeAgent, createClients, cleanUser } = require('../src/clients');

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  pi: 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  python: 'Python-urllib/3.13',
  curl: 'curl/8.5.0'
};

test('describeAgent: reconoce dispositivo y navegador', () => {
  assert.equal(describeAgent(UA.iphone), 'iPhone (Safari)');
  assert.equal(describeAgent(UA.android), 'Celular Android (Chrome)');
  assert.equal(describeAgent(UA.winEdge), 'PC Windows (Edge)');
  assert.equal(describeAgent(UA.winChrome), 'PC Windows (Chrome)');
  assert.equal(describeAgent(UA.pi), 'Raspberry Pi / Linux ARM (Chrome)');
  assert.equal(describeAgent(UA.mac), 'Mac (Safari)');
  assert.equal(describeAgent(UA.firefox), 'PC Windows (Firefox)');
});

test('describeAgent: herramientas y casos raros', () => {
  assert.equal(describeAgent(UA.python), 'Terminal (play)');
  assert.equal(describeAgent(UA.curl), 'curl');
  assert.equal(describeAgent(''), 'Desconocido');
  assert.equal(describeAgent(undefined), 'Desconocido');
  assert.equal(describeAgent('x'.repeat(5000)), 'Desconocido');
});

const mk = (over = {}) => {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const c = createClients({ now: clock.now, reverse: async (ip) => (ip === '10.0.0.5' ? ['pc-juan.corp.local'] : null), ...over });
  return { c, clock };
};

test('touch + list: registra el equipo con su tipo, vía y última orden', async () => {
  const { c } = mk();
  c.touch({ ip: '10.0.0.5', ua: UA.winEdge });
  c.touch({ ip: '10.0.0.5', ua: UA.winEdge, cmd: 'next' });
  c.touch({ ip: '10.0.0.9', ua: UA.python });
  const l = await c.list();
  assert.equal(l.length, 2);
  const pc = l.find((x) => x.ip === '10.0.0.5');
  assert.equal(pc.host, 'pc-juan.corp.local');
  assert.equal(pc.agent, 'PC Windows (Edge)');
  assert.equal(pc.via, 'web');
  assert.equal(pc.lastCmd, 'next');
  assert.equal(pc.online, true);
  const term = l.find((x) => x.ip === '10.0.0.9');
  assert.equal(term.via, 'terminal');
  assert.equal(term.host, null);
});

test('online solo si se vio hace menos de 10 s; luego "hace X"', async () => {
  const { c, clock } = mk();
  c.touch({ ip: '10.0.0.5', ua: UA.winChrome });
  clock.advance(4000);
  assert.equal((await c.list())[0].online, true);
  clock.advance(7000);
  const x = (await c.list())[0];
  assert.equal(x.online, false);
  assert.equal(x.seenAgo, 11);
});

test('se olvidan los equipos no vistos en 10 minutos', async () => {
  const { c, clock } = mk();
  c.touch({ ip: '10.0.0.5', ua: UA.winChrome });
  clock.advance(10 * 60 * 1000 + 1000);
  assert.deepEqual(await c.list(), []);
});

test('mismo IP con distinto navegador son equipos distintos; mismo par se agrupa', async () => {
  const { c } = mk();
  c.touch({ ip: '10.0.0.5', ua: UA.winChrome });
  c.touch({ ip: '10.0.0.5', ua: UA.winChrome });
  c.touch({ ip: '10.0.0.5', ua: UA.firefox });
  assert.equal((await c.list()).length, 2);
});

test('orden: primero los más recientes; la IP de loopback se llama "esta Pi"', async () => {
  const { c, clock } = mk();
  c.touch({ ip: '10.0.0.9', ua: UA.python });
  clock.advance(1000);
  c.touch({ ip: '127.0.0.1', ua: UA.python });
  const l = await c.list();
  assert.equal(l[0].ip, '127.0.0.1');
  assert.equal(l[0].host, 'esta Pi');
});

test('quita el prefijo ::ffff: de las IPv4 mapeadas', async () => {
  const { c } = mk();
  c.touch({ ip: '::ffff:10.0.0.5', ua: UA.winChrome });
  assert.equal((await c.list())[0].ip, '10.0.0.5');
});

test('el nombre del equipo se consulta una vez (caché) y un fallo del DNS no rompe nada', async () => {
  let calls = 0;
  const { c } = mk({ reverse: async () => { calls++; throw new Error('sin DNS'); } });
  c.touch({ ip: '10.0.0.5', ua: UA.winChrome });
  await c.list();
  await c.list();
  assert.equal(calls, 1);
  assert.equal((await c.list())[0].host, null);
});

test('un DNS lento no bloquea la lista (tiempo límite)', async () => {
  const { c } = mk({ reverse: () => new Promise(() => {}), dnsTimeoutMs: 30 });
  c.touch({ ip: '10.0.0.5', ua: UA.winChrome });
  const t0 = Date.now();
  const l = await c.list();
  assert.equal(l.length, 1);
  assert.ok(Date.now() - t0 < 500);
});

test('tope de equipos recordados', async () => {
  const { c } = mk();
  for (let i = 0; i < 80; i++) c.touch({ ip: `10.1.0.${i}`, ua: UA.winChrome });
  assert.ok((await c.list()).length <= 50);
});

test('resolveHost sirve también para las pantallas', async () => {
  const { c } = mk();
  assert.equal(await c.resolveHost('10.0.0.5'), 'pc-juan.corp.local');
  assert.equal(await c.resolveHost('127.0.0.1'), 'esta Pi');
  assert.equal(await c.resolveHost('10.9.9.9'), null);
});

test('touch guarda el usuario (el último que usó ese equipo); sin usuario no borra el anterior', async () => {
  const { c } = mk();
  c.touch({ ip: '10.0.0.5', ua: UA.winEdge, user: 'Ana' });
  c.touch({ ip: '10.0.0.5', ua: UA.winEdge });
  assert.equal((await c.list())[0].user, 'Ana');
  c.touch({ ip: '10.0.0.5', ua: UA.winEdge, user: 'Luis' });
  assert.equal((await c.list())[0].user, 'Luis');
});

test('sin usuario declarado → user null', async () => {
  const { c } = mk();
  c.touch({ ip: '10.0.0.5', ua: UA.winEdge });
  assert.equal((await c.list())[0].user, null);
});

test('cleanUser: decodifica, limpia caracteres de control y acota a 30', () => {
  assert.equal(cleanUser(encodeURIComponent('José Núñez')), 'José Núñez');
  assert.equal(cleanUser('  Ana\u0007  '), 'Ana');
  assert.equal(cleanUser('%E0%A4%A'), '%E0%A4%A', 'codificación rota: se usa tal cual');
  assert.equal(cleanUser('x'.repeat(100)).length, 30);
  assert.equal(cleanUser(''), null);
  assert.equal(cleanUser('   '), null);
  assert.equal(cleanUser(undefined), null);
  assert.equal(cleanUser(['a']), null);
});
