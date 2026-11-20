import { app } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { logger } from './utils/logger';
import { iniciarLimpiezaAuditoria } from './utils/auditoria';

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

  app.listen(env.PORT, () => {
    logger.info(`Servidor escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

main();

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
