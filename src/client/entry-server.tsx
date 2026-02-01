import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'

// SSR render with real Clerk key
const PUBLISHABLE_KEY = 'pk_test_YnJhdmUtc2VhZ3VsbC00Ny5jbGVyay5hY2NvdW50cy5kZXYk'

export function render(_url: string) {
  const html = renderToString(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    </StrictMode>,
  )
  return { html }
}
