import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { prisma } from '../db/prisma';

/** Levanta la API en un puerto libre y devuelve su URL base. */
export async function levantarApi(): Promise<{ base: string; server: Server }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

/**
 * Cookie de sesión firmada directamente, sin pasar por /auth/login: el login tiene un rate limit
 * de 5 intentos y estas pruebas cambian de usuario decenas de veces.
 */
export function cookieDe(usuario: { id: number; nombre: string; rolId: number }): string {
  const token = jwt.sign({ id: usuario.id, nombre: usuario.nombre, rolId: usuario.rolId }, process.env.JWT_SECRET!);
  return `auth_token=${token}`;
}

export interface Respuesta {
  status: number;
  body: any;
}

export function cliente(base: string) {
  return async function pedir(
    metodo: string,
    ruta: string,
    opciones: { como?: { id: number; nombre: string; rolId: number }; body?: unknown } = {},
  ): Promise<Respuesta> {
    const res = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(opciones.como ? { Cookie: cookieDe(opciones.como) } : {}),
      },
      body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
    });
    const texto = await res.text();
    return { status: res.status, body: texto ? JSON.parse(texto) : undefined };
  };
}

/** Catálogos mínimos que exigen las FK de congregantes y usuarios. */
export async function catalogos() {
  const [activo, inactivo, sexo, civil, eclesial, cargo] = await Promise.all([
    prisma.estadoUsuario.upsert({ where: { nombre: 'Activo' }, update: {}, create: { nombre: 'Activo' } }),
    prisma.estadoUsuario.upsert({ where: { nombre: 'Inactivo' }, update: {}, create: { nombre: 'Inactivo' } }),
    prisma.sexo.upsert({ where: { nombre: 'Femenino' }, update: {}, create: { nombre: 'Femenino' } }),
    prisma.estadoCivil.upsert({ where: { nombre: 'Soltero(a)' }, update: {}, create: { nombre: 'Soltero(a)' } }),
    prisma.estadoEclesial.upsert({ where: { nombre: 'Bautizado' }, update: {}, create: { nombre: 'Bautizado' } }),
    prisma.cargo.upsert({ where: { nombre: 'Ninguno' }, update: {}, create: { nombre: 'Ninguno' } }),
  ]);
  const rol = async (nombre: string) =>
    prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } });
  return {
    activo,
    inactivo,
    sexo,
    civil,
    eclesial,
    cargo,
    roles: {
      responsable: await rol('Responsable del sistema'),
      regional: await rol('Obispo regional'),
      distrital: await rol('Obispo distrital'),
      editor: await rol('Editor'),
      secretario: await rol('Secretario Regional'),
    },
  };
}
