import type { Server as HttpServer } from 'node:http';
import { Server as IoServer } from 'socket.io';
import { logger } from '../utils/logger';
import { SOCKET_PATH, registrarIo } from './realtime.spike';

/**
 * Socket.IO del spike (ADR-028). Módulo aparte porque importa `socket.io` al cargarse: server.ts lo
 * importa de forma diferida y solo con SPIKE_TOKEN definido. Así, si el código llega al hosting
 * antes de que se ejecute "Run NPM Install", la API arranca igual sin el paquete.
 */

/** (a) y (b): Socket.IO en el mismo proceso que Express, con respaldo a long polling. */
export function montarSocketSpike(server: HttpServer, token: string): IoServer {
  const io = new IoServer(server, { path: SOCKET_PATH });
  registrarIo(io);

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
      io.to('spike').emit('spike:difusion', { t, pid: process.pid });
    });
  });

  logger.warn({ path: SOCKET_PATH }, 'Spike de tiempo real ACTIVO (SPIKE_TOKEN definido)');
  return io;
}
