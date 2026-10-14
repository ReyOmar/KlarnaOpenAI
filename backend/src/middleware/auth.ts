// Autenticación con Clerk: toda la API (salvo /api/health) requiere sesión iniciada.
// El frontend envía el token de sesión en el header Authorization: Bearer <token>.

import { NextFunction, Request, Response } from 'express';
import { clerkMiddleware, getAuth } from '@clerk/express';

// Lee CLERK_PUBLISHABLE_KEY y CLERK_SECRET_KEY del entorno
export const clerk = clerkMiddleware();

export function clerkConfigurado(): boolean {
  return Boolean(process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export function requiereSesion(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Debes iniciar sesión' });
    return;
  }
  next();
}

// Rol "admin" en los metadatos públicos del usuario (Clerk → Users → Metadata → Public).
// Sin ese rol el usuario es cliente: solo puede usar el chat.
export function requiereAdmin(req: Request, res: Response, next: NextFunction): void {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Debes iniciar sesión' });
    return;
  }
  if (sessionClaims?.metadata?.role !== 'admin') {
    res.status(403).json({ error: 'Solo los administradores pueden acceder al panel' });
    return;
  }
  next();
}
