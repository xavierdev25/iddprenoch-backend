import { app } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { logger } from './utils/logger';
import { montarSocketSpike } from './spike/realtime.spike';

async function main() {
  try {
    await prisma.$connect();
  } catch (err) {
    logger.error(
      { err },
      'No se pudo conectar a la base de datos. Verifica DATABASE_URL y que MySQL esté corriendo.',
    );
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`Servidor escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Socket.IO comparte el servidor HTTP de Express (mismo proceso de Passenger). Solo con el spike.
  if (env.SPIKE_TOKEN) montarSocketSpike(server, env.SPIKE_TOKEN);
}

main();

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
