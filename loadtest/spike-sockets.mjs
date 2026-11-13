#!/usr/bin/env node
/**
 * Spike (a) y (b): las 2–3 conexiones Socket.IO del panel admin y la proyección (ADR-028).
 *
 * Abre N clientes (por defecto 3), espera a ver si el transporte sube de polling a WebSocket,
 * y mide 20 difusiones "servidor → todos" (lo que sería voto registrado → conteo en el panel).
 *
 * Uso: node loadtest/spike-sockets.mjs --url https://iddprenoch.com --token <SPIKE_TOKEN> [--clientes 3]
 */
import { io } from 'socket.io-client';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pares, a, i, arr) => (a.startsWith('--') ? [...pares, [a.slice(2), arr[i + 1]]] : pares), []),
);
const URL_BASE = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const N = Number(args.clientes ?? 3);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const clientes = Array.from({ length: N }, () => {
  const c = { inicial: '?', actual: '?', pids: new Set(), latencias: [] };
  c.socket = io(URL_BASE, { path: '/api/socket.io', auth: { token: args.token } });
  c.socket.on('connect_error', (e) => console.log('connect_error:', e.message));
  c.socket.on('spike:hola', (d) => {
    c.inicial = d.transporte;
    c.pids.add(d.pid);
  });
  c.socket.io.on('open', () => {
    c.actual = c.socket.io.engine.transport.name;
    c.socket.io.engine.on('upgrade', (t) => (c.actual = t.name));
  });
  c.socket.on('spike:difusion', (d) => {
    c.latencias.push(Date.now() - d.t);
    c.pids.add(d.pid);
  });
  return c;
});

await dormir(8000);
console.log('Transporte por cliente (inicial → actual):', clientes.map((c) => `${c.inicial} → ${c.actual}`).join(', '));

for (let i = 0; i < 20; i++) {
  clientes[0].socket.emit('spike:difundir', Date.now());
  await dormir(700);
}
await dormir(2000);

const todas = clientes.flatMap((c) => c.latencias).sort((a, b) => a - b);
const pct = (q) => todas[Math.min(todas.length - 1, Math.floor(q * todas.length))] ?? 0;
console.log(
  JSON.stringify({
    pasaWebSocket: clientes.every((c) => c.actual === 'websocket'),
    pids: [...new Set(clientes.flatMap((c) => [...c.pids]))],
    difusionesRecibidas: todas.length,
    esperadas: 20 * N,
    msDifusion: { p50: pct(0.5), p95: pct(0.95), max: todas.at(-1) ?? 0 },
  }),
);
clientes.forEach((c) => c.socket.close());
