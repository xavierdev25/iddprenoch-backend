import type { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { AUTH_COOKIE_NAME, usuarioActivo, verificarTokenAdmin } from '../middlewares/auth.middleware';
import { distritoDeAlcance, tienePermiso } from '../utils/permisos';
import { logger } from '../utils/logger';
import { asambleaEnAlcance } from '../modules/asambleas/asambleas.alcance';
import { cabecera } from '../modules/asambleas/asambleas.service';
import { conteo } from '../modules/asambleas/conduccion.service';
import { estadoPorCodigo } from '../modules/votacion/votacion.estado';
import { eventosVotacion } from '../modules/votacion/votacion.eventos';
import { esCodigoAccesoValido } from '../utils/codigos';

/**
 * Tiempo real del panel y de la proyección (ADR-028), en el mismo proceso que Express.
 *
 * - Solo long polling: el spike midió que Apache del hosting rompe el upgrade a WebSocket, así que
 *   ni se intenta. Son 2–3 conexiones (panel y proyección), cada una ocupa un Entry Process.
 * - Los electores NO usan Socket.IO: consultan /api/votacion/:codigo/estado cada 3 s.
 * - Sala `admin:{asambleaId}`: exige la cookie del panel, el permiso "asambleas" y el alcance del
 *   usuario (ADR-026). Recibe `conteo:actualizado` y `asamblea:cambio`.
 * - Sala `proyeccion:{asambleaId}`: pública; recibe SOLO `ganador:proclamado`. El conteo nunca
 *   llega ahí.
 */
export const SOCKET_PATH = '/api/socket.io';
const ESPERA_CONTEO_MS = 300;

type Ack = (r: { ok: boolean; error?: string }) => void;

function leerCookie(cabeceraCookie: string | undefined, nombre: string): string | undefined {
  for (const parte of (cabeceraCookie ?? '').split(';')) {
    const [clave, ...valor] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(valor.join('='));
  }
  return undefined;
}

async function unirseAdmin(socket: Socket, asambleaId: unknown): Promise<string | null> {
  if (typeof asambleaId !== 'number') return 'Asamblea inválida';
  const payload = verificarTokenAdmin(leerCookie(socket.request.headers.cookie, AUTH_COOKIE_NAME));
  const usuario = payload ? await usuarioActivo(payload.id) : null;
  if (!usuario) return 'No autenticado';
  if (!tienePermiso(usuario.rol, 'asambleas')) return 'Sin permiso';
  const asamblea = await cabecera(asambleaId).catch(() => null);
  if (!asamblea) return 'Asamblea no encontrada';
  if (!asambleaEnAlcance(distritoDeAlcance(usuario), asamblea)) return 'Fuera de tu alcance';
  await socket.join(`admin:${asambleaId}`);
  return null;
}

export function montarTiempoReal(server: HttpServer): Server {
  const io = new Server(server, {
    path: SOCKET_PATH,
    transports: ['polling'],
    serveClient: false,
    // En producción el panel y la API comparten origen; en desarrollo, Angular corre en :4200.
    cors: env.NODE_ENV === 'development' ? { origin: 'http://localhost:4200', credentials: true } : undefined,
  });

  io.on('connection', (socket) => {
    socket.on('admin:unirse', (datos: { asambleaId?: unknown }, ack?: Ack) => {
      unirseAdmin(socket, datos?.asambleaId)
        .then((error) => ack?.(error ? { ok: false, error } : { ok: true }))
        .catch((err) => {
          logger.error({ err }, 'Socket: error al unir al panel');
          ack?.({ ok: false, error: 'Error interno' });
        });
    });

    socket.on('proyeccion:unirse', (datos: { codigo?: unknown }, ack?: Ack) => {
      const codigo = String(datos?.codigo ?? '').toUpperCase();
      const valido = esCodigoAccesoValido(codigo) ? estadoPorCodigo(codigo) : Promise.resolve(null);
      valido
        .then(async (estado) => {
          if (!estado) return ack?.({ ok: false, error: 'Asamblea no encontrada' });
          await socket.join(`proyeccion:${estado.asambleaId}`);
          ack?.({ ok: true });
        })
        .catch(() => ack?.({ ok: false, error: 'Error interno' }));
    });
  });

  // Conteo en vivo: un evento por voto agruparía 200 consultas por minuto; se agrupa en ventanas de
  // 300 ms por elección (el panel lo ve en < 2 s, como pide el requisito).
  const pendientes = new Map<number, ReturnType<typeof setTimeout>>();
  eventosVotacion.on('voto', ({ asambleaId, eleccionId }) => {
    const sala = `admin:${asambleaId}`;
    if (!io.sockets.adapter.rooms.get(sala)?.size || pendientes.has(eleccionId)) return;
    pendientes.set(
      eleccionId,
      setTimeout(() => {
        pendientes.delete(eleccionId);
        conteo(eleccionId)
          .then((c) => io.to(sala).emit('conteo:actualizado', c))
          .catch((err) => logger.error({ err }, 'Socket: no se pudo calcular el conteo'));
      }, ESPERA_CONTEO_MS),
    );
  });

  eventosVotacion.on('cambioEstado', ({ asambleaId }) => {
    io.to(`admin:${asambleaId}`).emit('asamblea:cambio', { asambleaId });
  });

  eventosVotacion.on('proclamado', (p) => {
    // A la proyección solo lo que se proyecta: cargo, ronda y el ganador. Sin votos.
    io.to(`proyeccion:${p.asambleaId}`).emit('ganador:proclamado', {
      eleccionId: p.eleccionId,
      cargo: p.cargo,
      ronda: p.ronda,
      candidato: p.candidato,
      publicadaEn: p.publicadaEn,
    });
  });

  return io;
}
