import { app } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { logger } from './utils/logger';
import { iniciarLimpiezaAuditoria } from './utils/auditoria';
import { montarTiempoReal } from './realtime/socket';

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

  iniciarLimpiezaAuditoria();

  const server = app.listen(env.PORT, () => {
    logger.info(`Servidor escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Socket.IO del panel y la proyección, sobre el mismo servidor HTTP (ADR-028).
  montarTiempoReal(server);
}

main();

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
