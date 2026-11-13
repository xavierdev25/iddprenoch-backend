import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Pruebas de integración: la API completa contra un MySQL real (docker-compose.dev.yml en local,
// servicio MySQL en el CI).
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('Falta TEST_DATABASE_URL (ver .env.example). Debe apuntar a un MySQL desechable.');
}
const base = new URL(url);
if (!/test/i.test(base.pathname.slice(1))) {
  throw new Error(`TEST_DATABASE_URL apunta a "${base.pathname.slice(1)}": el nombre de la base debe contener "test".`);
}

// Cada corrida usa una base nueva con sufijo único: el globalSetup la crea, le aplica las
// migraciones y al terminar borra solo esa. Nunca se vacía una base que la corrida no haya creado.
base.pathname = `${base.pathname}_${Date.now()}`;
process.env.INTEGRATION_DATABASE_URL = base.toString();

export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    globalSetup: ['src/__integration__/global-setup.ts'],
    // Comparten una sola base: en serie, para que un archivo no vea los datos a medio crear de otro.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: base.toString(),
      JWT_SECRET: 'secreto-de-pruebas-de-integracion',
      NODE_ENV: 'test',
    },
  },
});
