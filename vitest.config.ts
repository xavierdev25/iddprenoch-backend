import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Sin esto, vitest también descubre los .test.js que `tsc` deja en dist/
    // (compilados en CommonJS), que fallan al intentar importar vitest con require().
    include: ['src/**/*.test.ts'],
  },
});
