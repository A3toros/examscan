/**
 * Production-safe logger utility
 * Logs only in development, removes logs from production bundle
 */

const isDev = process.env.NODE_ENV === 'development'

export const log = (...args: any[]) => {
  if (isDev) console.log(...args)
}

export const warn = (...args: any[]) => {
  if (isDev) console.warn(...args)
}

export const error = (...args: any[]) => {
  // Always log errors, even in production (for debugging)
  console.error(...args)
}

export const info = (...args: any[]) => {
  if (isDev) console.info(...args)
}

export const debug = (...args: any[]) => {
  if (isDev) console.debug(...args)
}

// Server-side logger (for Netlify functions)
// Logs critical info even in production (auth failures, API errors)
export const serverLog = {
  // Always log (for server monitoring)
  error: (...args: any[]) => console.error(...args),
  warn: (...args: any[]) => console.warn(...args),
  
  // Only in dev
  debug: (...args: any[]) => {
    if (isDev) console.log('[DEBUG]', ...args)
  },
  
  // Critical server events (always log)
  auth: (...args: any[]) => console.log('[AUTH]', ...args),
  api: (...args: any[]) => {
    if (isDev) console.log('[API]', ...args)
  },
  
  // Cleanup operations (always log for monitoring)
  cleanup: (...args: any[]) => console.log('[Cleanup]', ...args),
}

