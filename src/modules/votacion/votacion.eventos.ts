import { EventEmitter } from 'node:events';

/**
 * Eventos internos de la votación. El servicio de votos los emite sin saber quién escucha; el
 * tiempo real (Socket.IO del panel y la proyección, Sprint 3) se suscribe. Así registrar un voto
 * no depende de que haya un panel conectado.
 */
export interface Proclamacion {
  asambleaId: number;
  eleccionId: number;
  cargo: string;
  ronda: number;
  candidato: { id: number; nombre: string; detalle: string | null; tieneFoto: boolean };
  publicadaEn: Date;
}

export interface EventosVotacion {
  /** Un voto confirmado: el panel recalcula el conteo. */
  voto: [{ asambleaId: number; eleccionId: number }];
  /** Se abrió, cerró o creó una elección, o finalizó la asamblea: el panel recarga. */
  cambioEstado: [{ asambleaId: number }];
  /** Ganador publicado: lo único que recibe la proyección. */
  proclamado: [Proclamacion];
}

export const eventosVotacion = new EventEmitter<EventosVotacion>();
