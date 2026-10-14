// Autenticación con Clerk: toda la API (salvo /api/health) requiere sesión iniciada.
// El frontend envía el token de sesión en el header Authorization: Bearer <token>.

import { NextFunction, Request, Response } from 'express';
import { clerkMiddleware, getAuth } from '@clerk/express';

// Lee CLERK_PUBLISHABLE_KEY y CLERK_SECRET_KEY del entorno
export const clerk = clerkMiddleware();

export function requiereSesion(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Debes iniciar sesión' });
    return;
  }
  next();
}
