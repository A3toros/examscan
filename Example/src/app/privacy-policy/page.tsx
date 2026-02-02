'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PrivacyPolicyPage() {
  const { t } = useTranslation()
  const router = useRouter()

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-neutral-600 hover:text-neutral-800 transition-colors"
            >
              {t('privacyPolicy.backButton', '← Back')}
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
              {t('privacyPolicy.title', 'Privacy Policy')}
            </h1>
            <p className="text-xl text-neutral-600 mb-2">
              {t('privacyPolicy.platformName', 'TutorCat - AI Language Learning Platform')}
            </p>
            <p className="text-neutral-500">
              Mathayomwatsing School • {t('privacyPolicy.lastUpdated', 'Last updated')}: {currentDate}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.introduction.title', 'Introduction')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('privacyPolicy.introduction.content1', 'TutorCat is an AI-powered language learning platform developed by Mathayomwatsing School to provide interactive English language education for students. This platform combines gamified learning with AI-driven feedback to create an engaging and effective learning experience.')}
            </p>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('privacyPolicy.introduction.content2', 'This Privacy Policy explains how we collect, use, store, and protect personal information when you use TutorCat. By using our platform, you agree to the collection and use of information in accordance with this policy.')}
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-blue-800 font-medium">
                <strong>{t('privacyPolicy.introduction.dataController', 'Data Controller: Aleksandr Petrov, Mathayomwatsing School')}</strong>
              </p>
              <p className="text-blue-700 text-sm mt-1">
                {t('privacyPolicy.introduction.contact', 'Contact: aleksandr.p@mws.ac.th')}
              </p>
            </div>
          </section>

          {/* User Consent */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.userConsent.title', 'User Consent')}</h2>
            <p className="text-neutral-700 leading-relaxed">
              {t('privacyPolicy.userConsent.content', 'By using TutorCat, users (or their parents/guardians if under 18) consent to the collection, processing, and use of their personal data as described in this Privacy Policy. If you do not agree with this policy, please do not use our platform.')}
            </p>
          </section>

          {/* Platform Purpose */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.platformPurpose.title', 'Platform Purpose')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('privacyPolicy.platformPurpose.intro', 'TutorCat enables students to:')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
              <li>{t('privacyPolicy.platformPurpose.features.0', 'Complete interactive language learning activities')}</li>
              <li>{t('privacyPolicy.platformPurpose.features.1', 'Receive AI-powered feedback on speaking and writing')}</li>
              <li>{t('privacyPolicy.platformPurpose.features.2', 'Track learning progress and achievements')}</li>
              <li>{t('privacyPolicy.platformPurpose.features.3', 'Take placement tests to determine language level')}</li>
              <li>{t('privacyPolicy.platformPurpose.features.4', 'Access educational content and exercises')}</li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.childrensPrivacy.title', 'Children\'s Privacy')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('privacyPolicy.childrensPrivacy.content', 'TutorCat is designed specifically for students and educational use. We are committed to protecting the privacy of children under 18 years of age.')}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                <strong>{t('privacyPolicy.childrensPrivacy.parentalRights', 'Parental Rights: Parents and guardians have the right to review, modify, or request deletion of their child\'s personal information. Please contact the school administration at aleksandr.p@mws.ac.th for any privacy-related requests regarding student data.')}</strong>
              </p>
            </div>
          </section>

          {/* Data Collection */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.dataCollection.title', 'Data Collection')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('privacyPolicy.dataCollection.intro', 'We collect only the minimum data necessary to provide educational services:')}
            </p>

            <div className="space-y-4">
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-2">{t('privacyPolicy.dataCollection.accountInfo.title', 'Account Information')}</h3>
                <p className="text-neutral-600 text-sm">
                  {t('privacyPolicy.dataCollection.accountInfo.content', 'Student name, email, grade level, and class information for authentication and personalization.')}
                </p>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-2">{t('privacyPolicy.dataCollection.learningData.title', 'Learning Data')}</h3>
                <p className="text-neutral-600 text-sm">
                  {t('privacyPolicy.dataCollection.learningData.content', 'Answers, scores, progress, completion status, and time spent on activities.')}
                </p>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-2">{t('privacyPolicy.dataCollection.technicalData.title', 'Technical Data')}</h3>
                <p className="text-neutral-600 text-sm">
                  {t('privacyPolicy.dataCollection.technicalData.content', 'Device information, browser type, and usage patterns to improve platform performance.')}
                </p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <p className="text-green-800 font-medium">
                <strong>{t('privacyPolicy.dataCollection.important', 'Important: TutorCat does not collect sensitive personal information beyond what is necessary for educational purposes. We do not sell, share, or use student data for advertising or commercial purposes.')}</strong>
              </p>
            </div>
          </section>

          {/* Data Usage */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.dataUsage.title', 'How We Use Your Data')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('privacyPolicy.dataUsage.intro', 'Student data is used exclusively for educational purposes:')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
              <li>{t('privacyPolicy.dataUsage.purposes.0', 'Provide personalized learning experiences')}</li>
              <li>{t('privacyPolicy.dataUsage.purposes.1', 'Track academic progress and learning achievements')}</li>
              <li>{t('privacyPolicy.dataUsage.purposes.2', 'Generate AI-powered feedback for language exercises')}</li>
              <li>{t('privacyPolicy.dataUsage.purposes.3', 'Improve platform functionality and user experience')}</li>
              <li>{t('privacyPolicy.dataUsage.purposes.4', 'Provide technical support and assistance')}</li>
              <li>{t('privacyPolicy.dataUsage.purposes.5', 'Generate reports for teachers and parents')}</li>
            </ul>
          </section>

          {/* Data Storage & Security */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.dataStorage.title', 'Data Storage & Security')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('privacyPolicy.dataStorage.content1', 'Student data is stored securely using industry-standard encryption and security measures. All data is hosted on secure cloud infrastructure compliant with educational data protection standards.')}
            </p>
            <p className="text-neutral-700 leading-relaxed">
              {t('privacyPolicy.dataStorage.content2', 'We implement technical and organizational security measures to prevent unauthorized access, alteration, disclosure, or destruction of personal information.')}
            </p>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.dataSharing.title', 'Data Sharing and Disclosure')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('privacyPolicy.dataSharing.intro', 'We do not sell, rent, or trade student data. Data may only be shared in the following circumstances:')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
              <li><strong>{t('privacyPolicy.dataSharing.circumstances.0.title', 'Teachers and School Staff')}:</strong>{t('privacyPolicy.dataSharing.circumstances.0.description', ' For educational assessment and progress monitoring')}</li>
              <li><strong>{t('privacyPolicy.dataSharing.circumstances.1.title', 'Parents/Guardians')}:</strong>{t('privacyPolicy.dataSharing.circumstances.1.description', ' To review their child\'s learning progress and achievements')}</li>
              <li><strong>{t('privacyPolicy.dataSharing.circumstances.2.title', 'Legal Requirements')}:</strong>{t('privacyPolicy.dataSharing.circumstances.2.description', ' When required by law or educational regulations')}</li>
              <li><strong>{t('privacyPolicy.dataSharing.circumstances.3.title', 'Service Providers')}:</strong>{t('privacyPolicy.dataSharing.circumstances.3.description', ' With trusted educational technology providers under strict contracts')}</li>
            </ul>
          </section>

          {/* User Rights */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.userRights.title', 'Your Rights')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('privacyPolicy.userRights.intro', 'Students, parents, and guardians have the following rights regarding personal data:')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
              <li>{t('privacyPolicy.userRights.rights.0', 'Access and review personal data collected')}</li>
              <li>{t('privacyPolicy.userRights.rights.1', 'Request correction of inaccurate information')}</li>
              <li>{t('privacyPolicy.userRights.rights.2', 'Request deletion of personal data')}</li>
              <li>{t('privacyPolicy.userRights.rights.3', 'Object to certain data processing activities')}</li>
              <li>{t('privacyPolicy.userRights.rights.4', 'Request data portability')}</li>
            </ul>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-blue-800">
                <strong>{t('privacyPolicy.userRights.contact', 'Contact: To exercise these rights, please contact Aleksandr Petrov at')}</strong>{' '}
                <a
                  href="mailto:aleksandr.p@mws.ac.th"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  {t('privacyPolicy.userRights.email', 'aleksandr.p@mws.ac.th')}
                </a>
              </p>
            </div>
          </section>

          {/* Cookies and Local Storage */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.cookies.title', 'Cookies and Local Storage')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('privacyPolicy.cookies.intro', 'TutorCat uses essential cookies and local storage to provide core functionality and maintain a secure learning environment.')}
            </p>

            <div className="space-y-4">
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-2">{t('privacyPolicy.cookies.authCookies.title', 'Authentication Cookies')}</h3>
                <p className="text-neutral-600 text-sm">
                  {t('privacyPolicy.cookies.authCookies.content', 'Secure HTTP-only cookies store authentication tokens to keep students logged in safely.')}
                </p>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <h3 className="font-semibold text-neutral-800 mb-2">{t('privacyPolicy.cookies.progressStorage.title', 'Progress Storage')}</h3>
                <p className="text-neutral-600 text-sm">
                  {t('privacyPolicy.cookies.progressStorage.content', 'Local storage saves learning progress and answers to prevent data loss during sessions.')}
                </p>
              </div>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.dataRetention.title', 'Data Retention')}</h2>
            <p className="text-neutral-700 leading-relaxed">
              {t('privacyPolicy.dataRetention.content', 'We retain student data only as long as necessary to provide educational services and comply with school record-keeping requirements. Academic records may be retained according to educational data retention policies. Students or parents may request data deletion at any time.')}
            </p>
          </section>

          {/* Changes to Policy */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.policyChanges.title', 'Changes to This Privacy Policy')}</h2>
            <p className="text-neutral-700 leading-relaxed">
              {t('privacyPolicy.policyChanges.content', 'We may update this Privacy Policy from time to time. We will notify users of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. Continued use of TutorCat after changes constitutes acceptance of the updated policy.')}
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('privacyPolicy.contact.title', 'Contact Information')}</h2>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-neutral-800 mb-2">{t('privacyPolicy.contact.officerTitle', 'Data Protection Officer')}</h3>
              <p className="text-neutral-700 mb-2">
                <strong>{t('privacyPolicy.contact.name', 'Aleksandr Petrov')}</strong><br/>
                {t('privacyPolicy.contact.position', 'Teacher & Platform Developer')}<br/>
                {t('privacyPolicy.contact.school', 'Mathayomwatsing School')}
              </p>
              <p className="text-neutral-700">
                Email: <a
                  href="mailto:aleksandr.p@mws.ac.th"
                  className="text-primary-600 hover:text-primary-800 underline"
                >
                  {t('privacyPolicy.contact.email', 'aleksandr.p@mws.ac.th')}
                </a>
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-neutral-500">
          <Link href="/" className="text-primary-600 hover:text-primary-800 underline">
            {t('privacyPolicy.backToHome', '← Back to TutorCat')}
          </Link>
        </div>
      </div>
    </div>
  )
}
