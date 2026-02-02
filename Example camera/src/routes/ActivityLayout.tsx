import type { PropsWithChildren } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useSession } from '../contexts/SessionContext'
import { SnowfallBackground } from '../components/ui/snowfall-background'

export const ActivityLayout = ({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) => {
  const { profile } = useSession()

  return (
    <div className="min-h-screen relative bg-[#DC2626]">
      {/* Snowfall Background */}
      <SnowfallBackground density={0.3} />
      
      <section className="space-y-6 rounded-3xl border-2 border-white bg-[#ee564a]/40 p-8 shadow-[0_0_30px_rgba(22,163,74,0.2)] relative z-10 mx-4 my-4">
        <header className="space-y-2 relative">
          <p className="text-sm uppercase tracking-[0.4em] text-white/70">{profile.locale.toUpperCase()}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/" className="flex-shrink-0 hover:opacity-80 transition-opacity absolute left-0 hover:brightness-150">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h2 className="font-display text-3xl text-white" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.5)' }}>{title}</h2>
          </div>
          <p className="text-white/90 text-center">{subtitle}</p>
        </header>

        <motion.div layout className="space-y-4">
          {children}
        </motion.div>
      </section>
    </div>
  )
}

