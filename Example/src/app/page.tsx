'use client'

import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button, Card, Mascot, VideoPlayer } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { useModal } from '@/contexts/ModalContext'
import { useAuth } from '@/contexts/AuthContext'
import LoginModal from '@/components/auth/LoginModal'

function HomeContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const { showNotification } = useNotification()
  const { showModal } = useModal()
  const { isAuthenticated, isLoading, user } = useAuth()
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile vs desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Redirect authenticated users away from home page
  // This ONLY runs on the home page (/) to prevent loops
  useEffect(() => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
    
    // Only redirect if we're on the home page
    if (currentPath !== '/') {
      return
    }

    // Wait for auth to load
    if (isLoading) {
      return
    }

    // If authenticated, redirect based on role
    if (isAuthenticated) {
      // Check if user is admin (role is most reliable)
      if (user?.role === 'admin') {
        // Admin token is in HTTP cookie, sent automatically with API requests
        window.location.href = '/admin/dashboard'
        return
      }
      
      // Regular user - redirect to dashboard
      window.location.href = '/dashboard'
    }
  }, [isAuthenticated, isLoading, user])

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-neutral-600">{t('common.loading', 'Loading...')}</p>
        </div>
      </main>
    )
  }

  // If user is authenticated, show loading while redirecting to their dashboard
  // The redirect happens in useEffect above
  if (isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-neutral-600">{t('common.loading', 'Loading...')}</p>
        </div>
      </main>
    )
  }

  const handleLogin = () => {
    showModal({
      component: LoginModal,
      props: {
        onSuccess: () => {
          // LoginModal handles redirects based on user role
          // No need to redirect here
        }
      }
    })
  }

  const handleSignup = () => {
    router.push('/auth/signup')
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section with Authentication Focus */}
      <div className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-secondary-50" />

        {/* Floating Shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary-200/30 rounded-full blur-3xl" />
        </div>

        <div className="relative container mx-auto px-4 py-16 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
            {/* Left Column - Content */}
            <div className="text-center lg:text-left">
              <div className="mb-8">
                <Mascot
                  size="xl"
                  emotion="excited"
                  speechText={t('mascot.greeting')}
                  className="mx-auto lg:mx-0 mb-6"
                />
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-6">
                {t('auth.welcome', 'Welcome to TutorCat')}
              </h1>

              <p className="text-xl text-neutral-600 mb-8 max-w-lg mx-auto lg:mx-0">
                {t('auth.heroDescription', 'Master English with AI-powered lessons, gamification, and your adorable cat companion. Start your language journey today!')}
              </p>

              {/* Authentication Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center lg:items-start lg:justify-start mb-8">
                <Button onClick={handleLogin} size="sm" className="self-center sm:self-auto !px-6 !py-2.5 !text-base sm:!px-8 sm:!py-4 sm:!text-lg">
                  {t('header.login', 'Login')}
                </Button>
                <Button onClick={handleSignup} variant="secondary" size="sm" className="self-center sm:self-auto !px-6 !py-2.5 !text-base sm:!px-8 sm:!py-4 sm:!text-lg">
                  {t('header.signup', 'Sign Up')}
                </Button>
              </div>

            </div>

            {/* Right Column - Features Preview */}
            <div className="hidden lg:block">
              <Card className="max-w-md mx-auto shadow-2xl border-0">
                <Card.Body className="p-8">
                  <h3 className="text-2xl font-bold text-center mb-6">
                    {t('auth.whyChooseUs', 'Why Choose TutorCat?')}
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <img src="/ai.png" alt="AI" className="w-5 h-5 object-contain" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{t('auth.aiPowered', 'AI-Powered')}</h4>
                        <p className="text-sm text-neutral-600">{t('auth.personalizedFeedback', 'Personalized feedback')}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-secondary-100 rounded-full flex items-center justify-center">
                        <img src="/game.png" alt="Gamified" className="w-5 h-5 object-contain" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{t('auth.gamified', 'Gamified')}</h4>
                        <p className="text-sm text-neutral-600">{t('auth.earnRewards', 'Earn titles & rewards')}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-accent-100 rounded-full flex items-center justify-center">
                        <img src="/speaking.png" alt="Speaking" className="w-5 h-5 object-contain" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{t('auth.speakingPractice', 'Speaking Practice')}</h4>
                        <p className="text-sm text-neutral-600">{t('auth.realConversations', 'Practice real conversations')}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center">
                        <img src="/lang.png" alt="Language" className="w-5 h-5 object-contain" />
                      </div>
                      <div>
                        <h4 className="font-semibold">{t('auth.multiLanguage', 'Multi-Language')}</h4>
                        <p className="text-sm text-neutral-600">{t('auth.thaiEnglish', 'Thai & English support')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-gradient-pastel rounded-lg">
                    <div className="text-center">
                      <p className="text-sm font-medium">{t('mascot.readyToLearn', 'Ready to learn?')}</p>
                      <p className="text-xs text-neutral-600">{t('mascot.joinThousands', 'Join thousands of learners!')}</p>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Video Section */}
      <div className="py-16 bg-gradient-to-b from-white to-neutral-50">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              {t('auth.watchDemo', 'Proudly presented by Mathayomwatsing')}
            </h2>
          </div>
          
          <div className="relative rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
            <div className={`w-full mx-auto ${isMobile ? 'max-w-[540px]' : 'max-w-5xl'}`} style={isMobile ? { aspectRatio: '9/16' } : { aspectRatio: '16/9' }}>
              <VideoPlayer
                src={isMobile 
                  ? "https://res.cloudinary.com/dnovxoaqi/video/upload/v1768026339/Sequence_01_1_a0e55g.mp4"
                  : "https://res.cloudinary.com/dnovxoaqi/video/upload/v1768027056/0001-0402_ycsdrv.mkv"
                }
                className="w-full h-full"
                controls={true}
                autoPlay={false}
                loop={false}
                muted={false}
                playsInline={true}
              />
            </div>
          </div>
          
          {/* Presentation Button */}
          <div className="mt-8 text-center">
            <Button
              onClick={() => router.push('/presentation')}
              variant="primary"
              size="lg"
              className="!px-8 !py-3"
            >
              {t('auth.presentation', 'Presentation')}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-secondary-600 mb-2">600+</div>
              <div className="text-neutral-600">{t('common.lessons', 'Lessons')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-neutral-600 mb-2">4.9★</div>
              <div className="text-neutral-600">{t('common.rating', 'Rating')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600 mb-2">300+</div>
              <div className="text-neutral-600">{t('common.students', 'Students')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-accent-600 mb-2">2</div>
              <div className="text-neutral-600">{t('common.languages', 'Languages')}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default HomeContent
