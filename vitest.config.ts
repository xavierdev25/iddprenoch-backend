import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Sin esto, vitest también descubre los .test.js que `tsc` deja en dist/
    // (compilados en CommonJS), que fallan al intentar importar vitest con require().
    include: ['src/**/*.test.ts'],
    // Las de integración necesitan MySQL y corren aparte (vitest.integration.config.ts).
    exclude: ['src/**/*.int.test.ts'],
    // config/env.ts corta el proceso si faltan estas variables. Las pruebas unitarias mockean
    // Prisma y nunca se conectan: basta con valores de relleno que pasen la validación.
    env: {
      DATABASE_URL: 'mysql://test:test@localhost:3306/sin_uso',
      JWT_SECRET: 'secreto-de-pruebas-unitarias',
      NODE_ENV: 'test',
    },
  },
});
