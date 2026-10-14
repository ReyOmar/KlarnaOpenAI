// Roles: el administrador tiene { "role": "admin" } en los metadatos públicos de Clerk;
// cualquier otro usuario es cliente y solo usa el chat.
// La protección real está en el backend (requiereAdmin); aquí solo se adapta la interfaz.

import { useUser } from '@clerk/react';

declare global {
  interface UserPublicMetadata {
    role?: 'admin';
  }
}

export function useEsAdmin(): boolean {
  const { user } = useUser();
  return user?.publicMetadata.role === 'admin';
}
