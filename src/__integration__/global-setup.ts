import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Crea la base de esta corrida (nombre único, ver vitest.integration.config.ts), le aplica las
 * migraciones con `migrate deploy` —igual que una instalación nueva— y la borra al terminar.
 */
export default async function setup() {
  const url = new URL(process.env.INTEGRATION_DATABASE_URL!);
  const nombre = url.pathname.slice(1);

  // Conexión al servidor sin elegir la base de la corrida, que todavía no existe.
  const servidor = new URL(url);
  servidor.pathname = '/mysql';
  const admin = new PrismaClient({ datasourceUrl: servidor.toString() });

  await admin.$executeRawUnsafe(
    `CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url.toString() },
  });

  return async () => {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${nombre}\``);
    await admin.$disconnect();
  };
}
