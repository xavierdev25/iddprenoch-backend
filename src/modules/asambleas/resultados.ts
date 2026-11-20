/**
 * Resultado de una elección (ADR-029): mayoría simple. Si dos o más empatan en el primer lugar no
 * hay ganador, y la mesa convoca una segunda vuelta solo con los empatados.
 */
export interface VotosCandidato {
  candidatoId: number;
  votos: number;
}

export interface Resultado {
  ganadorId: number | null;
  /** Candidatos empatados en el primer lugar; vacío si hay ganador. */
  empatados: number[];
  total: number;
}

export function calcularResultado(conteo: VotosCandidato[]): Resultado {
  const total = conteo.reduce((suma, c) => suma + c.votos, 0);
  if (conteo.length === 0) return { ganadorId: null, empatados: [], total };
  const maximo = Math.max(...conteo.map((c) => c.votos));
  const primeros = conteo.filter((c) => c.votos === maximo).map((c) => c.candidatoId);
  // Con un solo candidato y al menos un voto, gana. Con cero votos para todos, todos empatan.
  if (primeros.length === 1 && maximo > 0) return { ganadorId: primeros[0], empatados: [], total };
  return { ganadorId: null, empatados: primeros, total };
}

/** Porcentaje con un decimal sobre los votos válidos (lo que muestra el panel). */
export function porcentaje(votos: number, total: number): number {
  return total ? Math.round((votos / total) * 1000) / 10 : 0;
}
