import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { esES } from '@clerk/localizations'
import './index.css'
import App from './App.tsx'

// Llave publicable de Clerk (ver envPrefix en vite.config.ts). No es secreta.
const CLERK_PUBLISHABLE_KEY = import.meta.env.CLERK_PUBLISHABLE_KEY

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Falta CLERK_PUBLISHABLE_KEY en frontend/.env (o en las variables de Render)')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      localization={esES}
      appearance={{ variables: { colorPrimary: '#a855f7' } }}
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
)
