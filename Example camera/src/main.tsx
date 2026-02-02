import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SessionProvider } from './contexts/SessionContext.tsx'
import { AudioProvider } from './contexts/AudioContext.tsx'
import { AIRequestProvider } from './contexts/AIRequestContext.tsx'
import ConfettiOverlay from './components/ui/ConfettiOverlay.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <AudioProvider>
        <AIRequestProvider>
          <>
            <ConfettiOverlay />
            <App />
          </>
        </AIRequestProvider>
      </AudioProvider>
    </SessionProvider>
  </StrictMode>,
)

