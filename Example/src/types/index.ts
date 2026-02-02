// Core types for TutorCat application

export interface User {
  id: string
  email: string
  username?: string | null
  firstName?: string
  lastName?: string
  level: string // 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
  role?: string // 'user' or 'admin'
  currentLesson?: number
  totalStars?: number
  evalTestResult?: any // evaluation test results (null if not taken)
  createdAt?: string
  lastLogin?: string | null
  emailVerified?: boolean
  student_id?: string // For legacy compatibility
  // Legacy snake_case properties for backward compatibility
  current_lesson?: number
  total_stars?: number
  created_at?: string
  last_login?: string | null
  email_verified?: boolean
  first_name?: string
  last_name?: string
  eval_test_result?: any
}

export interface Lesson {
  id: string
  level: string
  topic: string
  lesson_number: number
  created_at: string
  updated_at: string
}

export interface LessonActivity {
  id: string
  lesson_id: string
  activity_type: ActivityType
  activity_order: number
  title?: string // Optional display title
  description?: string // Optional description/instructions
  estimated_time_seconds?: number // Estimated completion time
  content: any // JSON content specific to activity type
  vocabulary_items?: VocabularyItem[] // Related vocabulary items
  grammar_sentences?: GrammarSentence[] // Related grammar sentences
  created_at: string
  updated_at: string
}

export type ActivityType =
  | 'warm_up_speaking'
  | 'vocabulary_intro'
  | 'vocabulary_matching_drag'
  | 'vocabulary_fill_blanks'
  | 'grammar_explanation'
  | 'grammar_sentences'
  | 'speaking_practice'
  | 'listening_practice'

export interface VocabularyItem {
  id: string
  activity_id: string
  english_word: string
  thai_translation: string
  audio_url?: string
  created_at: string
}

export interface GrammarSentence {
  id: string
  activity_id: string
  original_sentence: string
  correct_sentence: string
  words_array: string[]
  created_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  lesson_id: string
  score: number
  completed: boolean
  completed_at?: string
  attempts: number
}

export interface LessonComplete {
  lesson_id: string
  level: string
  topic: string
  lesson_number: number
  lesson_created_at: string
  lesson_updated_at: string
  activities: (LessonActivity & {
    vocabulary_items?: VocabularyItem[]
    grammar_sentences?: GrammarSentence[]
  })[]
}

export interface UserLessonProgress {
  lesson_id: string
  level: string
  topic: string
  lesson_number: number
  user_id: string
  score: number
  completed: boolean
  completed_at?: string
  attempts: number
  completion_percentage: number
  current_title: string
  next_title_percentage?: number
  next_title?: string
  lesson_completion_contribution: number
  level_progress_percentage: number
}

// Authentication types
export interface LoginCredentials {
  email: string
  password?: string // Not needed for OTP
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// Modal types
export type ModalType = 'login' | 'notification' | 'loading' | 'confirm'

// Theme types
export type Theme = 'light' | 'cyberpunk' | 'kpop'

// Component props types
export interface ButtonProps {
  children: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  className?: string
}

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

// Form types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'textarea'
  required?: boolean
  placeholder?: string
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    custom?: (value: any) => string | null
  }
}

// Lesson activity content types
export interface WarmUpSpeakingContent {
  prompt: string
  evaluation: {
    mode: 'semantic'
    required_intent: string[]
    min_items: number
    score: boolean
  }
  fail_prompt: string
  pass_condition: string
  next_unlocked: boolean
}

export interface VocabularyIntroContent {
  items: Array<{
    en: string
    th: string
  }>
}

export interface VocabMatchDragContent {
  items: Array<{
    word: string
    meaning: string
  }>
  rules: {
    must_be_all_correct: boolean
    on_error: string
    retry_until_correct: boolean
  }
}

export interface VocabFillDropdownContent {
  sentences: Array<{
    text: string
    options: string[]
    answer: string
  }>
  rules: {
    must_be_all_correct: boolean
    on_error: string
    retry_until_correct: boolean
  }
}

export interface GrammarDragSentenceContent {
  sentences: Array<{
    words: string[]
    answer: string
  }>
  rules: {
    must_be_all_correct: boolean
    on_error: string
    retry_until_correct: boolean
  }
}

export interface SpeakingWithFeedbackContent {
  prompt: string
  input: 'speech'
  feedback: {
    grammar: boolean
    vocabulary: boolean
    format: string
  }
}

export interface LanguageImprovementReadingContent {
  source: string
  task: string
  evaluation: {
    metric: string
    threshold: number
  }
  rules: {
    retry_below_threshold: boolean
  }
}
