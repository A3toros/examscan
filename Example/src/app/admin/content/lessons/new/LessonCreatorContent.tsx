'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Card, Button, Input, Select, Textarea, Modal } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { adminApiRequest } from '@/utils/adminApi'
import { Plus, Trash2, Edit3, Save, X, FileText, Eye, EyeOff, Upload, Mic, MicOff, Play, Square, Volume2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface VocabularyItem {
  id: string
  english_word: string
  thai_translation: string
  audio_url?: string
}

interface Activity {
  id: string
  activity_type: string
  activity_order: number
  title?: string
  description?: string
  estimated_time_seconds?: number
  content: any
  vocabulary_items?: VocabularyItem[]
  grammar_sentences?: any[]
}

interface Lesson {
  level: string
  topic: string
  lesson_number: number
  activities: Activity[]
}

const activityTypes = [
  { value: 'warm_up_speaking', label: 'Warm-up Speaking' },
  { value: 'vocabulary_intro', label: 'Vocabulary Introduction' },
  { value: 'vocabulary_matching_drag', label: 'Vocabulary Matching Drag' },
  { value: 'vocabulary_fill_blanks', label: 'Vocabulary Fill Blanks' },
  { value: 'grammar_explanation', label: 'Grammar Explanation' },
  { value: 'grammar_sentences', label: 'Sentence Builder' },
  { value: 'speaking_practice', label: 'Speaking Practice' },
  { value: 'listening_practice', label: 'Listening Practice' }
]

const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// Supabase client for file uploads (following the working example pattern)
// Note: Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY env vars
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || ''
) : null

// Listening Practice Editor Component
function ListeningPracticeEditor({ activity, updateActivity }: { activity: Activity, updateActivity: (id: string, updates: Partial<Activity>) => void }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState(activity.content.audio_url || '')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement>(null)

  const updateContent = (field: string, value: any) => {
    updateActivity(activity.id, {
      content: { ...activity.content, [field]: value }
    })
  }

  // File upload to Supabase
  const uploadAudioFile = async (file: File) => {
    if (!supabase) {
      alert('Supabase not configured. Please set NEXT_PUBLIC_SUPABASE_URL environment variable.')
      return
    }

    setIsUploading(true)
    try {
      // Convert to webm if needed
      const webmFile = await convertToWebM(file)

      const fileName = `listening-${activity.id}-${Date.now()}.webm`
      const { data, error } = await supabase.storage
        .from('audio-files')
        .upload(fileName, webmFile, {
          contentType: 'audio/webm',
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      console.log('Audio uploaded successfully:', data.path)

      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName)

      updateContent('audio_url', publicUrl)
      setAudioUrl(publicUrl)
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload audio file: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsUploading(false)
    }
  }

  // Convert audio to WebM
  const convertToWebM = async (file: File): Promise<File> => {
    // For TTS-generated files, they're already in good format
    if (file.name.includes('tts-')) {
      return file
    }

    return new Promise((resolve) => {
      // For now, just return the original file
      // In production, you'd implement proper conversion
      resolve(file)
    })
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const audioFile = files.find(file => file.type.startsWith('audio/'))

    if (audioFile) {
      uploadAudioFile(audioFile)
    }
  }

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' })
        await uploadAudioFile(audioFile)

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Recording error:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // TTS (Text-to-Speech) using OpenAI
  const generateTTS = async () => {
    const text = activity.content.transcript || activity.content.audio_description
    if (!text) {
      alert('Please add transcript text first')
      return
    }

    setIsUploading(true)
    try {
      const response = await fetch('/.netlify/functions/tts-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: 'alloy' // OpenAI voice
        })
      })

      if (!response.ok) {
        throw new Error('TTS generation failed')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'TTS generation failed')
      }

      // TTS function already uploaded to Supabase, just update the URL
      const publicUrl = result.public_url
      updateContent('audio_url', publicUrl)
      setAudioUrl(publicUrl)
    } catch (error) {
      console.error('TTS error:', error)
      alert('Failed to generate voiceover: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsUploading(false)
    }
  }

  // Play audio
  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  return (
    <div className="space-y-6">
      {/* Audio Description */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Audio Description</label>
        <Textarea
          value={activity.content.audio_description || ''}
          onChange={(e) => updateContent('audio_description', e.target.value)}
          placeholder="Describe what students will hear..."
          rows={3}
        />
      </div>

      {/* Transcript */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Transcript</label>
        <Textarea
          value={activity.content.transcript || ''}
          onChange={(e) => updateContent('transcript', e.target.value)}
          placeholder="Full transcript of the audio..."
          rows={4}
        />
      </div>

      {/* Audio Upload Section */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Audio File</label>

        {/* Current Audio */}
        {audioUrl && (
          <div className="flex items-center space-x-3 mb-4 p-3 bg-slate-700 rounded-lg">
            <Button
              onClick={playAudio}
              variant="secondary"
              size="sm"
              disabled={!audioUrl}
            >
              <Play className="w-4 h-4" />
            </Button>
            <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />
            <span className="text-sm text-slate-300">Audio file uploaded</span>
          </div>
        )}

        {/* Upload Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Button
              onClick={() => document.getElementById('audio-upload')?.click()}
              variant="secondary"
              className="w-full"
              disabled={isUploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload Audio'}
            </Button>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadAudioFile(file)
              }}
            />
          </div>

          {/* Record Audio */}
          <div className="space-y-2">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "danger" : "secondary"}
              className="w-full"
            >
              {isRecording ? <Square className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
              {isRecording ? 'Stop Recording' : 'Record Audio'}
            </Button>
          </div>

          {/* TTS */}
          <div className="space-y-2">
            <Button
              onClick={generateTTS}
              variant="secondary"
              className="w-full"
              disabled={!activity.content.transcript}
            >
              <Volume2 className="w-4 h-4 mr-2" />
              Voiceover (TTS)
            </Button>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div
          className={`mt-4 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-sky-400 bg-sky-50/10'
              : 'border-slate-600 hover:border-slate-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-4xl mb-4">🎵</div>
          <p className="text-slate-300 mb-2">Drag and drop audio files here</p>
          <p className="text-sm text-slate-500">Supports MP3, WAV, M4A formats</p>
        </div>
      </div>

      {/* Questions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-300">Listening Questions</label>
          <Button
            size="sm"
            onClick={() => {
              const newQuestions = [...(activity.content.questions || []), { question: '', options: ['', '', ''], correct_answer: 0 }]
              updateContent('questions', newQuestions)
            }}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Question
          </Button>
        </div>

        <div className="space-y-3">
          {(activity.content.questions || []).map((question: any, index: number) => (
            <div key={index} className="p-4 bg-slate-700 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Question {index + 1}</span>
                <Button
                  size="sm"
                  variant="danger"
                onClick={() => {
                  const newQuestions = (activity.content.questions || []).filter((q: any, i: number) => i !== index)
                  updateContent('questions', newQuestions)
                }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <Input
                value={question.question || ''}
                onChange={(e) => {
                  const newQuestions = [...(activity.content.questions || [])]
                  newQuestions[index] = { ...newQuestions[index], question: e.target.value }
                  updateContent('questions', newQuestions)
                }}
                placeholder="Enter listening question..."
              />

              <div className="space-y-2">
                <label className="block text-xs text-slate-400">Answer Options</label>
                {question.options?.map((option: string, optionIndex: number) => (
                  <div key={optionIndex} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name={`question-${index}`}
                      checked={question.correct_answer === optionIndex}
                      onChange={() => {
                        const newQuestions = [...(activity.content.questions || [])]
                        newQuestions[index] = { ...newQuestions[index], correct_answer: optionIndex }
                        updateContent('questions', newQuestions)
                      }}
                      className="text-sky-500"
                    />
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newQuestions = [...(activity.content.questions || [])]
                        const newOptions = [...(newQuestions[index].options || [])]
                        newOptions[optionIndex] = e.target.value
                        newQuestions[index] = { ...newQuestions[index], options: newOptions }
                        updateContent('questions', newQuestions)
                      }}
                      placeholder={`Option ${optionIndex + 1}`}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LessonCreatorContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const { showNotification } = useNotification()

  const lessonId = params?.id as string
  const isEditing = !!lessonId

  const [lesson, setLesson] = useState<Lesson>({
    level: 'A1',
    topic: '',
    lesson_number: 1,
    activities: []
  })

  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isLoading, setIsLoading] = useState(isEditing)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [nextActivityOrder, setNextActivityOrder] = useState(1)
  const [isDraft, setIsDraft] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Local storage keys
  const getStorageKey = () => isEditing ? `lesson-edit-${lessonId}` : 'lesson-create-draft'

  // Load lesson data (for editing or from localStorage)
  useEffect(() => {
    const loadLessonData = async () => {
      try {
        // First try to load from localStorage
        const savedData = localStorage.getItem(getStorageKey())
        if (savedData) {
          const parsedData = JSON.parse(savedData)
          setLesson(parsedData.lesson)
          setNextActivityOrder(parsedData.nextActivityOrder || parsedData.lesson.activities.length + 1)
          setIsDraft(parsedData.isDraft || false)
          setHasUnsavedChanges(true)
          return
        }

        // If editing and no localStorage, load from API
        if (isEditing) {
          // Admin token is in HTTP cookie, sent automatically with credentials: 'include'
          const response = await adminApiRequest(`/.netlify/functions/admin-lessons?id=${lessonId}`, {
            method: 'GET'
          })

          if (!response.ok) {
            throw new Error('Failed to load lesson')
          }

          const result = await response.json()
          if (result.success && result.lesson) {
            const loadedLesson = result.lesson
            setLesson({
              level: loadedLesson.level,
              topic: loadedLesson.topic,
              lesson_number: loadedLesson.lesson_number,
              activities: loadedLesson.activities || []
            })
            setNextActivityOrder((loadedLesson.activities?.length || 0) + 1)
            setIsDraft(loadedLesson.is_draft || false)
          } else {
            throw new Error('Lesson not found')
          }
        }
      } catch (error) {
        console.error('Failed to load lesson:', error)
        showNotification('Failed to load lesson: ' + (error as Error).message, 'error')
        router.push('/admin/content')
      } finally {
        setIsLoading(false)
      }
    }

    loadLessonData()
  }, [isEditing, lessonId, router, showNotification])

  // Auto-save to localStorage when lesson changes
  useEffect(() => {
    if (!isLoading && hasUnsavedChanges) {
      const dataToSave = {
        lesson,
        nextActivityOrder,
        isDraft,
        lastSaved: new Date().toISOString()
      }
      localStorage.setItem(getStorageKey(), JSON.stringify(dataToSave))
    }
  }, [lesson, nextActivityOrder, isDraft, isLoading, hasUnsavedChanges, getStorageKey])

  // Mark as having unsaved changes when lesson is modified
  const markAsChanged = () => {
    if (!hasUnsavedChanges) {
      setHasUnsavedChanges(true)
    }
  }

  const handleLessonChange = async (field: keyof Lesson, value: any) => {
    if (field === 'level' && !isEditing) {
      // When level changes, auto-calculate next lesson number
      try {
        const response = await adminApiRequest('/.netlify/functions/admin-lessons', {
          method: 'GET'
        })
        
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.lessons) {
            // Find the highest lesson number for this level
            const levelLessons = result.lessons.filter((l: Lesson) => l.level === value)
            const maxLessonNumber = levelLessons.length > 0
              ? Math.max(...levelLessons.map((l: Lesson) => l.lesson_number))
              : 0
            const nextLessonNumber = maxLessonNumber + 1
            
            setLesson(prev => ({ ...prev, level: value, lesson_number: nextLessonNumber }))
            markAsChanged()
            return
          }
        }
      } catch (error) {
        console.error('Failed to fetch lessons for auto-numbering:', error)
      }
    }
    
    setLesson(prev => ({ ...prev, [field]: value }))
    markAsChanged()
  }

  const addActivity = (activityType: string) => {
    const newActivity: Activity = {
      id: `temp-${Date.now()}`,
      activity_type: activityType,
      activity_order: nextActivityOrder,
      content: getDefaultContent(activityType),
      vocabulary_items: activityType.includes('vocabulary') ? [] : undefined
    }

    setLesson(prev => ({
      ...prev,
      activities: [...prev.activities, newActivity]
    }))

    setNextActivityOrder(prev => prev + 1)
    setShowActivityModal(false)
    markAsChanged()
  }

  const getDefaultContent = (activityType: string) => {
    switch (activityType) {
      case 'warm_up_speaking':
        return {
          prompt: ''
        }
      case 'vocabulary_intro':
        return {
          title: '',
          description: '',
          vocabulary_items: []
        }
      case 'vocabulary_matching_drag':
        return {
          vocabulary_items: []
        }
      case 'vocabulary_fill_blanks':
        return {
          text: '',
          vocabulary_items: []
        }
      case 'grammar_explanation':
        return {
          title: '',
          rules: '',
          examples: []
        }
      case 'grammar_sentences':
        return {
          sentence: ''
        }
      case 'speaking_practice':
        return {
          prompt: ''
        }
      case 'listening_practice':
        return {
          audio_description: '',
          transcript: '',
          questions: []
        }
      default:
        return {}
    }
  }

  const updateActivity = (activityId: string, updates: Partial<Activity>) => {
    setLesson(prev => ({
      ...prev,
      activities: prev.activities.map(activity =>
        activity.id === activityId ? { ...activity, ...updates } : activity
      )
    }))
    markAsChanged()
  }

  const removeActivity = (activityId: string) => {
    setLesson(prev => ({
      ...prev,
      activities: prev.activities.filter(activity => activity.id !== activityId)
    }))

    // Reorder activities
    setLesson(prev => {
      const updatedActivities = prev.activities.map((activity, index) => ({
        ...activity,
        activity_order: index + 1
      }))
      setNextActivityOrder(updatedActivities.length)
      markAsChanged()
      return {
        ...prev,
        activities: updatedActivities
      }
    })
  }

  const moveActivity = (activityId: string, direction: 'up' | 'down') => {
    setLesson(prev => {
      const activities = [...prev.activities]
      const index = activities.findIndex(a => a.id === activityId)

      if (direction === 'up' && index > 0) {
        [activities[index], activities[index - 1]] = [activities[index - 1], activities[index]]
      } else if (direction === 'down' && index < activities.length - 1) {
        [activities[index], activities[index + 1]] = [activities[index + 1], activities[index]]
      }

      // Update order numbers
      activities.forEach((activity, idx) => {
        activity.activity_order = idx + 1
      })

      return { ...prev, activities }
    })
    markAsChanged()
  }

  const addVocabularyItem = (activityId: string) => {
    const newItem: VocabularyItem = {
      id: `vocab-${Date.now()}`,
      english_word: '',
      thai_translation: '',
      audio_url: ''
    }

    const currentActivity = lesson.activities.find(a => a.id === activityId)
    const currentItems = currentActivity?.vocabulary_items || []
    const updatedItems = [...currentItems, newItem]

    updateActivity(activityId, {
      vocabulary_items: updatedItems
    })
  }

  const updateVocabularyItem = (activityId: string, itemId: string, field: keyof VocabularyItem, value: string) => {
    const activity = lesson.activities.find(a => a.id === activityId)
    if (!activity?.vocabulary_items) return

    const updatedItems = activity.vocabulary_items.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    )

    updateActivity(activityId, { vocabulary_items: updatedItems })
  }

  const removeVocabularyItem = (activityId: string, itemId: string) => {
    const activity = lesson.activities.find(a => a.id === activityId)
    if (!activity?.vocabulary_items) return

    const updatedItems = activity.vocabulary_items.filter(item => item.id !== itemId)
    updateActivity(activityId, { vocabulary_items: updatedItems })
  }


  const validateActivityContent = (activity: Activity): string | null => {
    switch (activity.activity_type) {
      case 'warm_up_speaking':
        if (!activity.content.prompt?.trim()) {
          return 'Warm-up Speaking activity requires a prompt'
        }
        break

      case 'vocabulary_intro':
        if (!activity.content.title?.trim()) {
          return 'Vocabulary Introduction requires a title'
        }
        if (!activity.content.description?.trim()) {
          return 'Vocabulary Introduction requires a description'
        }
        if (!activity.vocabulary_items || activity.vocabulary_items.length === 0) {
          return 'Vocabulary Introduction requires at least one vocabulary item. Click "Add Word" to add vocabulary pairs.'
        }
        // Check each vocabulary item has required fields
        for (const item of activity.vocabulary_items) {
          if (!item.english_word?.trim() || !item.thai_translation?.trim()) {
            return 'All vocabulary items must have both English word and Thai translation filled in.'
          }
        }
        break

      case 'vocabulary_matching_drag':
        if (!activity.vocabulary_items || activity.vocabulary_items.length === 0) {
          return 'Vocabulary Matching Drag requires at least one vocabulary item. Click "Add Word" to add vocabulary pairs.'
        }

        for (const item of activity.vocabulary_items) {
          if (!item.english_word?.trim() || !item.thai_translation?.trim()) {
            return 'All vocabulary items must have both English word and Thai translation filled in.'
          }
        }
        break

      case 'vocabulary_fill_blanks':
        if (!activity.content.text?.trim()) {
          return 'Vocabulary Fill Blanks requires text with blanks'
        }
        if (!activity.vocabulary_items || activity.vocabulary_items.length === 0) {
          return 'Vocabulary Fill Blanks requires correct answers. Click "Add Answer" to add the correct words.'
        }
        for (const item of activity.vocabulary_items) {
          if (!item.english_word?.trim()) {
            return 'All vocabulary items must have the correct answer word filled in.'
          }
        }
        break

      case 'grammar_explanation':
        if (!activity.content.title?.trim()) {
          return 'Grammar Explanation requires a title'
        }
        if (!activity.content.rules?.trim() && !activity.content.explanation?.trim()) {
          return 'Grammar Explanation requires grammar rules'
        }
        break

      case 'grammar_sentences':
        if (!activity.content.sentence?.trim()) {
          return 'Sentence Builder requires a sentence'
        }
        break

      case 'speaking_practice':
        if (!activity.content.prompt?.trim()) {
          return 'Speaking Practice requires a prompt'
        }
        break

      case 'listening_practice':
        if (!activity.content.audio_description?.trim()) {
          return 'Listening Practice requires an audio description'
        }
        if (!activity.content.transcript?.trim()) {
          return 'Listening Practice requires a transcript'
        }
        if (!activity.content.questions || activity.content.questions.length === 0) {
          return 'Listening Practice requires at least one question'
        }
        // Check each question has required fields
        for (const question of activity.content.questions) {
          if (!question.question?.trim()) {
            return 'All listening questions must have question text'
          }
          if (!question.options || question.options.length < 2) {
            return 'All listening questions must have at least 2 options'
          }
          if (!question.correct_answer) {
            return 'All listening questions must have a correct answer'
          }
        }
        break
    }
    return null // No validation errors
  }

  const saveLesson = async (asDraft = false) => {
    if (!lesson.topic.trim()) {
      showNotification('Please enter a lesson topic', 'error')
      return
    }

    if (!asDraft && lesson.activities.length === 0) {
      showNotification('Please add at least one activity', 'error')
      return
    }

    // Validate activity content
    for (const activity of lesson.activities) {
      const validationError = validateActivityContent(activity)
      if (validationError) {
        showNotification(validationError, 'error')
        return
      }
    }

    setIsSaving(true)
    setIsPublishing(!asDraft)

    try {
      // Admin token is in HTTP cookie, sent automatically with credentials: 'include'

      // Generate lesson ID for new lessons (format: A1-L1, A1-L2, etc.)
      const lessonIdToUse = isEditing ? lessonId : `${lesson.level}-L${lesson.lesson_number}`

      const requestBody = {
        lesson: {
          id: lessonIdToUse,
          level: lesson.level,
          topic: lesson.topic,
          lesson_number: lesson.lesson_number,
          is_draft: asDraft
        },
        activities: lesson.activities.map(activity => ({
          ...activity,
          id: isEditing ? activity.id : undefined // Keep IDs for editing, remove for new
        }))
      }

      console.log('📡 Making API call to:', '/.netlify/functions/admin-lessons')
      console.log('📨 Request method:', isEditing ? 'PUT' : 'POST')
      console.log('📦 Request body:', requestBody)

      // Admin token is in HTTP cookie, sent automatically with credentials: 'include'
      const response = await adminApiRequest('/.netlify/functions/admin-lessons', {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Failed to save lesson: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success) {
        // Clear localStorage on successful save
        localStorage.removeItem(getStorageKey())
        setHasUnsavedChanges(false)
        setIsDraft(asDraft)

        const message = asDraft
          ? 'Draft saved successfully!'
          : (isEditing ? 'Lesson updated successfully!' : 'Lesson created successfully!')

        showNotification(message, 'success')

        if (!asDraft) {
          router.push('/admin/content')
        }
      } else {
        throw new Error(result.error || 'Failed to save lesson')
      }
    } catch (error) {
      console.error('Failed to save lesson:', error)
      showNotification('Failed to save lesson: ' + (error as Error).message, 'error')
    } finally {
      setIsSaving(false)
      setIsPublishing(false)
    }
  }

  const renderActivityContent = (activity: Activity) => {
    const updateContent = (field: string, value: any) => {
      updateActivity(activity.id, {
        content: { ...activity.content, [field]: value }
      })
    }

    switch (activity.activity_type) {
      case 'warm_up_speaking':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Prompt</label>
              <Textarea
                value={activity.content.prompt || ''}
                onChange={(e) => updateContent('prompt', e.target.value)}
                placeholder="Enter the speaking prompt..."
                rows={3}
              />
            </div>
          </div>
        )

      case 'vocabulary_intro':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
              <Input
                value={activity.content.title || ''}
                onChange={(e) => updateContent('title', e.target.value)}
                placeholder="Vocabulary topic title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <Textarea
                value={activity.content.description || ''}
                onChange={(e) => updateContent('description', e.target.value)}
                placeholder="Describe the vocabulary topic..."
                rows={3}
              />
            </div>

            {/* Vocabulary Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Vocabulary Items</label>
                <Button
                  size="sm"
                  onClick={() => addVocabularyItem(activity.id)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Word
                </Button>
              </div>
              <div className="space-y-2">
                {activity.vocabulary_items?.map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-2 p-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-indigo-100 transition-colors">
                    <span className="text-slate-600 text-sm w-6 font-medium">{index + 1}.</span>
                    <Input
                      value={item.english_word}
                      onChange={(e) => updateVocabularyItem(activity.id, item.id, 'english_word', e.target.value)}
                      placeholder="English word"
                      className="flex-1"
                    />
                    <Input
                      value={item.thai_translation}
                      onChange={(e) => updateVocabularyItem(activity.id, item.id, 'thai_translation', e.target.value)}
                      placeholder="Thai translation"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => removeVocabularyItem(activity.id, item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'vocabulary_matching_drag':
        return (
          <div className="space-y-4">

            {/* Vocabulary Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Vocabulary Items</label>
                <Button
                  size="sm"
                  onClick={() => addVocabularyItem(activity.id)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Word
                </Button>
              </div>
              <div className="space-y-2">
                {activity.vocabulary_items?.map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-2 p-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-indigo-100 transition-colors">
                    <span className="text-slate-600 text-sm w-6 font-medium">{index + 1}.</span>
                    <Input
                      value={item.english_word}
                      onChange={(e) => updateVocabularyItem(activity.id, item.id, 'english_word', e.target.value)}
                      placeholder="English word"
                      className="flex-1"
                    />
                    <Input
                      value={item.thai_translation}
                      onChange={(e) => updateVocabularyItem(activity.id, item.id, 'thai_translation', e.target.value)}
                      placeholder="Thai translation"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => removeVocabularyItem(activity.id, item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'vocabulary_fill_blanks':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Text with Blanks</label>
              <Textarea
                value={activity.content.text || ''}
                onChange={(e) => updateContent('text', e.target.value)}
                placeholder="Enter text with [blank] placeholders..."
                rows={6}
              />
            </div>

            {/* Vocabulary Items - Correct Answers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Vocabulary Items (Correct Answers)</label>
                <Button
                  size="sm"
                  onClick={() => addVocabularyItem(activity.id)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Answer
                </Button>
              </div>
              <div className="space-y-2">
                {activity.vocabulary_items?.map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-2 p-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-indigo-100 transition-colors">
                    <span className="text-slate-600 text-sm w-6 font-medium">{index + 1}.</span>
                    <Input
                      value={item.english_word}
                      onChange={(e) => updateVocabularyItem(activity.id, item.id, 'english_word', e.target.value)}
                      placeholder="Correct word"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => removeVocabularyItem(activity.id, item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'grammar_explanation':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
              <Input
                value={activity.content.title || ''}
                onChange={(e) => updateContent('title', e.target.value)}
                placeholder="Grammar rule title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Rules</label>
              <Textarea
                value={activity.content.rules || activity.content.explanation || ''}
                onChange={(e) => updateContent('rules', e.target.value)}
                placeholder="Explain the grammar rules (one rule per line or paragraph)..."
                rows={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Examples</label>
              <Textarea
                value={activity.content.examples?.join('\n') || ''}
                onChange={(e) => updateContent('examples', e.target.value.split('\n').filter(line => line.trim()))}
                placeholder="One example per line..."
                rows={3}
              />
            </div>
          </div>
        )

      case 'grammar_sentences':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Sentence to Build</label>
              <Textarea
                value={activity.content.sentence || ''}
                onChange={(e) => updateContent('sentence', e.target.value)}
                placeholder="Type the complete sentence that students will rebuild..."
                rows={3}
              />
              <p className="text-xs text-slate-500 mt-1">
                Students will see the words shuffled and need to drag them back into the correct order.
              </p>
            </div>
          </div>
        )

      case 'listening_practice':
        return <ListeningPracticeEditor activity={activity} updateActivity={updateActivity} />

      default:
        return (
          <div className="text-slate-400 text-center py-8">
            Content editor for {activity.activity_type} coming soon...
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100 text-slate-800">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200 px-6 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/admin/content')}
            >
              ← Back to Content
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {isEditing ? 'Edit Lesson' : 'Create New Lesson'}
                {hasUnsavedChanges && <span className="text-orange-500 text-sm ml-2">• Unsaved Changes</span>}
                {isDraft && <span className="text-sky-500 text-sm ml-2">• Draft</span>}
              </h1>
              <p className="text-purple-600 text-sm">
                {isEditing ? 'Modify lesson content and activities' : 'Build a complete lesson with activities and tasks'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => saveLesson(true)}
              disabled={isSaving}
              variant="secondary"
            >
              <FileText className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              onClick={() => saveLesson(false)}
              disabled={isSaving}
              className="bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Publishing...' : (isEditing ? 'Update Lesson' : 'Publish Lesson')}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Lesson Settings */}
        <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300 mb-6">
          <Card.Header>
            <h2 className="text-lg font-semibold">Lesson Settings</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Level</label>
                <Select
                  value={lesson.level}
                  onChange={(e) => handleLessonChange('level', e.target.value)}
                >
                  {levels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Lesson Number</label>
                <Input
                  type="number"
                  value={lesson.lesson_number}
                  onChange={(e) => handleLessonChange('lesson_number', parseInt(e.target.value))}
                  min={1}
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-300 mb-1">Topic</label>
                <Input
                  value={lesson.topic}
                  onChange={(e) => handleLessonChange('topic', e.target.value)}
                  placeholder="Enter lesson topic..."
                />
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Activities */}
        <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Activities ({lesson.activities.length})</h2>
              <Button
                onClick={() => setShowActivityModal(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Activity
              </Button>
            </div>
          </Card.Header>
          <Card.Body>
            {lesson.activities.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <div className="text-4xl mb-4">📝</div>
                <p>No activities added yet. Click "Add Activity" to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {lesson.activities.map((activity, index) => (
                  <div
                    key={activity.id}
                    className="border border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="bg-purple-600 text-white px-2 py-1 rounded text-sm font-medium">
                          #{activity.activity_order}
                        </span>
                        <h3 className="font-semibold text-slate-800">
                          {activityTypes.find(type => type.value === activity.activity_type)?.label}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => moveActivity(activity.id, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => moveActivity(activity.id, 'down')}
                          disabled={index === lesson.activities.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeActivity(activity.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {renderActivityContent(activity)}
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Activity Type Modal */}
        <Modal
          isOpen={showActivityModal}
          onClose={() => setShowActivityModal(false)}
          title="Add Activity"
          size="lg"
        >
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-800 bg-gradient-to-r from-sky-600 to-purple-600 bg-clip-text text-transparent">
                Choose an activity type to add to your lesson
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mt-2">
                Select the type of activity you'd like to add to your lesson. Each activity type offers unique learning experiences for your students.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {activityTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => addActivity(type.value)}
                  className="p-6 text-left bg-gradient-to-br from-white via-sky-50/50 to-purple-50/70 hover:from-sky-100/90 hover:via-purple-100/70 hover:to-indigo-100/80 rounded-xl border-2 border-purple-200/70 hover:border-purple-400 hover:border-sky-300 transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-purple-300/30 group transform hover:scale-[1.02] hover:-translate-y-1 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
                >
                  <div className="font-bold text-lg text-slate-800 group-hover:text-sky-800 transition-colors leading-tight">
                    {type.label}
                  </div>
                  <div className="text-sm text-slate-600 mt-2 leading-relaxed group-hover:text-slate-700 transition-colors">
                    {getActivityDescription(type.value)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Modal>

        {/* Loading Modal Overlay */}
        {isSaving && (
          <>
            {/* Disable interactions on the entire page */}
            <div className="fixed inset-0 bg-black bg-opacity-25 pointer-events-none z-40"></div>

            {/* Loading Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-auto">
              <div className="bg-white rounded-lg p-8 shadow-2xl max-w-sm w-full mx-4">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {isPublishing ? 'Publishing Lesson...' : 'Saving Draft...'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Please wait while we save your lesson.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function getActivityDescription(activityType: string): string {
  const descriptions: Record<string, string> = {
    'warm_up_speaking': 'Quick speaking exercise to get students talking',
    'vocabulary_intro': 'Introduce new vocabulary words with explanations',
    'vocabulary_matching_drag': 'Drag and drop vocabulary matching activity',
    'vocabulary_fill_blanks': 'Fill in the blanks with correct vocabulary',
    'grammar_explanation': 'Explain grammar rules with examples',
    'grammar_sentences': 'Type a sentence and students will rearrange shuffled words',
    'speaking_practice': 'Practice speaking with prompts and instructions',
    'listening_practice': 'Audio-based listening activities'
  }
  return descriptions[activityType] || 'Activity type description'
}
