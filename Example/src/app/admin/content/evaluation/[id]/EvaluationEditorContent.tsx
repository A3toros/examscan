'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Card, Button, Input, Select, Textarea } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'

interface Question {
  id: string
  question_type: 'multiple_choice' | 'drag_match' | 'fill_blank' | 'dropdown' | 'drag_fill' | 'speaking'
  prompt: string
  content: any
  correct_answer: string | null
  points: number
}

interface EvaluationTest {
  id: string
  test_name: string
  test_type: string
  description: string
  passing_score: number
  allowed_time: number
  is_active: boolean
  questions: Question[]
  created_at: string
  updated_at: string
}

export default function EvaluationEditorContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const { showNotification } = useNotification()
  
  const testId = params.id as string

  const [test, setTest] = useState<EvaluationTest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Local storage key for drafts - memoized to prevent recreation
  const storageKey = React.useMemo(() => `evaluation-edit-${testId}`, [testId])

  // Load test data
  const loadTest = useCallback(async () => {
    if (!testId) {
      console.warn('No testId provided')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      // First try to load from localStorage
      const savedData = localStorage.getItem(storageKey)
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData)
          setTest(parsedData.test)
          setHasUnsavedChanges(true)
          showNotification('Loaded unsaved changes from previous session', 'info')
          setIsLoading(false)
          return
        } catch (error) {
          console.warn('Failed to parse saved evaluation data:', error)
          localStorage.removeItem(storageKey)
        }
      }

      // If no localStorage data, load from API
      const { adminApiRequest } = await import('@/utils/adminApi')
      
      const response = await adminApiRequest(`/.netlify/functions/get-evaluation-test?id=${testId}`, {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error('Failed to load evaluation test')
      }

      const result = await response.json()

      if (result.success) {
        setTest(result.test)
      } else {
        throw new Error(result.error || 'Failed to load evaluation test')
      }
    } catch (error) {
      console.error('Failed to load test:', error)
      showNotification('Failed to load test: ' + (error as Error).message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [testId, storageKey, showNotification])

  useEffect(() => {
    if (testId) {
      loadTest()
    }
  }, [testId, loadTest])

  // Auto-save to localStorage when test changes
  useEffect(() => {
    if (test && hasUnsavedChanges && !isLoading) {
      const dataToSave = {
        test,
        savedAt: new Date().toISOString(),
        testId
      }
      localStorage.setItem(storageKey, JSON.stringify(dataToSave))
    }
  }, [test, hasUnsavedChanges, isLoading, testId, storageKey])

  // Save test
  const handleSave = async () => {
    if (!test) return

    try {
      setIsSaving(true)
      const { adminApiRequest } = await import('@/utils/adminApi')
      
      const response = await adminApiRequest('/.netlify/functions/admin-evaluation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save evaluation test')
      }

      if (result.success) {
        showNotification('Evaluation test saved successfully!', 'success')
        setHasUnsavedChanges(false)
        // Clear localStorage on successful save
        localStorage.removeItem(storageKey)
        loadTest() // Reload to get updated data
      } else {
        throw new Error(result.error || 'Failed to save evaluation test')
      }
    } catch (error) {
      console.error('Failed to save test:', error)
      showNotification('Failed to save test: ' + (error as Error).message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Update test basic info
  const updateTestInfo = (field: string, value: any) => {
    if (!test) return
    setTest({ ...test, [field]: value })
    setHasUnsavedChanges(true)
  }

  // Update question
  const updateQuestion = (questionId: string, updates: Partial<Question>) => {
    if (!test) return
    const updatedQuestions = test.questions.map(q => {
      if (q.id === questionId) {
        const updated = { ...q, ...updates }
        // If changing to speaking type, clear correct_answer and points
        if (updates.question_type === 'speaking') {
          updated.correct_answer = null
          updated.points = 0
        }
        // If changing to drag_match type, initialize pairs if not present
        if (updates.question_type === 'drag_match' && !updated.content?.pairs) {
          updated.content = { ...updated.content, pairs: [{ word: '', match: '' }] }
        }
        // If changing from speaking to another type, set default points if not provided
        if (q.question_type === 'speaking' && updates.question_type && updates.question_type !== 'speaking' && !updates.points) {
          updated.points = updated.points || 1
        }
        return updated
      }
      return q
    })
    setTest({ ...test, questions: updatedQuestions })
    setHasUnsavedChanges(true)
  }

  // Add new question
  const addQuestion = () => {
    if (!test) return
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      question_type: 'multiple_choice',
      prompt: '',
      content: { options: ['', '', '', ''] },
      correct_answer: '',
      points: 1
    }
    setTest({ ...test, questions: [...test.questions, newQuestion] })
    setHasUnsavedChanges(true)
  }

  // Remove question
  const removeQuestion = (questionId: string) => {
    if (!test) return
    const updatedQuestions = test.questions.filter(q => q.id !== questionId)
    setTest({ ...test, questions: updatedQuestions })
    setHasUnsavedChanges(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-700">Loading evaluation editor...</p>
        </div>
      </div>
    )
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Test Not Found</h3>
          <p className="text-slate-600 mb-4">Could not load the evaluation test.</p>
          <Button onClick={() => router.push('/admin/content')}>
            Back to Content Management
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-purple-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/admin/content')}
            >
              ← Back to Content
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Edit Evaluation Test</h1>
              <p className="text-slate-600 text-sm">Configure the English level evaluation</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {hasUnsavedChanges && (
              <span className="text-yellow-600 text-sm flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                Unsaved changes (auto-saved locally)
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Test Settings */}
        <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg">
          <Card.Header>
            <h3 className="text-lg font-semibold text-slate-800">Test Settings</h3>
          </Card.Header>
          <Card.Body className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Test Name
                </label>
                <Input
                  value={test.test_name}
                  onChange={(e) => updateTestInfo('test_name', e.target.value)}
                  className="bg-white border-purple-200 text-slate-800 focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Test Type
                </label>
                <Input
                  value={test.test_type}
                  onChange={(e) => updateTestInfo('test_type', e.target.value)}
                  className="bg-white border-purple-200 text-slate-800 focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Passing Score (%)
                </label>
                <Input
                  type="number"
                  value={test.passing_score}
                  onChange={(e) => updateTestInfo('passing_score', parseInt(e.target.value))}
                  className="bg-white border-purple-200 text-slate-800 focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Time Limit (minutes)
                </label>
                <Input
                  type="number"
                  value={test.allowed_time}
                  onChange={(e) => updateTestInfo('allowed_time', parseInt(e.target.value))}
                  className="bg-white border-purple-200 text-slate-800 focus:border-purple-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <Textarea
                value={test.description}
                onChange={(e) => updateTestInfo('description', e.target.value)}
                rows={3}
                className="bg-white border-purple-200 text-slate-800 focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={test.is_active}
                onChange={(e) => updateTestInfo('is_active', e.target.checked)}
                className="rounded border-purple-200 bg-white text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="is_active" className="text-sm text-slate-700">
                Test is active and available to users
              </label>
            </div>
          </Card.Body>
        </Card>

        {/* Questions */}
        <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg">
          <Card.Header>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Questions ({test.questions.length})</h3>
              <Button onClick={addQuestion} size="sm" className="bg-green-600 hover:bg-green-700">
                + Add Question
              </Button>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              {test.questions.map((question, index) => (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-purple-200 rounded-lg p-4 bg-white"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium text-slate-700">
                        #{index + 1}
                      </span>
                      <Select
                        value={question.question_type}
                        onChange={(e) => updateQuestion(question.id, { question_type: e.target.value as any })}
                        className="bg-white border-purple-200 text-slate-800 text-sm focus:border-purple-400"
                      >
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="drag_match">Drag & Match</option>
                        <option value="fill_blank">Fill in Blank</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="drag_fill">Drag & Fill</option>
                        <option value="speaking">Speaking</option>
                      </Select>
                      {question.question_type !== 'speaking' && (
                        <span className="text-sm text-slate-700">
                          {question.points || 1} point{(question.points || 1) !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={() => removeQuestion(question.id)}
                      variant="secondary"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Question Prompt
                      </label>
                      <Textarea
                        value={question.prompt}
                        onChange={(e) => updateQuestion(question.id, { prompt: e.target.value })}
                        rows={2}
                        className="bg-white border-purple-200 text-slate-800 focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                        placeholder="Enter the question prompt..."
                      />
                    </div>

                    {question.question_type === 'multiple_choice' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Options
                        </label>
                        <div className="space-y-2">
                          {(question.content?.options || []).map((option: string, optIndex: number) => (
                            <Input
                              key={optIndex}
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...(question.content?.options || [])]
                                newOptions[optIndex] = e.target.value
                                updateQuestion(question.id, { content: { ...question.content, options: newOptions } })
                              }}
                              placeholder={`Option ${optIndex + 1}`}
                              className="bg-white border-purple-200 text-slate-800 focus:border-purple-400"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {question.question_type === 'drag_match' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Word-Meaning Pairs
                        </label>
                        <div className="space-y-3">
                          {(question.content?.pairs || []).map((pair: any, pairIndex: number) => (
                            <div key={pairIndex} className="flex items-center space-x-2 p-3 bg-purple-50 rounded border border-purple-200">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Word</label>
                                <Input
                                  value={pair.word || ''}
                                  onChange={(e) => {
                                    const newPairs = [...(question.content?.pairs || [])]
                                    newPairs[pairIndex] = { ...newPairs[pairIndex], word: e.target.value }
                                    updateQuestion(question.id, { content: { ...question.content, pairs: newPairs } })
                                  }}
                                  placeholder="Word"
                                  className="bg-white border-purple-200 text-slate-800 focus:border-purple-400"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Meaning</label>
                                <Input
                                  value={pair.match || ''}
                                  onChange={(e) => {
                                    const newPairs = [...(question.content?.pairs || [])]
                                    newPairs[pairIndex] = { ...newPairs[pairIndex], match: e.target.value }
                                    updateQuestion(question.id, { content: { ...question.content, pairs: newPairs } })
                                  }}
                                  placeholder="Meaning"
                                  className="bg-white border-purple-200 text-slate-800 focus:border-purple-400"
                                />
                              </div>
                              <Button
                                onClick={() => {
                                  const newPairs = (question.content?.pairs || []).filter((_: any, i: number) => i !== pairIndex)
                                  updateQuestion(question.id, { content: { ...question.content, pairs: newPairs } })
                                }}
                                variant="secondary"
                                size="sm"
                                className="text-red-600 hover:text-red-700 mt-6"
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          <Button
                            onClick={() => {
                              const newPairs = [...(question.content?.pairs || []), { word: '', match: '' }]
                              updateQuestion(question.id, { content: { ...question.content, pairs: newPairs } })
                            }}
                            variant="secondary"
                            size="sm"
                            className="w-full border-dashed border-purple-300 text-purple-600 hover:bg-purple-50"
                          >
                            + Add Pair
                          </Button>
                        </div>
                      </div>
                    )}

                    {(question.question_type === 'dropdown' || question.question_type === 'fill_blank') && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Options
                        </label>
                        <div className="space-y-2">
                          {(question.content?.options || []).map((option: string, optIndex: number) => (
                            <Input
                              key={optIndex}
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...(question.content?.options || [])]
                                newOptions[optIndex] = e.target.value
                                updateQuestion(question.id, { content: { ...question.content, options: newOptions } })
                              }}
                              placeholder={`Option ${optIndex + 1}`}
                              className="bg-white border-purple-200 text-slate-800 focus:border-purple-400"
                            />
                          ))}
                          <Button
                            onClick={() => {
                              const newOptions = [...(question.content?.options || []), '']
                              updateQuestion(question.id, { content: { ...question.content, options: newOptions } })
                            }}
                            variant="secondary"
                            size="sm"
                            className="w-full border-dashed border-purple-300 text-purple-600 hover:bg-purple-50"
                          >
                            + Add Option
                          </Button>
                        </div>
                      </div>
                    )}

                    {question.question_type === 'drag_fill' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Words
                        </label>
                        <div className="space-y-2">
                          {(question.content?.words || []).map((word: string, wordIndex: number) => (
                            <Input
                              key={wordIndex}
                              value={word}
                              onChange={(e) => {
                                const newWords = [...(question.content?.words || [])]
                                newWords[wordIndex] = e.target.value
                                updateQuestion(question.id, { content: { ...question.content, words: newWords } })
                              }}
                              placeholder={`Word ${wordIndex + 1}`}
                              className="bg-white border-purple-200 text-slate-800 focus:border-purple-400"
                            />
                          ))}
                          <Button
                            onClick={() => {
                              const newWords = [...(question.content?.words || []), '']
                              updateQuestion(question.id, { content: { ...question.content, words: newWords } })
                            }}
                            variant="secondary"
                            size="sm"
                            className="w-full border-dashed border-purple-300 text-purple-600 hover:bg-purple-50"
                          >
                            + Add Word
                          </Button>
                        </div>
                      </div>
                    )}

                    {question.question_type === 'speaking' && (
                      <div className="text-sm text-slate-600 p-4 bg-purple-50 rounded border border-purple-200">
                        Speaking questions are AI-evaluated and don't require correct answers or points. The AI will assess pronunciation, grammar, vocabulary, and fluency.
                      </div>
                    )}

                    {question.question_type !== 'speaking' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Correct Answer
                          </label>
                          <Input
                            value={question.correct_answer || ''}
                            onChange={(e) => updateQuestion(question.id, { correct_answer: e.target.value })}
                            className="bg-white border-purple-200 text-slate-800 focus:border-purple-400"
                            placeholder="Enter the correct answer..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Points
                          </label>
                          <Input
                            type="number"
                            value={question.points || 1}
                            onChange={(e) => updateQuestion(question.id, { points: parseInt(e.target.value) || 1 })}
                            className="bg-white border-purple-200 text-slate-800 focus:border-purple-400 w-24"
                            min="1"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}

              {test.questions.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                  <div className="text-4xl mb-4">📝</div>
                  <p>No questions added yet. Click "Add Question" to get started.</p>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  )
}
