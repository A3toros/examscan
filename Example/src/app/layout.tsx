import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'
import { AppProviders } from '@/components/providers/AppProviders'
import { Header, Footer } from '@/components/layout'
import { CookieConsentBanner } from '@/components/ui'
import I18nInitializer from '@/components/I18nInitializer'
import ClientHeader from '@/components/layout/ClientHeader'
import ConditionalFooter from '@/components/layout/ConditionalFooter'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins'
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tutorcat.online'
const siteName = 'TutorCat'
const siteDescription = 'Master English with AI-powered lessons, gamification, and your adorable cat companion. An innovative language learning platform designed for students at Mathayomwatsing School, combining gamified learning with intelligent feedback to make language acquisition engaging and effective.'
const siteImage = `${siteUrl}/favicon/android-chrome-512x512.png`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} - AI Language Learning Platform`,
    template: `%s | ${siteName}`
  },
  description: siteDescription,
  keywords: [
    'language learning',
    'English learning',
    'AI language learning',
    'gamified learning',
    'English education',
    'language learning platform',
    'TutorCat',
    'Mathayomwatsing School',
    'interactive learning',
    'speaking practice',
    'vocabulary',
    'grammar',
    'CEFR',
    'language assessment'
  ],
  authors: [{ name: 'Mathayomwatsing School' }],
  creator: 'Mathayomwatsing School',
  publisher: 'Mathayomwatsing School',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['th_TH'],
    url: siteUrl,
    siteName: siteName,
    title: `${siteName} - AI Language Learning Platform`,
    description: siteDescription,
    images: [
      {
        url: `${siteUrl}/logo.webp`,
        width: 1200,
        height: 630,
        alt: `${siteName} - AI Language Learning Platform`,
        type: 'image/webp',
      },
      {
        url: siteImage,
        width: 512,
        height: 512,
        alt: `${siteName} Logo`,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} - AI Language Learning Platform`,
    description: siteDescription,
    images: [siteImage],
    creator: '@tutorcat',
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: '/favicon/favicon.ico', sizes: 'any' },
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'android-chrome', url: '/favicon/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { rel: 'android-chrome', url: '/favicon/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/favicon/site.webmanifest',
  other: {
    'application-name': siteName,
    'apple-mobile-web-app-title': siteName,
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'mobile-web-app-capable': 'yes',
    'theme-color': '#6366f1',
    'msapplication-TileColor': '#6366f1',
    'format-detection': 'telephone=no',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased`}>
        <I18nInitializer />
        <AppProviders>
          <ClientHeader />
          <main className="pt-16 min-h-screen">
            {children}
          </main>
          <ConditionalFooter />
          <CookieConsentBanner />
        </AppProviders>
      </body>
    </html>
  )
}
