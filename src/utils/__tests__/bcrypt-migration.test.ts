import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';

describe('bcrypt -> bcryptjs migration', () => {
  // Hash real, tomado de la BD de desarrollo (usuario "admin", seedeado con la librería
  // `bcrypt` original) antes de migrar a `bcryptjs`. Si este test falla, las contraseñas
  // ya existentes en producción dejarían de poder loguearse tras el deploy.
  const REAL_BCRYPT_HASH = '$2b$12$OqxHhrSewi1.YhVUpoEW6OFlx0GrwtYrE6gSuTQmHZDwsDF/gnrlq';
  const PLAINTEXT = 'admin123';

  it('valida con bcryptjs.compare un hash generado por la librería bcrypt original', async () => {
    await expect(bcrypt.compare(PLAINTEXT, REAL_BCRYPT_HASH)).resolves.toBe(true);
  });

  it('rechaza una contraseña incorrecta contra ese mismo hash', async () => {
    await expect(bcrypt.compare('password-incorrecta', REAL_BCRYPT_HASH)).resolves.toBe(false);
  });

  it('un hash nuevo generado con bcryptjs también valida correctamente (round-trip)', async () => {
    const hash = await bcrypt.hash(PLAINTEXT, 12);
    await expect(bcrypt.compare(PLAINTEXT, hash)).resolves.toBe(true);
  });
});
