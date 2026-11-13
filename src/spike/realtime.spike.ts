import type { Server as HttpServer } from 'node:http';
import { NextFunction, Request, Response, Router } from 'express';
import { Server as IoServer } from 'socket.io';
import { logger } from '../utils/logger';
import { PAGINA_SPIKE, SCRIPT_SPIKE } from './pagina.spike';

/**
 * Spike de tiempo real en el hosting cPanel (ADR-028). Mide, en producción y sin tocar la base:
 *   a) si WebSocket atraviesa Apache/Passenger o Socket.IO cae a long polling;
 *   b) el pid de cada respuesta, para saber si Passenger levanta más de un proceso (el estado en
 *      memoria y el long polling de Socket.IO exigen uno solo);
 *   c) cuántos 503/508 aparecen con 200 electores consultando el estado cada 3 s
 *      (script loadtest/spike-electores.mjs).
 *
 * Solo existe si SPIKE_TOKEN está definido, y solo responde a quien presente ese token. Se borra
 * cuando el spike termine; el módulo de votación (Sprint 2) reutilizará lo que el spike confirme.
 */

export const SOCKET_PATH = '/api/socket.io';

/** Lo que vería un elector al consultar el estado: mínimo, en memoria, sin base de datos. */
const estado = { estado: 'ABIERTA', eleccionId: 1, version: 1 };
// Cambia cada 30 s para que el script mida también respuestas 200 tras un cambio, no solo 304.
setInterval(() => {
  estado.version += 1;
}, 30_000).unref();

let io: IoServer | undefined;

/** Sin el token correcto, 404: el spike no anuncia que existe. */
function exigirToken(token: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.query.t === token || req.get('x-spike-token') === token) {
      next();
      return;
    }
    res.status(404).json({ error: { code: 404, message: 'Ruta no encontrada' } });
  };
}

export function spikeRouter(token: string): Router {
  const router = Router();
  // El JS de la página no tiene nada sensible y el <script src> no puede llevar el token: va antes
  // del control. Todo lo demás exige el token.
  router.get('/socket.js', (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store').type('application/javascript').send(SCRIPT_SPIKE);
  });
  router.use(exigirToken(token));

  // (c) Polling del elector. ETag + 304: si nada cambió, la respuesta no lleva cuerpo.
  router.get('/estado', (req: Request, res: Response) => {
    const inicio = process.hrtime.bigint();
    const etag = `"v${estado.version}"`;
    res.set({
      'Cache-Control': 'no-cache',
      ETag: etag,
      'X-Spike-Pid': String(process.pid),
    });
    const ms = () => (Number(process.hrtime.bigint() - inicio) / 1e6).toFixed(2);
    if (req.get('if-none-match') === etag) {
      res.set('X-Spike-Ms', ms()).status(304).end();
      return;
    }
    res.set('X-Spike-Ms', ms()).json({ ...estado, yaVoto: false, pid: process.pid });
  });

  // Diagnóstico: proceso, y qué IP y cabeceras de proxy llegan realmente detrás de Apache
  // (afecta a la auditoría y al rate limit, que usan req.ip).
  router.get('/info', (req: Request, res: Response) => {
    const sockets = io ? [...io.of('/').sockets.values()] : [];
    res.set('Cache-Control', 'no-store').json({
      pid: process.pid,
      uptimeSeg: Math.round(process.uptime()),
      node: process.version,
      memoriaMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      passenger: Object.fromEntries(
        Object.entries(process.env).filter(([k]) => k.startsWith('PASSENGER')),
      ),
      red: {
        reqIp: req.ip,
        remoteAddress: req.socket.remoteAddress ?? null,
        xForwardedFor: req.get('x-forwarded-for') ?? null,
        xRealIp: req.get('x-real-ip') ?? null,
        protocolo: req.protocol,
        xForwardedProto: req.get('x-forwarded-proto') ?? null,
      },
      sockets: {
        total: sockets.length,
        websocket: sockets.filter((s) => s.conn.transport.name === 'websocket').length,
        polling: sockets.filter((s) => s.conn.transport.name === 'polling').length,
      },
    });
  });

  router.get('/socket', (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store').type('html').send(PAGINA_SPIKE);
  });

  return router;
}

/** (a) y (b): Socket.IO en el mismo proceso que Express, con respaldo a long polling. */
export function montarSocketSpike(server: HttpServer, token: string): IoServer {
  io = new IoServer(server, { path: SOCKET_PATH });

  io.use((socket, next) => {
    if (socket.handshake.auth?.token === token) next();
    else next(new Error('no autorizado'));
  });

  io.on('connection', (socket) => {
    socket.join('spike');
    socket.emit('spike:hola', { pid: process.pid, transporte: socket.conn.transport.name });
    socket.conn.once('upgrade', (transporte: { name: string }) => {
      socket.emit('spike:upgrade', { pid: process.pid, transporte: transporte.name });
    });

    socket.on('spike:ping', (t: number, ack?: (r: unknown) => void) => {
      ack?.({ t, pid: process.pid, transporte: socket.conn.transport.name });
    });

    // Difusión a todos los conectados: mide cuánto tarda un evento del servidor en llegar (el
    // equivalente a "voto registrado → panel actualizado"). `t` es el reloj del cliente emisor,
    // así quien mide la latencia la calcula con su propio reloj y no depende del del servidor.
    let ultima = 0;
    socket.on('spike:difundir', (t: number) => {
      const ahora = Date.now();
      if (ahora - ultima < 500) return; // Sin esto, un cliente podría saturar a todos los demás.
      ultima = ahora;
      io!.to('spike').emit('spike:difusion', { t, pid: process.pid });
    });
  });

  logger.warn({ path: SOCKET_PATH }, 'Spike de tiempo real ACTIVO (SPIKE_TOKEN definido)');
  return io;
}
