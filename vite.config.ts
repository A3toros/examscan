import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { generateCSPHeader } from './src/utils/securityConfig'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': generateCSPHeader(),
      // Allow camera in dev so we can use the scanner
      // (Permissions-Policy is also set in netlify.toml for production)
      'Permissions-Policy': 'camera=*, microphone=(), geolocation=()',
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['framer-motion', 'lucide-react'],
        }
      }
    }
  }
})
