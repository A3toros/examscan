'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Card, Button, Input, Select } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { useAuth } from '@/contexts/AuthContext'
import { adminApiRequest } from '@/utils/adminApi'

type ContentType = 'lessons' | 'evaluation'

interface Lesson {
  id: string
  level: string
  topic: string
  lesson_number: number
  is_draft?: boolean
  created_at: string
}


interface EvaluationTest {
  id: string
  test_name: string
  test_type: string
  passing_score: number
  allowed_time: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function ContentManagementContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const { showNotification } = useNotification()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<ContentType>('lessons')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [evaluationTests, setEvaluationTests] = useState<EvaluationTest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [showDrafts, setShowDrafts] = useState<boolean>(false)

  // Load content on component mount and tab change
  useEffect(() => {
    loadContent()
  }, [activeTab])

  const loadContent = async () => {
    setIsLoading(true)
    try {
      // Admin token is in HTTP cookie, sent automatically with credentials: 'include'
      if (activeTab === 'lessons') {
        const response = await adminApiRequest('/.netlify/functions/admin-lessons', {
          credentials: 'include'
        })

        if (!response.ok) {
          throw new Error('Failed to load lessons')
        }

        const result = await response.json()

        if (result.success) {
          setLessons(result.lessons)
        } else {
          throw new Error(result.error || 'Failed to load lessons')
        }
      } else if (activeTab === 'evaluation') {
        // For now, we'll load the evaluation test directly from the database
        const response = await adminApiRequest('/.netlify/functions/get-evaluation-test', {
          method: 'GET'
        })

        if (!response.ok) {
          throw new Error('Failed to load evaluation test')
        }

        const result = await response.json()

        if (result.success) {
          // Transform the single test into an array for consistency
          setEvaluationTests([{
            id: result.test.id,
            test_name: result.test.test_name,
            test_type: result.test.test_type,
            passing_score: result.test.passing_score,
            allowed_time: result.test.allowed_time,
            is_active: result.test.is_active,
            created_at: result.test.created_at,
            updated_at: result.test.updated_at
          }])
        } else {
          throw new Error(result.error || 'Failed to load evaluation test')
        }
      }
    } catch (error) {
      console.error('Failed to load content:', error)
      showNotification('Failed to load content: ' + (error as Error).message, 'error')

      // Set empty arrays on error
      if (activeTab === 'lessons') {
        setLessons([])
      } else if (activeTab === 'evaluation') {
        setEvaluationTests([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateLesson = () => {
    router.push('/admin/content/lessons/new')
  }


  const handleEditLesson = (lessonId: string) => {
    router.push(`/admin/content/lessons/${lessonId}`)
  }


  const handleEditEvaluationTest = (testId: string) => {
    router.push(`/admin/content/evaluation/${testId}`)
  }

  // Normalize selectedLevel for consistent comparison
  const normalizedSelectedLevel = selectedLevel === 'all' ? 'all' : selectedLevel.toUpperCase();

  const filteredLessons = lessons.filter(lesson => {
    const normalizedLessonLevel = lesson.level?.trim().toUpperCase();
    return (normalizedSelectedLevel === 'all' || normalizedLessonLevel === normalizedSelectedLevel) &&
           (!showDrafts || lesson.is_draft) &&
           (lesson.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
            normalizedLessonLevel?.toLowerCase().includes(searchTerm.toLowerCase()))
  })

  // Group filtered lessons by normalized level (for display)
  const lessonsByLevel = filteredLessons.reduce((acc, lesson) => {
    const normalizedLevel = lesson.level?.trim().toUpperCase();
    if (!normalizedLevel) return acc;
    if (!acc[normalizedLevel]) {
      acc[normalizedLevel] = []
    }
    acc[normalizedLevel].push(lesson)
    return acc
  }, {} as Record<string, Lesson[]>)

  // Group all lessons by normalized level (for accurate counts)
  const totalLessonsByLevel = lessons.reduce((acc, lesson) => {
    const level = lesson.level?.trim(); // Trim whitespace
    if (!level) {
      console.warn('Lesson without level:', lesson);
      return acc;
    }
    // Normalize level to uppercase
    const normalizedLevel = level.toUpperCase();
    if (!acc[normalizedLevel]) {
      acc[normalizedLevel] = []
    }
    acc[normalizedLevel].push(lesson)
    return acc
  }, {} as Record<string, Lesson[]>)


  // Sort lessons within each level by lesson_number
  Object.keys(lessonsByLevel).forEach(level => {
    lessonsByLevel[level].sort((a, b) => a.lesson_number - b.lesson_number)
  })

  // CEFR level order
  const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const sortedLevels = Object.keys(totalLessonsByLevel).sort((a, b) => {
    const indexA = levelOrder.indexOf(a)
    const indexB = levelOrder.indexOf(b)
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
  })

  // Create a mapping from display level to normalized level for lookup
  const levelDisplayMap: Record<string, string> = {}
  Object.keys(totalLessonsByLevel).forEach(normalizedLevel => {
    levelDisplayMap[normalizedLevel] = normalizedLevel
  })


  const tabs = [
    { id: 'lessons', label: 'Lessons', count: lessons.length },
    { id: 'evaluation', label: 'Evaluation', count: evaluationTests.length }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading content management...</p>
        </div>
      </div>
    )
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
              onClick={() => router.push('/admin/dashboard')}
            >
              ← Back to Dashboard
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Content Management</h1>
              <p className="text-purple-600 text-sm">Manage lessons and evaluation tests</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 bg-purple-50 p-1 rounded-lg border border-purple-200">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ContentType)}
                className={`flex-1 min-w-0 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-sky-500 to-purple-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-white hover:shadow-sm'
                }`}
              >
                {tab.label}{tab.id !== 'evaluation' ? ` (${tab.count})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex items-center space-x-4">
          <Input
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white border-purple-200 text-slate-800 placeholder-purple-400 focus:border-purple-400 w-64"
          />

          {activeTab === 'lessons' && (
            <>
              <Select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              >
                <option value="all">All Levels</option>
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
              </Select>

              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={showDrafts}
                  onChange={(e) => setShowDrafts(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-slate-600">Show Drafts Only</span>
              </label>
            </>
          )}

          <div className="flex-1"></div>

          {activeTab === 'lessons' && (
            <Button onClick={handleCreateLesson} className="bg-purple-600 hover:bg-purple-700">
              + New Lesson
            </Button>
          )}

        </div>

        {/* Content */}
        {activeTab === 'lessons' && (
          <div className="space-y-8">
            {Object.keys(totalLessonsByLevel).length > 0 ? (
              sortedLevels.map(level => (
                <div key={level}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-2xl font-bold ${
                      level === 'A1' ? 'text-green-700' :
                      level === 'A2' ? 'text-blue-700' :
                      level === 'B1' ? 'text-yellow-700' :
                      level === 'B2' ? 'text-orange-700' :
                      level === 'C1' ? 'text-red-700' :
                      'text-purple-700'
                    }`}>
                      Level {level}
                    </h2>
                    <span className="text-slate-600 text-sm">
                      {totalLessonsByLevel[level]?.length || 0} lesson{(totalLessonsByLevel[level]?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {(lessonsByLevel[level] || []).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {lessonsByLevel[level].map(lesson => (
                      <motion.div
                        key={lesson.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className={`bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-slate-600 transition-colors cursor-pointer ${lesson.is_draft ? 'border-l-4 border-l-blue-500' : ''}`} onClick={() => handleEditLesson(lesson.id)}>
                          <Card.Body>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  lesson.level === 'A1' ? 'bg-green-100 text-green-800' :
                                  lesson.level === 'A2' ? 'bg-blue-100 text-blue-800' :
                                  lesson.level === 'B1' ? 'bg-yellow-100 text-yellow-800' :
                                  lesson.level === 'B2' ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {lesson.level}
                                </span>
                                {lesson.is_draft && (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Draft
                                  </span>
                                )}
                              </div>
                              <span className="text-purple-600 text-sm">
                                #{lesson.lesson_number}
                              </span>
                            </div>

                            <h3 className="font-semibold text-slate-800 mb-2 line-clamp-2">
                              {lesson.topic}
                            </h3>

                            <div className="flex items-center justify-between text-sm text-purple-600">
                              <span>
                                {lesson.is_draft ? 'Modified' : 'Created'} {new Date(lesson.created_at).toLocaleDateString()}
                              </span>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditLesson(lesson.id)
                                }}
                              >
                                Edit
                              </Button>
                            </div>
                          </Card.Body>
                        </Card>
                      </motion.div>
                    ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg">
                <Card.Body className="text-center py-12">
                  <div className="text-6xl mb-4">📚</div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">
                    No Lessons Found
                  </h3>
                  <p className="text-purple-600 mb-4">
                    {searchTerm ? 'Try adjusting your search or filters.' : 'Create your first lesson to get started.'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={handleCreateLesson} className="bg-purple-600 hover:bg-purple-700">
                      Create Lesson
                    </Button>
                  )}
                </Card.Body>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'evaluation' && (
          <div className="mb-6">
            <Button
              onClick={() => router.push('/admin/content/evaluation/new')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              ➕ New Evaluation Test
            </Button>
          </div>
        )}

        {activeTab === 'evaluation' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evaluationTests.map(test => (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-slate-600 transition-colors cursor-pointer" onClick={() => handleEditEvaluationTest(test.id)}>
                  <Card.Body>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          test.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {test.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-semibold text-white mb-2 line-clamp-2">
                      {test.test_name}
                    </h3>

                    <div className="text-sm text-purple-600 mb-2">
                      {test.test_type} • Pass: {test.passing_score}% • Time: {test.allowed_time}min
                    </div>

                    <div className="flex items-center justify-between text-sm text-purple-600">
                      <span>
                        Created {new Date(test.created_at).toLocaleDateString()}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditEvaluationTest(test.id)
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </motion.div>
            ))}
            {evaluationTests.length === 0 && (
              <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <Card.Body className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    No Evaluation Test
                  </h3>
                  <p className="text-purple-600 mb-4">
                    Create the first evaluation test to get started.
                  </p>
                  <Button
                    onClick={() => router.push('/admin/content/evaluation/new')}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Create Evaluation Test
                  </Button>
                </Card.Body>
              </Card>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
