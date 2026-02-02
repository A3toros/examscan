import { useSession } from '../contexts/SessionContext'

type BilingualString = {
  en: string
  th?: string
}

export const useBilingualText = () => {
  const {
    profile: { locale },
  } = useSession()

  const renderText = ({ en, th }: BilingualString) => {
    if (locale === 'en' || !th) return en
    if (locale === 'th' && th) return th
    return `${en} / ${th}`
  }

  return { locale, renderText }
}

