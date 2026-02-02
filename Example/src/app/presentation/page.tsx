'use client'

import { useRouter } from 'next/navigation'
import Presentation from '@/components/ui/Presentation'

export default function PresentationPage() {
  const router = useRouter()

  const handleClose = () => {
    router.push('/')
  }

  return <Presentation isOpen={true} onClose={handleClose} />
}
