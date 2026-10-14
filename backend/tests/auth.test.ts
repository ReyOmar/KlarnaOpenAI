import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';
import { requiereAdmin, requiereSesion } from '../src/middleware/auth';

// Simula la petición tal como la deja clerkMiddleware (req.auth) y captura la respuesta
function ejecutar(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  sesion: { userId: string | null; role?: string }
) {
  const auth = () => ({
    tokenType: 'session_token',
    isAuthenticated: sesion.userId !== null,
    userId: sesion.userId,
    sessionClaims: sesion.userId ? { metadata: sesion.role ? { role: sesion.role } : {} } : null,
  });
  // Marca con la que @clerk/express reconoce que clerkMiddleware ya procesó la petición
  Object.assign(auth, { [Symbol.for('@clerk/express.auth')]: true });
  const req = { auth } as unknown as Request;
  const resultado = { status: 200, siguio: false };
  const res = {
    status(codigo: number) {
      resultado.status = codigo;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  middleware(req, res, () => {
    resultado.siguio = true;
  });
  return resultado;
}

test('sin sesión las rutas responden 401', () => {
  assert.deepEqual(ejecutar(requiereSesion, { userId: null }), { status: 401, siguio: false });
  assert.deepEqual(ejecutar(requiereAdmin, { userId: null }), { status: 401, siguio: false });
});

test('un cliente usa el chat pero no el panel', () => {
  assert.equal(ejecutar(requiereSesion, { userId: 'user_cliente' }).siguio, true);
  assert.deepEqual(ejecutar(requiereAdmin, { userId: 'user_cliente' }), { status: 403, siguio: false });
});

test('un administrador entra al panel', () => {
  assert.equal(ejecutar(requiereAdmin, { userId: 'user_admin', role: 'admin' }).siguio, true);
});
