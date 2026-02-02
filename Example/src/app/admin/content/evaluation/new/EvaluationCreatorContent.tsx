'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Card, Button, Input, Select, Textarea } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { adminApiRequest } from '@/utils/adminApi'
import { Plus, Trash2, Save, X, Eye, EyeOff, FileText, CheckCircle } from 'lucide-react'

interface Question {
  id: string
  question_type: 'multiple_choice' | 'drag_match' | 'fill_blank' | 'dropdown' | 'drag_fill' | 'speaking'
  prompt: string
  content: any
  correct_answer: string
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

export default function EvaluationCreatorContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const { showNotification } = useNotification()

  const [test, setTest] = useState<EvaluationTest>({
    id: '',
    test_name: '',
    test_type: 'comprehensive',
    description: '',
    passing_score: 70,
    allowed_time: 60,
    is_active: false,
    questions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })

  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Local storage key for drafts
  const getStorageKey = () => 'evaluation-create-draft'

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(getStorageKey())
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft)
        setTest(draftData.test)
        showNotification('Draft loaded from local storage', 'info')
      } catch (error) {
        console.error('Failed to load draft:', error)
      }
    }
  }, [])

  // Save draft to localStorage whenever test changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      const draftData = {
        test,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem(getStorageKey(), JSON.stringify(draftData))
    }
  }, [test, hasUnsavedChanges])

  const handleSave = async (asDraft = false) => {
    try {
      setIsSaving(true)

      const testData = {
        ...test,
        is_active: !asDraft, // Drafts are not active
        updated_at: new Date().toISOString()
      }

      // Generate a unique ID if not set
      if (!testData.id) {
        testData.id = `EVAL-${Date.now()}`
      }

      const response = await adminApiRequest('/.netlify/functions/admin-evaluation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: testData })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        showNotification(
          asDraft
            ? 'Evaluation test saved as draft'
            : 'Evaluation test created successfully',
          'success'
        )

        // Clear draft from localStorage
        localStorage.removeItem(getStorageKey())
        setHasUnsavedChanges(false)

        // Redirect to the edit page
        router.push(`/admin/content/evaluation/${testData.id}`)
      } else {
        throw new Error(result.error || 'Failed to save evaluation test')
      }
    } catch (error) {
      console.error('Save error:', error)
      showNotification('Failed to save evaluation test: ' + (error as Error).message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const addQuestion = () => {
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      question_type: 'multiple_choice',
      prompt: '',
      content: {},
      correct_answer: '',
      points: 10
    }

    setTest(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }))
    setHasUnsavedChanges(true)
  }

  const removeQuestion = (questionId: string) => {
    setTest(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }))
    setHasUnsavedChanges(true)
  }

  const updateQuestion = (questionId: string, updates: Partial<Question>) => {
    setTest(prev => ({
      ...prev,
      questions: prev.questions.map(q =>
        q.id === questionId ? { ...q, ...updates } : q
      )
    }))
    setHasUnsavedChanges(true)
  }

  const updateTest = (updates: Partial<EvaluationTest>) => {
    setTest(prev => ({ ...prev, ...updates }))
    setHasUnsavedChanges(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100 text-slate-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => router.back()}
              variant="secondary"
              size="sm"
            >
              ← Back
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Create Evaluation Test</h1>
              <p className="text-purple-600">Build a new evaluation test for students</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
              <span className="text-sm font-medium text-slate-700">Version:</span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setTest(prev => ({ ...prev, is_active: false }))}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    !test.is_active
                      ? 'bg-sky-500 text-white'
                      : 'bg-white text-slate-600 hover:bg-purple-100'
                  }`}
                >
                  <EyeOff className="w-3 h-3 inline mr-1" />
                  Draft
                </button>
                <button
                  onClick={() => setTest(prev => ({ ...prev, is_active: true }))}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    test.is_active
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-purple-100'
                  }`}
                >
                  <Eye className="w-3 h-3 inline mr-1" />
                  Final
                </button>
              </div>
            </div>

            <Button
              onClick={() => handleSave(true)}
              variant="secondary"
              disabled={isSaving}
            >
              <EyeOff className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={isSaving || !test.test_name.trim() || test.questions.length === 0}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Publishing...' : 'Publish Test'}
            </Button>
          </div>
        </div>

        {/* Progress & Validation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg">
            <Card.Body>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-purple-500" />
                    <span className="font-medium text-slate-800">Test Setup</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${test.test_name.trim() ? 'bg-green-500' : 'bg-red-400'}`}></div>
                      <span className={test.test_name.trim() ? 'text-green-700' : 'text-red-600'}>
                        Title
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${test.questions.length > 0 ? 'bg-green-500' : 'bg-red-400'}`}></div>
                      <span className={test.questions.length > 0 ? 'text-green-700' : 'text-red-600'}>
                        Questions ({test.questions.length})
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${test.passing_score > 0 ? 'bg-green-500' : 'bg-yellow-400'}`}></div>
                      <span className={test.passing_score > 0 ? 'text-green-700' : 'text-yellow-600'}>
                        Settings
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  test.test_name.trim() && test.questions.length > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {test.test_name.trim() && test.questions.length > 0 ? 'Ready to Publish' : 'Incomplete'}
                </div>
              </div>
            </Card.Body>
          </Card>
        </motion.div>

        {/* Test Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <Card.Header>
              <h2 className="text-xl font-semibold text-slate-800 flex items-center">
                <span className="w-2 h-2 bg-sky-500 rounded-full mr-3"></span>
                Test Settings
              </h2>
            </Card.Header>
            <Card.Body className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Test Name</label>
                  <Input
                    value={test.test_name}
                    onChange={(e) => updateTest({ test_name: e.target.value })}
                    placeholder="Enter test name"
                    className="bg-white border-purple-200 focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Test Type</label>
                  <Select
                    value={test.test_type}
                    onChange={(e) => updateTest({ test_type: e.target.value })}
                    className="bg-white border-purple-200 focus:border-purple-400 text-white"
                  >
                    <option value="comprehensive">Comprehensive</option>
                    <option value="vocabulary">Vocabulary Focus</option>
                    <option value="grammar">Grammar Focus</option>
                    <option value="speaking">Speaking Focus</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Passing Score (%)</label>
                  <Input
                    type="number"
                    value={test.passing_score}
                    onChange={(e) => updateTest({ passing_score: parseInt(e.target.value) || 0 })}
                    min="0"
                    max="100"
                    className="bg-white border-purple-200 focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Time Limit (minutes)</label>
                  <Input
                    type="number"
                    value={test.allowed_time}
                    onChange={(e) => updateTest({ allowed_time: parseInt(e.target.value) || 0 })}
                    min="1"
                    className="bg-white border-purple-200 focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={test.description}
                  onChange={(e) => updateTest({ description: e.target.value })}
                  placeholder="Describe the evaluation test..."
                  rows={3}
                  className="bg-white border-purple-200 focus:border-purple-400"
                />
              </div>
            </Card.Body>
          </Card>
        </motion.div>

        {/* Questions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <Card.Header>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  Questions ({test.questions.length})
                </h2>
                <Button
                  onClick={addQuestion}
                  size="sm"
                  className="bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700 shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {test.questions.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-purple-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">No Questions Yet</h3>
                  <p className="text-slate-600 mb-6 max-w-md mx-auto">
                    Start building your evaluation test by adding questions. Each question can be multiple choice, drag-and-drop, or speaking exercises.
                  </p>
                  <Button onClick={addQuestion} className="bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                    <Plus className="w-5 h-5 mr-2" />
                    Add Your First Question
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {test.questions.map((question, index) => (
                    <Card key={question.id} className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-sm hover:shadow-md transition-all duration-300">
                      <Card.Body>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <span className="bg-gradient-to-r from-sky-500 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                                Q{index + 1}
                              </span>
                              <FileText className="w-4 h-4 text-purple-500" />
                            </div>
                            <Select
                              value={question.question_type}
                              onChange={(e) => updateQuestion(question.id, {
                                question_type: e.target.value as Question['question_type']
                              })}
                              className="w-48 bg-white border-purple-200 text-slate-800 focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                            >
                              <option value="multiple_choice">📋 Multiple Choice</option>
                              <option value="drag_match">🎯 Drag Match</option>
                              <option value="fill_blank">📝 Fill Blank</option>
                              <option value="dropdown">📊 Dropdown</option>
                              <option value="drag_fill">🔀 Drag Fill</option>
                              <option value="speaking">🎤 Speaking</option>
                            </Select>
                          </div>

                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1 bg-purple-100 px-2 py-1 rounded-md">
                              <span className="text-xs text-purple-700 font-medium">Points:</span>
                              <Input
                                type="number"
                                value={question.points}
                                onChange={(e) => updateQuestion(question.id, {
                                  points: parseInt(e.target.value) || 0
                                })}
                                className="w-16 h-6 text-xs bg-white border-purple-200 focus:border-purple-400"
                                placeholder="10"
                              />
                            </div>
                            <Button
                              onClick={() => removeQuestion(question.id)}
                              variant="danger"
                              size="sm"
                              className="hover:scale-105 transition-transform"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                                <span className="w-2 h-2 bg-sky-500 rounded-full mr-2"></span>
                                Question Prompt
                              </label>
                              <Textarea
                                value={question.prompt}
                                onChange={(e) => updateQuestion(question.id, {
                                  prompt: e.target.value
                                })}
                                placeholder="Enter the question prompt... (e.g., 'What is the capital of France?')"
                                rows={3}
                                className="bg-white border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                                <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                                Correct Answer
                              </label>
                              <Input
                                value={question.correct_answer}
                                onChange={(e) => updateQuestion(question.id, {
                                  correct_answer: e.target.value
                                })}
                                placeholder="Enter the correct answer... (e.g., 'Paris')"
                                className="bg-white border-purple-200 focus:border-purple-400 focus:ring-2 focus:ring-green-100"
                              />
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-100">
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center">
                              <Eye className="w-4 h-4 mr-1 text-purple-500" />
                              Preview
                            </h4>
                            <div className="space-y-2">
                              <div className="bg-white p-3 rounded border border-purple-200">
                                <p className="text-sm font-medium text-slate-800">
                                  {question.prompt || <span className="text-slate-400 italic">Question prompt will appear here...</span>}
                                </p>
                              </div>
                              <div className="bg-green-50 p-2 rounded border border-green-200">
                                <p className="text-xs text-green-700">
                                  <strong>Answer:</strong> {question.correct_answer || <span className="text-slate-400 italic">Correct answer will appear here...</span>}
                                </p>
                              </div>
                              <div className="text-xs text-slate-500">
                                Type: {question.question_type.replace('_', ' ').toUpperCase()} • Points: {question.points}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
