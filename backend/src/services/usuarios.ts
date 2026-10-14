// Vincula al usuario autenticado en Clerk con la tabla Usuario de la base de datos.
// La primera vez que alguien escribe en el chat se crea su registro con nombre y email de Clerk.

import { clerkClient } from '@clerk/express';
import prisma from '../db/prisma';

export async function obtenerUsuarioClerk(clerkId: string) {
  const existente = await prisma.usuario.findUnique({ where: { clerkId } });
  if (existente) return existente;

  const datos = await clerkClient.users.getUser(clerkId);
  const email = datos.primaryEmailAddress?.emailAddress ?? `${clerkId}@clerk.local`;
  const nombre =
    [datos.firstName, datos.lastName].filter(Boolean).join(' ') || datos.username || email.split('@')[0];

  // Si ya había un usuario con ese email (ej. creado por el seed) se le asigna el clerkId
  return prisma.usuario.upsert({
    where: { email },
    update: { clerkId },
    create: { nombre, email, clerkId },
  });
}
