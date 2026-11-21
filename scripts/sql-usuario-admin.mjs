#!/usr/bin/env node
/**
 * Genera el SQL para crear (o recuperar) una cuenta "Responsable del sistema" desde phpMyAdmin,
 * para cuando no hay ninguna cuenta con la que entrar al panel.
 *
 *   node scripts/sql-usuario-admin.mjs
 *
 * Pide el nombre de usuario y la contraseña (no se muestra al escribir) y imprime el SQL con el
 * hash bcrypt (costo 12, el mismo de la app). La contraseña nunca se guarda ni se imprime.
 * Si el usuario ya existe, el SQL le pone esta contraseña, lo activa y lo deja como Responsable.
 */
import { createInterface } from 'node:readline';
import bcrypt from 'bcryptjs';

// Una sola interfaz para todas las preguntas: con varias, la entrada pegada puede perderse.
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
let silenciar = false;
// Mientras se escribe la contraseña no se hace eco: no aparece en la terminal.
rl._writeToOutput = (s) => {
  if (!silenciar) process.stdout.write(s);
};
const lineas = rl[Symbol.asyncIterator]();

async function preguntar(texto, oculto = false) {
  process.stdout.write(texto);
  silenciar = oculto;
  const { value } = await lineas.next();
  silenciar = false;
  if (oculto) process.stdout.write('\n');
  return value ?? '';
}

const nombre = (await preguntar('Nombre de usuario: ')).trim();
if (!/^[A-Za-z0-9._-]{3,50}$/.test(nombre)) {
  console.error('Usa de 3 a 50 caracteres: letras, números, punto, guion o guion bajo.');
  process.exit(1);
}
const clave = await preguntar('Contraseña (mín. 10 caracteres, no se ve al escribir): ', true);
const repetida = await preguntar('Repite la contraseña: ', true);
if (clave !== repetida) {
  console.error('Las contraseñas no coinciden.');
  process.exit(1);
}
if (clave.length < 10) {
  console.error('La contraseña debe tener al menos 10 caracteres.');
  process.exit(1);
}

rl.close();
const hash = await bcrypt.hash(clave, 12);

console.log(`
-- ===== Copiar desde aquí y pegar en phpMyAdmin (portada → pestaña SQL → Continuar) =====
USE \`iddpreno_main\`;

INSERT INTO \`usuarios\` (\`nombre\`, \`email\`, \`password_hash\`, \`rol_id\`, \`estado_id\`, \`distrito_id\`, \`created_at\`, \`updated_at\`)
SELECT '${nombre}', NULL, '${hash}', r.id, e.id, NULL, NOW(3), NOW(3)
FROM \`roles\` r
JOIN \`estados_usuario\` e ON e.nombre = 'Activo'
WHERE r.nombre = 'Responsable del sistema'
ON DUPLICATE KEY UPDATE
  \`password_hash\` = VALUES(\`password_hash\`),
  \`rol_id\` = VALUES(\`rol_id\`),
  \`estado_id\` = VALUES(\`estado_id\`),
  \`distrito_id\` = NULL,
  \`updated_at\` = NOW(3);

-- Verificación: debe mostrar una fila con rol "Responsable del sistema" y estado "Activo".
SELECT u.id, u.nombre, r.nombre AS rol, e.nombre AS estado
FROM \`usuarios\` u
JOIN \`roles\` r ON r.id = u.rol_id
JOIN \`estados_usuario\` e ON e.id = u.estado_id
WHERE u.nombre = '${nombre}';
-- ===== Hasta aquí =====
`);
