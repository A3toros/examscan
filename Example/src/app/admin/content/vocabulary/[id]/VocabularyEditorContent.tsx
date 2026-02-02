'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Card, Button, Input, Textarea } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { adminApiRequest } from '@/utils/adminApi'

interface VocabularyItem {
  id: string
  english_word: string
  thai_translation: string
  pronunciation?: string
  audio_url?: string
  difficulty_level?: string
  categories?: string[]
}

export default function VocabularyEditorContent() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const { showNotification } = useNotification()

  const [vocabularyItem, setVocabularyItem] = useState<VocabularyItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const vocabId = params.id as string

  // Load vocabulary item data
  useEffect(() => {
    loadVocabularyItem()
  }, [])

  const loadVocabularyItem = async () => {
    try {
      // Admin token is in HTTP cookie, sent automatically with credentials: 'include'
      const response = await adminApiRequest(`/.netlify/functions/admin-vocabulary?id=${vocabId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to load vocabulary item')
      }

      const result = await response.json()
      if (result.success) {
        setVocabularyItem(result.vocabularyItem)
      } else {
        throw new Error(result.error || 'Failed to load vocabulary item')
      }
    } catch (error) {
      console.error('Failed to load vocabulary item:', error)
      showNotification('Failed to load vocabulary item: ' + (error as Error).message, 'error')
      setVocabularyItem(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!vocabularyItem) return

    setIsSaving(true)
    try {
      // Admin token is in HTTP cookie, sent automatically with credentials: 'include'
      const response = await adminApiRequest(`/.netlify/functions/admin-vocabulary`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...vocabularyItem, id: vocabId })
      })

      if (!response.ok) {
        throw new Error('Failed to save vocabulary item')
      }

      const result = await response.json()
      if (result.success) {
        setVocabularyItem(result.vocabularyItem)
        showNotification('Vocabulary item saved successfully', 'success')
      } else {
        throw new Error(result.error || 'Failed to save vocabulary item')
      }
    } catch (error) {
      console.error('Failed to save vocabulary item:', error)
      showNotification('Failed to save vocabulary item', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: keyof VocabularyItem, value: any) => {
    if (!vocabularyItem) return

    setVocabularyItem(prev => prev ? {
      ...prev,
      [field]: value
    } : null)
  }

  const handleCategoryChange = (categories: string[]) => {
    setVocabularyItem(prev => prev ? {
      ...prev,
      categories
    } : null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading vocabulary editor...</p>
        </div>
      </div>
    )
  }

  if (!vocabularyItem) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <p>Vocabulary item not found</p>
          <Button onClick={() => router.push('/admin/content')} className="mt-4">
            Back to Content Management
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/admin/content')}
            >
              ← Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                Edit Vocabulary: {vocabularyItem.english_word}
              </h1>
              <p className="text-slate-400 text-sm">
                {vocabularyItem.thai_translation}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              onClick={handleSave}
              loading={isSaving}
              disabled={isSaving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Basic Information */}
          <Card className="bg-slate-800 border-slate-700">
            <Card.Header>
              <h2 className="text-lg font-semibold">Basic Information</h2>
            </Card.Header>
            <Card.Body className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    English Word
                  </label>
                  <Input
                    value={vocabularyItem.english_word}
                    onChange={(e) => handleInputChange('english_word', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Thai Translation
                  </label>
                  <Input
                    value={vocabularyItem.thai_translation}
                    onChange={(e) => handleInputChange('thai_translation', e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Pronunciation (IPA)
                </label>
                <Input
                  value={vocabularyItem.pronunciation || ''}
                  onChange={(e) => handleInputChange('pronunciation', e.target.value)}
                  placeholder="sà-wàt-dii"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </Card.Body>
          </Card>

          {/* Audio */}
          <Card className="bg-slate-800 border-slate-700">
            <Card.Header>
              <h2 className="text-lg font-semibold">Audio</h2>
            </Card.Header>
            <Card.Body className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Audio URL
                </label>
                <Input
                  value={vocabularyItem.audio_url || ''}
                  onChange={(e) => handleInputChange('audio_url', e.target.value)}
                  placeholder="https://example.com/audio/hello.mp3"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              {vocabularyItem.audio_url && (
                <div className="flex items-center space-x-4">
                  <Button variant="secondary" size="sm">
                    🔊 Play Audio
                  </Button>
                  <span className="text-slate-400 text-sm">
                    Audio file available
                  </span>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Classification */}
          <Card className="bg-slate-800 border-slate-700">
            <Card.Header>
              <h2 className="text-lg font-semibold">Classification</h2>
            </Card.Header>
            <Card.Body className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Difficulty Level
                </label>
                <select
                  value={vocabularyItem.difficulty_level || 'A1'}
                  onChange={(e) => handleInputChange('difficulty_level', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="A1">A1 - Beginner</option>
                  <option value="A2">A2 - Elementary</option>
                  <option value="B1">B1 - Intermediate</option>
                  <option value="B2">B2 - Upper Intermediate</option>
                  <option value="C1">C1 - Advanced</option>
                  <option value="C2">C2 - Proficient</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Categories (comma-separated)
                </label>
                <Input
                  value={vocabularyItem.categories?.join(', ') || ''}
                  onChange={(e) => handleCategoryChange(e.target.value.split(',').map(cat => cat.trim()))}
                  placeholder="greetings, basic, verbs"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  )
}
