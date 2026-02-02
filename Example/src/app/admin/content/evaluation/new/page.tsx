'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import EvaluationCreatorContent from './EvaluationCreatorContent'

export default function NewEvaluationPage() {
  const router = useRouter()

  return <EvaluationCreatorContent />
}
