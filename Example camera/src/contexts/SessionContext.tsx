import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { nanoid } from 'nanoid'

export type VisitorProfile = {
  visitorId: string
  displayName?: string
  locale: 'en' | 'th' | 'bilingual'
}

type SessionContextValue = {
  profile: VisitorProfile
  setLocale: (locale: VisitorProfile['locale']) => void
  setDisplayName: (name: string) => void
  resetSession: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<VisitorProfile>({
    visitorId: nanoid(),
    locale: 'bilingual',
  })

  const value = useMemo<SessionContextValue>(
    () => ({
      profile,
      setLocale: (locale) => setProfile((prev) => ({ ...prev, locale })),
      setDisplayName: (displayName) => setProfile((prev) => ({ ...prev, displayName })),
      resetSession: () => setProfile({ visitorId: nanoid(), locale: 'bilingual' }),
    }),
    [profile],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = () => {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return ctx
}

