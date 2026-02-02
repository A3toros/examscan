'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Card, Button, Input, Select, Textarea, Modal } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { Plus, Trash2, AlertTriangle, X } from 'lucide-react'
import { adminApiRequest } from '@/utils/adminApi'

interface Activity {
  id: string
  activity_type: string
  activity_order: number
  title?: string
  description?: string
  estimated_time_seconds?: number
  content: any
  vocabulary_items?: any[]
  grammar_sentences?: any[]
}

interface Lesson {
  id: string
  level: string
  topic: string
  lesson_number: number
  activities: Activity[]
}

const activityTypes = [
  { value: 'warm_up_speaking', label: 'Warm-up Speaking' },
  { value: 'vocabulary_intro', label: 'Vocabulary Introduction' },
  { value: 'vocabulary_matching_drag', label: 'Vocabulary Matching Drag' },
  { value: 'vocabulary_matching_drop', label: 'Vocabulary Matching Drop' },
  { value: 'vocabulary_fill_blanks', label: 'Vocabulary Fill Blanks' },
  { value: 'grammar_explanation', label: 'Grammar Explanation' },
  { value: 'grammar_sentences', label: 'Grammar Sentences' },
  { value: 'speaking_practice', label: 'Speaking Practice' },
  { value: 'writing_practice', label: 'Writing Practice' },
  { value: 'reading_comprehension', label: 'Reading Comprehension' },
  { value: 'listening_practice', label: 'Listening Practice' }
]

export default function LessonEditorContent() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const { showNotification } = useNotification()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newActivities, setNewActivities] = useState<Activity[]>([])
  const [showStudentDataWarning, setShowStudentDataWarning] = useState(false)
  const [studentDataInfo, setStudentDataInfo] = useState<{ activityResults: number; progress: number } | null>(null)
  const [pendingSave, setPendingSave] = useState<(() => void) | null>(null)

  const lessonId = params.id as string

  // Load lesson data
  useEffect(() => {
    loadLesson()
  }, [])

  const loadLesson = async () => {
    try {
      const response = await adminApiRequest(`/.netlify/functions/admin-lessons?id=${lessonId}`);

      if (!response.ok) {
        throw new Error('Failed to load lesson')
      }

      const result = await response.json()
      if (result.success) {
        // Normalize lesson data - ensure activities have proper structure
        const normalizedLesson = {
          ...result.lesson,
          activities: (result.lesson.activities || []).map((activity: Activity) => ({
            ...activity,
            vocabulary_items: activity.vocabulary_items || [],
            grammar_sentences: activity.grammar_sentences || [],
            content: activity.content || {}
          }))
        }
        setLesson(normalizedLesson)
      } else {
        throw new Error(result.error || 'Failed to load lesson')
      }
    } catch (error) {
      console.error('Failed to load lesson:', error)
      showNotification('Failed to load lesson: ' + (error as Error).message, 'error')
      setLesson(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Check for student data before saving
  const checkStudentData = async (): Promise<{ hasData: boolean; activityResults: number; progress: number }> => {
    try {
      const response = await adminApiRequest(`/.netlify/functions/admin-lessons?id=${lessonId}&checkStudentData=true`);

      if (response.ok) {
        const result = await response.json();
        if (result.studentData) {
          return {
            hasData: true,
            activityResults: result.studentData.activityResults || 0,
            progress: result.studentData.progress || 0
          };
        }
      }
      return { hasData: false, activityResults: 0, progress: 0 };
    } catch (error) {
      console.error('Error checking student data:', error);
      return { hasData: false, activityResults: 0, progress: 0 };
    }
  };

  const performSave = async () => {
    setIsSaving(true)
    try {
      // Prepare activities with vocabulary_items for update
      const activities = lesson?.activities.map(activity => ({
        id: activity.id,
        activity_type: activity.activity_type,
        activity_order: activity.activity_order,
        content: activity.content,
        vocabulary_items: activity.vocabulary_items || [],
        grammar_sentences: activity.grammar_sentences || []
      })) || []

      const updateData = {
        lesson: {
          id: lessonId,
          level: lesson?.level,
          lesson_number: lesson?.lesson_number,
          topic: lesson?.topic
        },
        activities: activities
      };

      const response = await adminApiRequest(`/.netlify/functions/admin-lessons`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      const result = await response.json()
      
      if (!response.ok) {
        const errorMessage = result.error || `Failed to save lesson: ${response.status} ${response.statusText}`
        console.error('Save lesson error:', errorMessage, result)
        throw new Error(errorMessage)
      }

      if (result.success) {
        // Reload lesson from server to get updated version with all activities and vocabulary items
        await loadLesson()
        setNewActivities([])
        setShowStudentDataWarning(false)
        showNotification('Lesson saved successfully', 'success')
      } else {
        const errorMessage = result.error || 'Failed to save lesson'
        console.error('Save lesson error:', errorMessage, result)
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Failed to save lesson:', error)
      showNotification('Failed to save lesson', 'error')
    } finally {
      setIsSaving(false)
    }
  };

  const handleSave = async () => {
    // Check for student data first
    const studentData = await checkStudentData();
    
    if (studentData.hasData) {
      // Show warning modal
      setStudentDataInfo({
        activityResults: studentData.activityResults,
        progress: studentData.progress
      });
      setPendingSave(() => performSave);
      setShowStudentDataWarning(true);
    } else {
      // No student data, proceed with save
      await performSave();
    }
  }

  const handleConfirmSave = () => {
    if (pendingSave) {
      pendingSave();
      setPendingSave(null);
    }
  }

  const handleCancelSave = () => {
    setShowStudentDataWarning(false);
    setPendingSave(null);
    setStudentDataInfo(null);
  }

  const handleAddActivity = () => {
    const newActivity: Activity = {
      id: `new_${Date.now()}`,
      activity_type: 'warm_up_speaking',
      activity_order: (lesson?.activities?.length || 0) + newActivities.length + 1,
      content: {}
    }
    setNewActivities(prev => [...prev, newActivity])
  }

  const handleUpdateActivity = (activityId: string, updates: Partial<Activity>) => {
    const updateActivities = (activities: Activity[]) =>
      activities.map(activity =>
        activity.id === activityId ? { ...activity, ...updates } : activity
      )

    if (lesson?.activities) {
      setLesson(prev => prev ? {
        ...prev,
        activities: updateActivities(prev.activities)
      } : null)
    } else {
      setNewActivities(prev => updateActivities(prev))
    }
  }

  const handleDeleteActivity = (activityId: string) => {
    if (lesson?.activities) {
      setLesson(prev => prev ? {
        ...prev,
        activities: prev.activities.filter(activity => activity.id !== activityId)
      } : null)
    } else {
      setNewActivities(prev => prev.filter(activity => activity.id !== activityId))
    }
  }

  const addVocabularyItem = (activityId: string) => {
    const newItem = {
      id: `vocab-${Date.now()}`,
      english_word: '',
      thai_translation: '',
      audio_url: ''
    }

    const updateActivities = (activities: Activity[]) =>
      activities.map(activity => {
        if (activity.id === activityId) {
          const currentItems = activity.vocabulary_items || []
          return {
            ...activity,
            vocabulary_items: [...currentItems, newItem]
          }
        }
        return activity
      })

    if (lesson?.activities) {
      setLesson(prev => prev ? {
        ...prev,
        activities: updateActivities(prev.activities)
      } : null)
    } else {
      setNewActivities(prev => updateActivities(prev))
    }
  }

  const updateVocabularyItem = (activityId: string, itemId: string, field: string, value: string) => {
    const updateActivities = (activities: Activity[]) =>
      activities.map(activity => {
        if (activity.id === activityId && activity.vocabulary_items) {
          return {
            ...activity,
            vocabulary_items: activity.vocabulary_items.map(item =>
              item.id === itemId ? { ...item, [field]: value } : item
            )
          }
        }
        return activity
      })

    if (lesson?.activities) {
      setLesson(prev => prev ? {
        ...prev,
        activities: updateActivities(prev.activities)
      } : null)
    } else {
      setNewActivities(prev => updateActivities(prev))
    }
  }

  const removeVocabularyItem = (activityId: string, itemId: string) => {
    const updateActivities = (activities: Activity[]) =>
      activities.map(activity => {
        if (activity.id === activityId && activity.vocabulary_items) {
          return {
            ...activity,
            vocabulary_items: activity.vocabulary_items.filter(item => item.id !== itemId)
          }
        }
        return activity
      })

    if (lesson?.activities) {
      setLesson(prev => prev ? {
        ...prev,
        activities: updateActivities(prev.activities)
      } : null)
    } else {
      setNewActivities(prev => updateActivities(prev))
    }
  }

  // Grammar Sentences Editor Component
  const GrammarSentencesEditor = ({ activity, onUpdate }: { activity: Activity; onUpdate: (sentences: any[]) => void }) => {
    const [sentences, setSentences] = useState<Array<{
      id: string;
      original_sentence: string;
      correct_sentence: string;
      words_array: string[];
    }>>(activity.grammar_sentences || [])

    // Load sentences from database on mount and when activity changes
    useEffect(() => {
      if (activity.grammar_sentences && Array.isArray(activity.grammar_sentences)) {
        setSentences(activity.grammar_sentences)
      } else {
        setSentences([])
      }
    }, [activity.id, activity.grammar_sentences])

    // Add new sentence
    const addSentence = () => {
      const newSentence = {
        id: `grammar-${Date.now()}`,
        original_sentence: '',
        correct_sentence: '',
        words_array: []
      }
      const updated = [...sentences, newSentence]
      setSentences(updated)
      onUpdate(updated)
    }

    // Update sentence
    const updateSentence = (sentenceId: string, field: string, value: any) => {
      const updated = sentences.map(sentence =>
        sentence.id === sentenceId
          ? { ...sentence, [field]: value }
          : sentence
      )
      setSentences(updated)
      onUpdate(updated)
    }

    // Update words array
    const updateWordsArray = (sentenceId: string, words: string[]) => {
      updateSentence(sentenceId, 'words_array', words)
    }

    // Parse sentence into words array
    const parseSentenceToWords = (sentenceId: string, sentence: string) => {
      const words = sentence.trim().split(/\s+/).filter(word => word.length > 0)
      updateWordsArray(sentenceId, words)
      // Also update correct_sentence
      updateSentence(sentenceId, 'correct_sentence', sentence.trim())
    }

    // Add word to words array
    const addWord = (sentenceId: string) => {
      const sentence = sentences.find(s => s.id === sentenceId)
      if (!sentence) return
      
      const updatedWords = [...(sentence.words_array || []), '']
      updateWordsArray(sentenceId, updatedWords)
    }

    // Remove word from words array
    const removeWord = (sentenceId: string, wordIndex: number) => {
      const sentence = sentences.find(s => s.id === sentenceId)
      if (!sentence) return
      
      const updatedWords = sentence.words_array.filter((_, idx) => idx !== wordIndex)
      updateWordsArray(sentenceId, updatedWords)
    }

    // Update word in words array
    const updateWord = (sentenceId: string, wordIndex: number, value: string) => {
      const sentence = sentences.find(s => s.id === sentenceId)
      if (!sentence) return
      
      const updatedWords = [...sentence.words_array]
      updatedWords[wordIndex] = value
      updateWordsArray(sentenceId, updatedWords)
    }

    // Remove sentence
    const removeSentence = (sentenceId: string) => {
      const updated = sentences.filter(s => s.id !== sentenceId)
      setSentences(updated)
      onUpdate(updated)
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-slate-700">
            Grammar Sentences ({sentences.length} sentence{sentences.length !== 1 ? 's' : ''})
          </label>
          <Button
            size="sm"
            onClick={addSentence}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Sentence
          </Button>
        </div>

        {sentences.length > 0 ? (
          <div className="space-y-4">
            {sentences.map((sentence, index) => (
              <Card key={sentence.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <Card.Body>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-700">Sentence {index + 1}</h4>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => removeSentence(sentence.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Original Sentence */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Original Sentence (for display)
                      </label>
                      <Input
                        value={sentence.original_sentence || ''}
                        onChange={(e) => updateSentence(sentence.id, 'original_sentence', e.target.value)}
                        placeholder="e.g., I am 25 years old"
                      />
                    </div>

                    {/* Correct Sentence */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Correct Sentence (for validation)
                      </label>
                      <Textarea
                        value={sentence.correct_sentence || ''}
                        onChange={(e) => {
                          updateSentence(sentence.id, 'correct_sentence', e.target.value)
                          // Auto-parse into words array
                          parseSentenceToWords(sentence.id, e.target.value)
                        }}
                        placeholder="e.g., I am 25 years old"
                        rows={2}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        This will automatically generate the words array below
                      </p>
                    </div>

                    {/* Words Array */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-slate-600">
                          Words Array (for drag & drop)
                        </label>
                        <Button
                          size="sm"
                          onClick={() => addWord(sentence.id)}
                          className="bg-purple-600 hover:bg-purple-700 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Word
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-lg min-h-[60px]">
                        {sentence.words_array && sentence.words_array.length > 0 ? (
                          sentence.words_array.map((word, wordIdx) => (
                            <div key={wordIdx} className="flex items-center space-x-1 bg-purple-100 border border-purple-300 rounded px-2 py-1">
                              <Input
                                value={word}
                                onChange={(e) => updateWord(sentence.id, wordIdx, e.target.value)}
                                placeholder={`Word ${wordIdx + 1}`}
                                className="w-20 text-sm border-0 bg-transparent p-0 h-auto"
                              />
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => removeWord(sentence.id, wordIdx)}
                                className="p-0 h-4 w-4"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-400 italic w-full text-center py-2">
                            No words yet. Type in "Correct Sentence" above or click "Add Word"
                          </div>
                        )}
                      </div>
                      {sentence.words_array && sentence.words_array.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          Words will be shuffled for students to drag into correct order
                        </p>
                      )}
                    </div>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-lg border border-slate-200">
            No sentences yet. Click "Add Sentence" to create a grammar sentence exercise.
          </div>
        )}
      </div>
    )
  }

  // Speaking Practice Editor Component
  const SpeakingPracticeEditor = ({ activity, onUpdate }: { activity: Activity; onUpdate: (content: any) => void }) => {
    // Handle both 'prompt' (string) and 'prompts' (array) formats
    const getInitialPrompts = () => {
      if (activity.content.prompts && Array.isArray(activity.content.prompts)) {
        // If prompts is array of strings, convert to { id, text }
        return activity.content.prompts.map((p: any, index: number) => {
          if (typeof p === 'string') {
            return { id: `prompt-${index}`, text: p }
          } else if (p.id && p.text) {
            return { id: p.id, text: p.text }
          } else {
            return { id: `prompt-${index}`, text: String(p) }
          }
        })
      } else if (activity.content.prompt) {
        // Single prompt string
        const promptText = typeof activity.content.prompt === 'string' 
          ? activity.content.prompt 
          : activity.content.prompt.text || String(activity.content.prompt)
        return [{ id: 'prompt-0', text: promptText }]
      }
      return []
    }

    const [prompts, setPrompts] = useState<Array<{ id: string; text: string }>>(getInitialPrompts())

    // Load prompts from database on mount
    useEffect(() => {
      const initialPrompts = getInitialPrompts()
      setPrompts(initialPrompts)
    }, [activity.id, activity.content.prompts, activity.content.prompt])

    // Add new prompt
    const addPrompt = () => {
      const newPrompt = {
        id: `prompt-${Date.now()}`,
        text: ''
      }
      const updated = [...prompts, newPrompt]
      setPrompts(updated)
      onUpdate({
        ...activity.content,
        prompts: updated.map(p => p.text) // Save as array of strings
      })
    }

    // Update prompt
    const updatePrompt = (promptId: string, text: string) => {
      const updated = prompts.map(p =>
        p.id === promptId ? { ...p, text } : p
      )
      setPrompts(updated)
      onUpdate({
        ...activity.content,
        prompts: updated.map(p => p.text) // Save as array of strings
      })
    }

    // Remove prompt
    const removePrompt = (promptId: string) => {
      const updated = prompts.filter(p => p.id !== promptId)
      setPrompts(updated)
      onUpdate({
        ...activity.content,
        prompts: updated.map(p => p.text) // Save as array of strings
      })
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-slate-700">
            Speaking Prompts ({prompts.length} prompt{prompts.length !== 1 ? 's' : ''})
          </label>
          <Button
            size="sm"
            onClick={addPrompt}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Prompt
          </Button>
        </div>

        {prompts.length > 0 ? (
          <div className="space-y-3">
            {prompts.map((prompt, index) => (
              <Card key={prompt.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <Card.Body>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 pt-2">
                      <span className="text-green-600 font-semibold text-sm">{index + 1}.</span>
                    </div>
                    <div className="flex-1">
                      <Textarea
                        value={prompt.text}
                        onChange={(e) => updatePrompt(prompt.id, e.target.value)}
                        placeholder="Enter speaking prompt..."
                        rows={2}
                        className="w-full"
                      />
                    </div>
                    <div className="flex-shrink-0 pt-2">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => removePrompt(prompt.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-lg border border-slate-200">
            No prompts yet. Click "Add Prompt" to create a speaking prompt.
          </div>
        )}

        {/* Feedback Criteria */}
        <div className="mt-6 pt-4 border-t border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Feedback Criteria
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={activity.content.feedback_criteria?.grammar !== false}
                onChange={(e) => onUpdate({
                  ...activity.content,
                  feedback_criteria: {
                    ...(activity.content.feedback_criteria || {}),
                    grammar: e.target.checked
                  }
                })}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-slate-700">Grammar</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={activity.content.feedback_criteria?.vocabulary !== false}
                onChange={(e) => onUpdate({
                  ...activity.content,
                  feedback_criteria: {
                    ...(activity.content.feedback_criteria || {}),
                    vocabulary: e.target.checked
                  }
                })}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-slate-700">Vocabulary</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={activity.content.feedback_criteria?.pronunciation !== false}
                onChange={(e) => onUpdate({
                  ...activity.content,
                  feedback_criteria: {
                    ...(activity.content.feedback_criteria || {}),
                    pronunciation: e.target.checked
                  }
                })}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-slate-700">Pronunciation</span>
            </label>
          </div>
        </div>
      </div>
    )
  }

  // Fill Blanks Editor Component
  const FillBlanksEditor = ({ activity, onUpdate }: { activity: Activity; onUpdate: (content: any) => void }) => {
    const [text, setText] = useState(activity.content.text || '')
    const [blanks, setBlanks] = useState<Array<{
      id: string;
      text: string;
      options: string[];
      correctAnswer: string | number;
    }>>(activity.content.blanks || [])
    
    // Save function - only called on blur (when user leaves field)
    const saveToParent = useCallback(() => {
      onUpdate({
        ...activity.content,
        text,
        blanks
      })
    }, [activity.content, text, blanks, onUpdate])

    // Parse text to find blank positions (___ or [blank])
    const parseBlanksFromText = (textValue: string) => {
      const blankPattern = /___+|\[blank\d*\]/gi
      const matches = [...textValue.matchAll(blankPattern)]
      return matches.map((match) => ({
        start: match.index!,
        end: match.index! + match[0].length,
        placeholder: match[0]
      }))
    }

    // Update text and sync blanks
    const handleTextChange = (newText: string) => {
      setText(newText)
      const blankPositions = parseBlanksFromText(newText)
      
      // Update blanks array to match text
      const updatedBlanks = blankPositions.map((pos, index) => {
        const existingBlank = blanks[index]
        return existingBlank || {
          id: `blank-${Date.now()}-${index}`,
          text: '',
          options: [],
          correctAnswer: ''
        }
      })
      
      // Remove blanks that no longer exist in text
      const finalBlanks = updatedBlanks.slice(0, blankPositions.length)
      
      setBlanks(finalBlanks)
      // Don't save here - will save on blur
    }

    // Add a new blank at cursor position
    const insertBlank = () => {
      const textarea = document.querySelector(`textarea[data-activity-id="${activity.id}"]`) as HTMLTextAreaElement
      if (!textarea) {
        // Fallback: append to end
        handleTextChange(text + ' ___')
        return
      }

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newText = text.substring(0, start) + ' ___' + text.substring(end)
      
      handleTextChange(newText)
      
      // Set cursor after the blank
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + 4, start + 4)
      }, 0)
    }

    // Update a blank's properties (local state only, no save)
    const updateBlank = (blankId: string, field: string, value: any) => {
      const updatedBlanks = blanks.map(blank => 
        blank.id === blankId 
          ? { ...blank, [field]: value }
          : blank
      )
      setBlanks(updatedBlanks)
      // Don't save here - will save on blur
    }

    // Add option to a blank
    const addOptionToBlank = (blankId: string) => {
      const blank = blanks.find(b => b.id === blankId)
      if (!blank) return
      
      const newOptions = [...(blank.options || []), '']
      updateBlank(blankId, 'options', newOptions)
      // Save immediately when adding an option
      setTimeout(() => saveToParent(), 0)
    }

    // Remove option from a blank
    const removeOptionFromBlank = (blankId: string, optionIndex: number) => {
      const blank = blanks.find(b => b.id === blankId)
      if (!blank) return
      
      const newOptions = blank.options.filter((_, idx) => idx !== optionIndex)
      updateBlank(blankId, 'options', newOptions)
      // Save immediately when removing an option
      setTimeout(() => saveToParent(), 0)
    }

    // Update option value (local state only, no save)
    const updateOption = (blankId: string, optionIndex: number, value: string) => {
      const blank = blanks.find(b => b.id === blankId)
      if (!blank) return
      
      const newOptions = [...blank.options]
      newOptions[optionIndex] = value
      updateBlank(blankId, 'options', newOptions)
    }

    // Set correct answer (local state only, no save)
    const setCorrectAnswer = (blankId: string, answer: string) => {
      updateBlank(blankId, 'correctAnswer', answer)
      updateBlank(blankId, 'text', answer) // Also update text field
    }

    // Remove a blank
    const removeBlank = (blankId: string) => {
      const blankIndex = blanks.findIndex(b => b.id === blankId)
      if (blankIndex === -1) return

      // Remove blank from text (replace ___ with empty string)
      const blankPattern = /___+|\[blank\d*\]/gi
      let matchCount = 0
      const newText = text.replace(blankPattern, (match: string) => {
        if (matchCount === blankIndex) {
          matchCount++
          return ''
        }
        matchCount++
        return match
      }).replace(/\s+/g, ' ').trim()

      const updatedBlanks = blanks.filter((_, idx) => idx !== blankIndex)
      setText(newText)
      setBlanks(updatedBlanks)
      // Save immediately when removing a blank
      onUpdate({
        ...activity.content,
        text: newText,
        blanks: updatedBlanks
      })
    }

    // Render text with interactive blanks preview
    const renderTextWithBlanks = () => {
      const parts: Array<{ type: 'text' | 'blank'; content: string; blankIndex?: number }> = []
      let lastIndex = 0
      const blankPattern = /___+|\[blank\d*\]/gi
      let match
      let blankIndex = 0

      while ((match = blankPattern.exec(text)) !== null) {
        // Add text before blank
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            content: text.substring(lastIndex, match.index)
          })
        }

        // Add blank
        parts.push({
          type: 'blank',
          content: match[0],
          blankIndex: blankIndex++
        })

        lastIndex = match.index + match[0].length
      }

      // Add remaining text
      if (lastIndex < text.length) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex)
        })
      }

      return (
        <div className="border border-slate-300 rounded-lg p-4 bg-white min-h-[150px]">
          <div className="flex flex-wrap items-center gap-1 text-base leading-relaxed">
            {parts.map((part, idx) => {
              if (part.type === 'text') {
                return <span key={idx}>{part.content}</span>
              } else {
                const blank = blanks[part.blankIndex!]
                return (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-1 mx-1 bg-purple-100 border-2 border-purple-300 rounded text-purple-700 font-medium min-w-[80px]"
                  >
                    {blank ? (
                      <span className="text-sm">{blank.text || '___'}</span>
                    ) : (
                      <span className="text-slate-400">___</span>
                    )}
                  </span>
                )
              }
            })}
          </div>
        </div>
      )
    }

    // Load blanks from database on mount
    useEffect(() => {
      if (activity.content.blanks && Array.isArray(activity.content.blanks) && activity.content.blanks.length > 0) {
        setBlanks(activity.content.blanks)
      }
      if (activity.content.text) {
        setText(activity.content.text)
      }
    }, [activity.id])

    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">
              Text with Blanks
            </label>
            <Button
              size="sm"
              onClick={insertBlank}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Insert Blank
            </Button>
          </div>
          <Textarea
            data-activity-id={activity.id}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={saveToParent}
            placeholder="Type your text and use '___' for blanks, or click 'Insert Blank' button"
            rows={6}
            className="font-mono"
          />
          <p className="text-xs text-slate-500 mt-1">
            Tip: Use "___" to create blanks, or click "Insert Blank" to add one at cursor position
          </p>
        </div>

        {/* Preview */}
        {text && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Preview
            </label>
            {renderTextWithBlanks()}
          </div>
        )}

        {/* Blanks Configuration */}
        {blanks.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Configure Blanks ({blanks.length} blank{blanks.length !== 1 ? 's' : ''})
            </label>
            <div className="space-y-4">
              {blanks.map((blank, index) => (
                <Card key={blank.id} className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
                  <Card.Body>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-slate-700">Blank {index + 1}</h4>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeBlank(blank.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Correct Answer */}
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Correct Answer
                        </label>
                        <Input
                          value={blank.text || ''}
                          onChange={(e) => {
                            setCorrectAnswer(blank.id, e.target.value)
                          }}
                          onBlur={saveToParent}
                          placeholder="Enter correct answer"
                        />
                      </div>

                      {/* Options */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-slate-600">
                            Options (including correct answer)
                          </label>
                          <Button
                            size="sm"
                            onClick={() => addOptionToBlank(blank.id)}
                            className="bg-green-600 hover:bg-green-700 text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Option
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {blank.options && blank.options.length > 0 ? (
                            blank.options.map((option, optIdx) => (
                              <div key={optIdx} className="flex items-center space-x-2">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(blank.id, optIdx, e.target.value)}
                                  onBlur={saveToParent}
                                  placeholder={`Option ${optIdx + 1}`}
                                  className="flex-1"
                                />
                                {option === blank.text && (
                                  <span className="text-xs text-green-600 font-medium">✓ Correct</span>
                                )}
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => removeOptionFromBlank(blank.id, optIdx)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-400 italic">
                              No options yet. Add options for this blank.
                            </div>
                          )}
                        </div>
                        {blank.options && blank.options.length > 0 && (
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Set Correct Answer
                            </label>
                            <Select
                              value={blank.text || ''}
                              onChange={(e) => {
                                setCorrectAnswer(blank.id, e.target.value)
                                // Save immediately when selecting from dropdown
                                setTimeout(() => saveToParent(), 0)
                              }}
                            >
                              <option value="">Select correct answer...</option>
                              {blank.options.filter(opt => opt.trim()).map((option, optIdx) => (
                                <option key={optIdx} value={option}>
                                  {option}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          </div>
        )}

        {blanks.length === 0 && text && (
          <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 rounded-lg border border-slate-200">
            No blanks found. Use "___" in your text or click "Insert Blank" to add blanks.
          </div>
        )}
      </div>
    )
  }

  const renderActivityEditor = (activity: Activity, isNew: boolean = false) => {
    return (
      <Card key={activity.id} className="bg-white border-purple-200 mb-4 shadow-md hover:shadow-lg transition-all duration-300">
        <Card.Header>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-purple-600 font-semibold">#{activity.activity_order}</span>
              <Select
                value={activity.activity_type}
                onChange={(e) => handleUpdateActivity(activity.id, { activity_type: e.target.value })}
              >
                {activityTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDeleteActivity(activity.id)}
            >
              Delete
            </Button>
          </div>
        </Card.Header>

        <Card.Body>
          <div className="space-y-4">
            {activity.activity_type === 'warm_up_speaking' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prompt
                </label>
                <Textarea
                  value={activity.content.prompt || ''}
                  onChange={(e) => handleUpdateActivity(activity.id, {
                    content: { ...activity.content, prompt: e.target.value }
                  })}
                  placeholder="Enter the speaking prompt..."
                  rows={3}
                />
              </div>
            )}

            {activity.activity_type === 'vocabulary_intro' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Title
                  </label>
                  <Input
                    value={activity.content.title || ''}
                    onChange={(e) => handleUpdateActivity(activity.id, {
                      content: { ...activity.content, title: e.target.value }
                    })}
                    placeholder="Vocabulary topic title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <Textarea
                    value={activity.content.description || ''}
                    onChange={(e) => handleUpdateActivity(activity.id, {
                      content: { ...activity.content, description: e.target.value }
                    })}
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
                          value={item.english_word || ''}
                          onChange={(e) => updateVocabularyItem(activity.id, item.id, 'english_word', e.target.value)}
                          placeholder="English word"
                          className="flex-1"
                        />
                        <Input
                          value={item.thai_translation || ''}
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
                    {(!activity.vocabulary_items || activity.vocabulary_items.length === 0) && (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        No vocabulary items yet. Click "Add Word" to add vocabulary pairs.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activity.activity_type === 'vocabulary_fill_blanks' && (
              <FillBlanksEditor
                activity={activity}
                onUpdate={(updatedContent) => handleUpdateActivity(activity.id, { content: updatedContent })}
              />
            )}

            {activity.activity_type === 'grammar_explanation' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Title
                  </label>
                  <Input
                    value={activity.content.title || ''}
                    onChange={(e) => handleUpdateActivity(activity.id, {
                      content: { ...activity.content, title: e.target.value }
                    })}
                    placeholder="Grammar rule title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Rules
                  </label>
                  <Textarea
                    value={activity.content.rules || activity.content.explanation || ''}
                    onChange={(e) => handleUpdateActivity(activity.id, {
                      content: { ...activity.content, rules: e.target.value }
                    })}
                    placeholder="Explain the grammar rules (one rule per line or paragraph)..."
                    rows={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Examples
                  </label>
                  <Textarea
                    value={activity.content.examples?.join('\n') || ''}
                    onChange={(e) => handleUpdateActivity(activity.id, {
                      content: { ...activity.content, examples: e.target.value.split('\n').filter(line => line.trim()) }
                    })}
                    placeholder="One example per line..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {activity.activity_type === 'grammar_sentences' && (
              <GrammarSentencesEditor
                activity={activity}
                onUpdate={(updatedSentences) => {
                  // Update activity with new grammar sentences
                  const updateActivities = (activities: Activity[]) =>
                    activities.map(a => 
                      a.id === activity.id 
                        ? { ...a, grammar_sentences: updatedSentences }
                        : a
                    )

                  if (lesson?.activities) {
                    setLesson(prev => prev ? {
                      ...prev,
                      activities: updateActivities(prev.activities)
                    } : null)
                  } else {
                    setNewActivities(prev => updateActivities(prev))
                  }
                }}
              />
            )}

            {activity.activity_type === 'speaking_practice' && (
              <SpeakingPracticeEditor
                activity={activity}
                onUpdate={(updatedContent) => handleUpdateActivity(activity.id, { content: updatedContent })}
              />
            )}

            {activity.activity_type === 'listening_practice' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Audio Description
                  </label>
                  <Textarea
                    value={activity.content.audio_description || ''}
                    onChange={(e) => handleUpdateActivity(activity.id, {
                      content: { ...activity.content, audio_description: e.target.value }
                    })}
                    placeholder="Describe the audio content..."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Transcript
                  </label>
                  <Textarea
                    value={activity.content.transcript || ''}
                    onChange={(e) => handleUpdateActivity(activity.id, {
                      content: { ...activity.content, transcript: e.target.value }
                    })}
                    placeholder="Enter the audio transcript..."
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Audio URL
                  </label>
                  <Input
                    value={activity.content.audio_url || ''}
                    onChange={(e) => handleUpdateActivity(activity.id, {
                      content: { ...activity.content, audio_url: e.target.value }
                    })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            )}

            {!['warm_up_speaking', 'vocabulary_intro', 'vocabulary_matching_drag', 'vocabulary_fill_blanks', 'grammar_explanation', 'grammar_sentences', 'speaking_practice', 'listening_practice'].includes(activity.activity_type) && (
              <div className="text-slate-400 text-center py-8">
                Content editor for {activity.activity_type} coming soon...
              </div>
            )}

            {activity.activity_type === 'vocabulary_matching_drag' && (
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
                          value={item.english_word || ''}
                          onChange={(e) => updateVocabularyItem(activity.id, item.id, 'english_word', e.target.value)}
                          placeholder="English word"
                          className="flex-1"
                        />
                        <Input
                          value={item.thai_translation || ''}
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
                    {(!activity.vocabulary_items || activity.vocabulary_items.length === 0) && (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        No vocabulary items yet. Click "Add Word" to add vocabulary pairs.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-slate-800 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading lesson editor...</p>
        </div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-slate-800 text-center">
          <p>Lesson not found</p>
          <Button onClick={() => router.push('/admin/content')} className="mt-4">
            Back to Content Management
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100 text-slate-800">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200 px-6 py-4 shadow-sm">
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
              <h1 className="text-xl font-bold text-slate-800">
                Edit Lesson: {lesson.topic}
              </h1>
              <p className="text-purple-600 text-sm">
                Level {lesson.level} • Lesson {lesson.lesson_number}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              onClick={handleAddActivity}
              variant="secondary"
              size="sm"
            >
              + Add Activity
            </Button>
            <Button
              onClick={handleSave}
              loading={isSaving}
              disabled={isSaving}
              className="bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Lesson Details */}
          <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <Card.Header>
              <h2 className="text-lg font-semibold text-slate-800">Lesson Details</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Level
                  </label>
                  <Select
                    value={lesson.level}
                    onChange={(e) => setLesson(prev => prev ? { ...prev, level: e.target.value } : null)}
                  >
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Lesson Number
                  </label>
                  <Input
                    type="number"
                    value={lesson.lesson_number}
                    onChange={(e) => setLesson(prev => prev ? { ...prev, lesson_number: parseInt(e.target.value) } : null)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Topic
                  </label>
                  <Input
                    value={lesson.topic}
                    onChange={(e) => setLesson(prev => prev ? { ...prev, topic: e.target.value } : null)}
                  />
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Activities */}
          <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <Card.Header>
              <h2 className="text-lg font-semibold text-slate-800">Activities</h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                {lesson?.activities?.map(activity => renderActivityEditor(activity)) || []}
                {newActivities.map(activity => renderActivityEditor(activity, true))}
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Student Data Warning Modal */}
      <Modal
        isOpen={showStudentDataWarning}
        onClose={handleCancelSave}
        title="Warning: Lesson Has Student Data"
        size="md"
      >
        <div className="p-6">
          <div className="flex items-start space-x-4 mb-6">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                This lesson has student progress data
              </h3>
              <div className="space-y-2 text-sm text-slate-600 mb-4">
                <p>
                  <strong>{studentDataInfo?.activityResults || 0}</strong> activity results
                </p>
                <p>
                  <strong>{studentDataInfo?.progress || 0}</strong> progress records
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-800">
                  <strong>What will happen:</strong>
                </p>
                <ul className="list-disc list-inside text-sm text-amber-700 mt-2 space-y-1">
                  <li>Student data will be preserved</li>
                  <li>Removed activities will be soft-deleted (hidden but preserved)</li>
                  <li>Student results will remain linked to their original activities</li>
                </ul>
              </div>
              <p className="text-sm text-slate-600">
                Are you sure you want to continue with these changes?
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              onClick={handleCancelSave}
              variant="secondary"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              loading={isSaving}
              disabled={isSaving}
              className="bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700"
            >
              {isSaving ? 'Saving...' : 'Continue & Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
