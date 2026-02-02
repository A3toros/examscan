'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function TermsOfServicePage() {
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
              {t('termsOfService.backButton', '← Back')}
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
              {t('termsOfService.title', 'Terms of Service')}
            </h1>
            <p className="text-xl text-neutral-600 mb-2">
              {t('termsOfService.platformName', 'TutorCat - AI Language Learning Platform')}
            </p>
            <p className="text-neutral-500">
              Mathayomwatsing School • {t('termsOfService.lastUpdated', 'Last updated')}: {currentDate}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
          {/* Acceptance of Terms */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.acceptance.title', 'Acceptance of Terms')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('termsOfService.acceptance.content1', 'By accessing and using TutorCat, an AI-powered language learning platform developed by Mathayomwatsing School, you accept and agree to be bound by the terms and provision of this agreement.')}
            </p>
            <p className="text-neutral-700 leading-relaxed">
              {t('termsOfService.acceptance.content2', 'If you do not agree to abide by the above, please do not use this service. This Terms of Service agreement is effective as of')} {currentDate}.
            </p>
          </section>

          {/* Description of Service */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.serviceDescription.title', 'Description of Service')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('termsOfService.serviceDescription.intro', 'TutorCat is an educational platform that provides:')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
              <li>{t('termsOfService.serviceDescription.features.0', 'Interactive English language learning activities')}</li>
              <li>{t('termsOfService.serviceDescription.features.1', 'AI-powered feedback on speaking and writing exercises')}</li>
              <li>{t('termsOfService.serviceDescription.features.2', 'Progress tracking and achievement systems')}</li>
              <li>{t('termsOfService.serviceDescription.features.3', 'Placement testing to determine language proficiency levels')}</li>
              <li>{t('termsOfService.serviceDescription.features.4', 'Educational content and resources for language learning')}</li>
            </ul>
            <p className="text-neutral-700 leading-relaxed mt-4">
              {t('termsOfService.serviceDescription.educationalUse', 'The platform is designed specifically for educational use by students of Mathayomwatsing School.')}
            </p>
          </section>

          {/* User Accounts */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.userAccounts.title', 'User Accounts')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('termsOfService.userAccounts.intro', 'To access certain features of TutorCat, you must create an account. You are responsible for:')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
              <li>{t('termsOfService.userAccounts.responsibilities.0', 'Maintaining the confidentiality of your account credentials')}</li>
              <li>{t('termsOfService.userAccounts.responsibilities.1', 'All activities that occur under your account')}</li>
              <li>{t('termsOfService.userAccounts.responsibilities.2', 'Notifying school administration immediately of any unauthorized use')}</li>
              <li>{t('termsOfService.userAccounts.responsibilities.3', 'Providing accurate and current information')}</li>
            </ul>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <p className="text-yellow-800 font-medium">
                <strong>{t('termsOfService.userAccounts.studentResponsibility', 'Student Responsibility: Students are responsible for appropriate use of the platform. Misuse may result in account suspension or other disciplinary actions.')}</strong>
              </p>
            </div>
          </section>

          {/* Acceptable Use Policy */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.acceptableUse.title', 'Acceptable Use Policy')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('termsOfService.acceptableUse.intro', 'By using TutorCat, you agree to use the platform appropriately and in compliance with school policies:')}
            </p>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">{t('termsOfService.acceptableUse.permittedTitle', '✅ Permitted Use')}</h3>
                <ul className="list-disc list-inside space-y-1 text-green-700 text-sm ml-4">
                  <li>{t('termsOfService.acceptableUse.permittedActivities.0', 'Completing assigned language learning activities')}</li>
                  <li>{t('termsOfService.acceptableUse.permittedActivities.1', 'Practicing English language skills')}</li>
                  <li>{t('termsOfService.acceptableUse.permittedActivities.2', 'Reviewing personal learning progress')}</li>
                  <li>{t('termsOfService.acceptableUse.permittedActivities.3', 'Participating in educational assessments')}</li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">{t('termsOfService.acceptableUse.prohibitedTitle', '❌ Prohibited Activities')}</h3>
                <ul className="list-disc list-inside space-y-1 text-red-700 text-sm ml-4">
                  <li>{t('termsOfService.acceptableUse.prohibitedActivities.0', 'Sharing account credentials with others')}</li>
                  <li>{t('termsOfService.acceptableUse.prohibitedActivities.1', 'Attempting to circumvent security measures')}</li>
                  <li>{t('termsOfService.acceptableUse.prohibitedActivities.2', 'Uploading inappropriate or harmful content')}</li>
                  <li>{t('termsOfService.acceptableUse.prohibitedActivities.3', 'Using the platform for non-educational purposes')}</li>
                  <li>{t('termsOfService.acceptableUse.prohibitedActivities.4', 'Attempting to access other users\' data')}</li>
                  <li>{t('termsOfService.acceptableUse.prohibitedActivities.5', 'Disrupting platform functionality')}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Academic Integrity */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.academicIntegrity.title', 'Academic Integrity')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('termsOfService.academicIntegrity.content1', 'TutorCat includes measures to ensure fair assessment and maintain academic integrity. By using this platform, you agree to maintain honest academic practices.')}
            </p>
            <p className="text-neutral-700 leading-relaxed">
              {t('termsOfService.academicIntegrity.content2', 'The platform may monitor user behavior during assessments and exercises. Any attempts to cheat, plagiarize, or otherwise violate academic integrity may result in:')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4 mt-4">
              <li>{t('termsOfService.academicIntegrity.consequences.0', 'Invalidation of assessment results')}</li>
              <li>{t('termsOfService.academicIntegrity.consequences.1', 'Account suspension or termination')}</li>
              <li>{t('termsOfService.academicIntegrity.consequences.2', 'Referral to school administration')}</li>
              <li>{t('termsOfService.academicIntegrity.consequences.3', 'Other disciplinary actions as determined by school policy')}</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.intellectualProperty.title', 'Intellectual Property')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('termsOfService.intellectualProperty.content1', 'TutorCat and its original content, features, and functionality are owned by Mathayomwatsing School and are protected by copyright, trademark, and other intellectual property laws.')}
            </p>
            <p className="text-neutral-700 leading-relaxed">
              {t('termsOfService.intellectualProperty.content2', 'User-generated content submitted to the platform remains the property of the user, but by submitting content, users grant the school a license to use, display, and distribute the content for educational purposes.')}
            </p>
          </section>

          {/* Privacy and Data Protection */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.privacyDataProtection.title', 'Privacy and Data Protection')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('termsOfService.privacyDataProtection.content1', 'Your privacy is important to us. Please review our')}{' '}
              <Link href="/privacy-policy" className="text-primary-600 hover:text-primary-800 underline">
                {t('termsOfService.privacyDataProtection.privacyPolicyLink', 'Privacy Policy')}
              </Link>{' '}
              {t('termsOfService.privacyDataProtection.content2', 'which explains how we collect, use, and protect your personal information.')}
            </p>
            <p className="text-neutral-700 leading-relaxed">
              {t('termsOfService.privacyDataProtection.content3', 'By using TutorCat, you consent to the collection and use of your data as described in our Privacy Policy.')}
            </p>
          </section>

          {/* Service Availability */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.serviceAvailability.title', 'Service Availability')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('termsOfService.serviceAvailability.content1', 'While we strive to provide continuous access to TutorCat, we do not guarantee that the service will be available at all times. The platform may be unavailable due to:')}
            </p>
            <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
              <li>{t('termsOfService.serviceAvailability.reasons.0', 'Scheduled maintenance')}</li>
              <li>{t('termsOfService.serviceAvailability.reasons.1', 'Technical issues')}</li>
              <li>{t('termsOfService.serviceAvailability.reasons.2', 'Force majeure events')}</li>
              <li>{t('termsOfService.serviceAvailability.reasons.3', 'Security concerns')}</li>
            </ul>
            <p className="text-neutral-700 leading-relaxed mt-4">
              {t('termsOfService.serviceAvailability.content2', 'We will make reasonable efforts to minimize service disruptions and notify users in advance when possible.')}
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.liability.title', 'Limitation of Liability')}</h2>
            <p className="text-neutral-700 leading-relaxed">
              {t('termsOfService.liability.content', 'TutorCat is provided "as is" without warranties of any kind. Mathayomwatsing School shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of the platform. Our total liability shall not exceed the amount paid by the user for the service, if any.')}
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.termination.title', 'Termination')}</h2>
            <p className="text-neutral-700 leading-relaxed mb-4">
              {t('termsOfService.termination.content1', 'We reserve the right to terminate or suspend your account and access to TutorCat at our discretion, without prior notice, for conduct that violates these Terms of Service or school policies.')}
            </p>
            <p className="text-neutral-700 leading-relaxed">
              {t('termsOfService.termination.content2', 'Upon termination, your right to use the service will cease immediately. All provisions of these Terms that by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, and limitations of liability.')}
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.governingLaw.title', 'Governing Law')}</h2>
            <p className="text-neutral-700 leading-relaxed">
              {t('termsOfService.governingLaw.content', 'These Terms of Service shall be governed by and construed in accordance with the laws of Thailand, without regard to its conflict of law provisions. Any disputes arising from these terms shall be resolved through the appropriate school administration channels.')}
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.changes.title', 'Changes to Terms')}</h2>
            <p className="text-neutral-700 leading-relaxed">
              {t('termsOfService.changes.content', 'We reserve the right to modify these Terms of Service at any time. We will notify users of material changes by posting the updated terms on this page and updating the "Last updated" date. Continued use of TutorCat after changes constitutes acceptance of the modified terms.')}
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-bold text-neutral-800 mb-4">{t('termsOfService.contact.title', 'Contact Information')}</h2>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
              <h3 className="font-semibold text-neutral-800 mb-2">{t('termsOfService.contact.administratorTitle', 'Platform Administrator')}</h3>
              <p className="text-neutral-700 mb-2">
                <strong>{t('termsOfService.contact.name', 'Aleksandr Petrov')}</strong><br/>
                {t('termsOfService.contact.position', 'Teacher & Platform Developer')}<br/>
                {t('termsOfService.contact.school', 'Mathayomwatsing School')}
              </p>
              <p className="text-neutral-700">
                Email: <a
                  href="mailto:aleksandr.p@mws.ac.th"
                  className="text-primary-600 hover:text-primary-800 underline"
                >
                  {t('termsOfService.contact.email', 'aleksandr.p@mws.ac.th')}
                </a>
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-neutral-500">
          <Link href="/" className="text-primary-600 hover:text-primary-800 underline">
            {t('termsOfService.backToHome', '← Back to TutorCat')}
          </Link>
        </div>
      </div>
    </div>
  )
}
