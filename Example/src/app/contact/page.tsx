'use client'

import React from 'react'
import { Card } from '@/components/ui'
import { useTranslation } from 'react-i18next'
import { Mail, User, Building, Briefcase } from 'lucide-react'

export default function ContactPage() {
  const { t } = useTranslation()

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100 py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              {t('contact.title', 'Contact')}
            </h1>
            <p className="text-lg text-slate-600">
              {t('contact.subtitle', 'Get in touch with our team')}
            </p>
          </div>

          {/* Contact Card */}
          <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-xl">
            <Card.Body className="p-8">
              <div className="space-y-6">
                {/* Name */}
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-1">
                      {t('contact.nameLabel', 'Name')}
                    </h3>
                    <p className="text-xl font-semibold text-slate-800">
                      Aleksandr Petrov
                    </p>
                  </div>
                </div>

                {/* Position */}
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-1">
                      {t('contact.positionLabel', 'Position')}
                    </h3>
                    <p className="text-lg text-slate-800">
                      Teacher & Platform Developer
                    </p>
                  </div>
                </div>

                {/* School */}
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Building className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-1">
                      {t('contact.schoolLabel', 'School')}
                    </h3>
                    <p className="text-lg text-slate-800">
                      Mathayomwatsing School
                    </p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Mail className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-1">
                      {t('contact.emailLabel', 'Email')}
                    </h3>
                    <a
                      href="mailto:aleksandr.p@mws.ac.th"
                      className="text-lg text-purple-600 hover:text-purple-700 font-medium underline transition-colors"
                    >
                      aleksandr.p@mws.ac.th
                    </a>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-purple-200 my-8"></div>

              {/* Additional Info */}
              <div className="bg-purple-50 rounded-lg p-6">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {t('contact.description', 'For questions, support, or feedback about TutorCat, please feel free to reach out. We\'re here to help enhance your language learning experience.')}
                </p>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </main>
  )
}

