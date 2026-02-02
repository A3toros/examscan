/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '**',
      },
    ],
  },
  // Remove console logs in production (keep console.error and console.warn)
  compiler: {
    removeConsole: isProd ? { exclude: ['error', 'warn'] } : false
  },
  // API routes are handled by Netlify functions via netlify.toml redirects
}

module.exports = nextConfig
