// API client for TutorCat authentication and data operations
import { User } from '@/types'

// Get API base URL
// In production, use current origin (works for both netlify.app and custom domain)
// In development, use Netlify dev server
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? (typeof window !== 'undefined' 
      ? window.location.origin 
      : (process.env.NEXT_PUBLIC_SITE_URL || 'https://tutorcat.online'))
  : 'http://localhost:8888' // Netlify dev server (proxies to Next.js)

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  rateLimited?: boolean
  retryAfter?: number
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Use Netlify functions path (dev server proxies to Next.js)
      const url = `${this.baseUrl}/.netlify/functions${endpoint}`

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include', // Include cookies for authentication
      })

      let data: any = {}
      let responseText = ''
      try {
        responseText = await response.text()
        if (responseText && responseText.trim()) {
          data = JSON.parse(responseText)
        } else {
          data = { error: 'No response data' }
        }
      } catch (parseError) {
        console.error('API: Failed to parse response JSON:', parseError)
        console.error('API: Raw response was:', responseText)
        data = { error: 'Invalid response format' }
      }

      // Check for 429 (rate limited) - show specific rate limit message
      if (response.status === 429) {
        return {
          success: false,
          error: data.error || 'Too many attempts. Please wait before trying again.',
          rateLimited: true,
          retryAfter: data.retryAfter,
        }
      }

      // Check for 401 (unauthorized) - token expired for admin requests
      if (response.status === 401 && endpoint.includes('admin')) {
        // Admin token expired - trigger full logout
        if (typeof window !== 'undefined') {
          console.warn('Admin token expired, logging out user');

          // Import and call logout dynamically to avoid circular imports
          import('@/contexts/AuthContext').then(({ useAuth }) => {
            // We can't use the hook directly here, so we'll trigger logout via localStorage/cookies
            // The AuthContext will detect the logout on next check

            // Clear localStorage (preserve cookie consent)
            const cookieConsentData = localStorage.getItem('cookie_consent_data');
            localStorage.clear();
            if (cookieConsentData) {
              localStorage.setItem('cookie_consent_data', cookieConsentData);
            }

            // Redirect to home page (logout will be detected by AuthContext)
            window.location.href = '/';
          }).catch(error => {
            console.error('Failed to handle admin logout:', error);
            // Fallback: just redirect
            window.location.href = '/';
          });
        }

        return {
          success: false,
          error: 'Admin session expired. Logging out...',
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Request failed (${response.status})`,
        }
      }

      return {
        success: true,
        data: data as T,
        message: data.message,
      }
    } catch (error) {
      console.error('API: Network error:', error)
      console.error('API: Base URL:', this.baseUrl)
      console.error('API: Endpoint:', endpoint)
      return {
        success: false,
        error: 'Network error',
      }
    }
  }

  // Authentication methods
  async login(username: string, password: string): Promise<ApiResponse<{ user: User; adminToken?: string }>> {
    return this.request('/auth-login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  }

  async sendOTP(email: string, type: 'login' | 'signup'): Promise<ApiResponse> {
    return this.request('/auth-send-otp', {
      method: 'POST',
      body: JSON.stringify({ email, type }),
    })
  }

  async verifyOTP(
    email: string,
    code: string,
    type: 'login' | 'signup',
    firstName?: string,
    lastName?: string,
    username?: string,
    password?: string
  ): Promise<ApiResponse<{ user: User; adminToken?: string }>> {
    return this.request('/auth-verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        code,
        type,
        firstName,
        lastName,
        username,
        password,
      }),
    })
  }

  async logout(): Promise<ApiResponse> {
    return this.request('/auth-logout', {
      method: 'POST',
    })
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return this.request('/auth-me', {
      method: 'GET',
    })
  }

  // Lesson methods
  async getLesson(lessonId: string): Promise<ApiResponse<{ lesson: any }>> {
    return this.request(`/get-lesson?lessonId=${lessonId}`, {
      method: 'GET',
    })
  }

  // AI processing methods
  async speechToText(audioData: { audioUrl?: string; audioBlob?: string }): Promise<ApiResponse<{ transcription: string; confidence: number }>> {
    return this.request('/ai-speech-to-text', {
      method: 'POST',
      body: JSON.stringify(audioData),
    })
  }

  async getAIFeedback(data: {
    transcription: string
    prompt: string
    criteria: { grammar?: boolean; vocabulary?: boolean; pronunciation?: boolean }
  }): Promise<ApiResponse<{
    overall_score: number
    feedback: any
    corrections: any
  }>> {
    return this.request('/ai-feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async checkSimilarity(data: {
    targetText: string
    userText: string
    threshold?: number
  }): Promise<ApiResponse<{
    similarity: number
    passed: boolean
    feedback: string
    suggestions: string[]
  }>> {
    return this.request('/ai-similarity', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Submit complete lesson results
  async submitLessonResults(data: any): Promise<ApiResponse> {
    return this.request('/.netlify/functions/submit-lesson-results', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getUserProgress(): Promise<ApiResponse> {
    return this.request('/progress/user', {
      method: 'GET',
    })
  }

  async getDashboardData(): Promise<ApiResponse> {
    return this.request('/get-dashboard-data', {
      method: 'GET',
    })
  }

  async getLessonsByLevel(level: string): Promise<ApiResponse> {
    return this.request(`/get-lessons-by-level?level=${level}`, {
      method: 'GET',
    })
  }

  async getAchievements(): Promise<ApiResponse> {
    return this.request('/get-user-achievements', {
      method: 'GET',
    })
  }

  async getAdminLessons(): Promise<ApiResponse> {
    // Admin token is in HTTP cookie, sent automatically with credentials: 'include'
    return this.request('/admin-lessons', {
      method: 'GET'
    })
  }

  async getAdminEvaluationTests(): Promise<ApiResponse> {
    // Use adminApiRequest to ensure proper token handling
    const { adminApiRequest } = await import('@/utils/adminApi')
    
    try {
      const response = await adminApiRequest('/.netlify/functions/admin-evaluation', {
        method: 'GET'
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: errorText || `HTTP error! status: ${response.status}`
        }
      }
      
      const data = await response.json()
      return {
        success: true,
        data: data
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch evaluation tests'
      }
    }
  }
}

// Create and export API client instance
export const apiClient = new ApiClient(API_BASE_URL)
export default apiClient