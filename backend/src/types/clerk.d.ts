// Claims propios del token de sesión de Clerk.
// En Clerk: Configure → Sessions → Customize session token → { "metadata": "{{user.public_metadata}}" }

export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata?: { role?: 'admin' };
  }
}
