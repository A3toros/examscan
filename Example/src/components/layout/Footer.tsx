import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

const Footer: React.FC = () => {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-neutral-900 text-white py-12 overflow-hidden">
      <div className="container mx-auto px-4 max-w-full">
        {/* Mobile: Brand full width, then 2 columns for links. Desktop: 4-column grid */}
        <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-4 md:gap-8">
          {/* Brand Section - Full width on mobile, spans 2 columns on desktop */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src="/logo.webp" 
                alt="TutorCat Logo" 
                className="h-10 w-10 object-contain flex-shrink-0"
              />
              <div className="min-w-0">
                <h3 className="text-xl font-bold truncate">TutorCat</h3>
                <p className="text-neutral-400 text-sm truncate">{t('footer.platformDescription', 'AI Language Learning Platform')}</p>
              </div>
            </div>
            <p className="text-neutral-300 leading-relaxed mb-4 text-sm break-words">
              {t('footer.description', 'An innovative AI-powered language learning platform designed for students at Mathayomwatsing School, combining gamified learning with intelligent feedback to make language acquisition engaging and effective.')}
            </p>
            <div className="text-neutral-400 text-sm break-words">
              <p>{t('footer.schoolName', 'Mathayomwatsing School')}</p>
              <p>{t('footer.schoolTagline', 'Empowering students through technology-enhanced education')}</p>
            </div>
          </div>

          {/* Links Section - 2 columns on mobile, separate columns on desktop */}
          <div className="grid grid-cols-2 md:contents gap-6 md:gap-0">
            {/* Left Column - Developers & Contact (Mobile: Left, Desktop: 3rd column) */}
            <div className="md:col-span-1">
              {/* Developers Section */}
              <div className="mb-6 md:mb-0">
                <h4 className="text-base md:text-lg font-semibold mb-4">{t('footer.developers', 'Developers')}</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="/developers" className="text-neutral-300 hover:text-white transition-colors text-sm break-words">
                      {t('footer.meetTheTeam', 'Meet the Team')}
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Contact Section */}
              <div className="mt-6 md:mt-6">
                <h4 className="text-base md:text-lg font-semibold mb-4">{t('footer.contact', 'Contact')}</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="/contact" className="text-neutral-300 hover:text-white transition-colors text-sm break-words">
                      {t('footer.contactUs', 'Contact Us')}
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column - Legal (Mobile: Right, Desktop: 4th column) */}
            <div className="md:col-span-1">
              <h4 className="text-base md:text-lg font-semibold mb-4">{t('footer.legal', 'Legal')}</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/privacy-policy" className="text-neutral-300 hover:text-white transition-colors text-sm break-words">
                    {t('footer.privacyPolicy', 'Privacy Policy')}
                  </Link>
                </li>
                <li>
                  <Link href="/terms-of-service" className="text-neutral-300 hover:text-white transition-colors text-sm break-words">
                    {t('footer.termsOfService', 'Terms of Service')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-neutral-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-neutral-400 text-sm text-center md:text-left break-words">
              © {currentYear} {t('footer.schoolName', 'Mathayomwatsing School')}. {t('common.allRightsReserved', 'All rights reserved.')}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 text-sm text-neutral-400">
              <span className="whitespace-nowrap">{t('footer.builtWith', 'Built with ❤️ for education')}</span>
            </div>
          </div>

          {/* Additional Footer Text */}
          <div className="mt-4 text-center text-neutral-500 text-xs break-words px-2">
            <p>
              {t('footer.educationalNote', 'TutorCat is an educational platform developed by Mathayomwatsing School to enhance language learning through AI-powered feedback and gamified experiences. For educational use only.')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
