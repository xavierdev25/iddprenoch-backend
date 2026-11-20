import { EventEmitter } from 'node:events';

/**
 * Eventos internos de la votación. El servicio de votos los emite sin saber quién escucha; el
 * tiempo real (Socket.IO del panel y la proyección, Sprint 3) se suscribe. Así registrar un voto
 * no depende de que haya un panel conectado.
 */
export interface EventosVotacion {
  voto: [{ asambleaId: number; eleccionId: number }];
  cambioEstado: [{ asambleaId: number }];
}

export const eventosVotacion = new EventEmitter<EventosVotacion>();
