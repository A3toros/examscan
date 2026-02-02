'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { hasConsented, isConsentValid, hasPoliciesChanged, storeConsent } from '@/utils/cookieConsent';

const CookieConsentBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    // Check consent status and policy changes
    const currentLanguage = i18n.language || 'en';

    if (!hasConsented()) {
      // First time user - show banner
      setShowBanner(true);
      return;
    }

    if (!isConsentValid()) {
      // Policies have changed or consent expired
      setNeedsUpdate(true);
      setShowBanner(true);
    } else if (hasPoliciesChanged()) {
      // Policies updated since last consent
      setNeedsUpdate(true);
      setShowBanner(true);
    }
  }, [i18n.language]);

  const handleConsent = () => {
    storeConsent(i18n.language || 'en');
    setShowBanner(false);
    setNeedsUpdate(false);
  };

  const handleDecline = () => {
    // For essential cookies, we can't decline but we can acknowledge
    handleConsent();
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-6">
      <div className="max-w-4xl mx-auto rounded-lg shadow-2xl border-2 bg-white border-neutral-200">
        <div className="p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold mb-2 text-neutral-900">
                {needsUpdate
                  ? t('cookieConsent.updatedTitle', 'Privacy Policy & Terms Updated')
                  : t('cookieConsent.title', 'Cookie Information')
                }
              </h3>
              <p className="text-sm text-neutral-700 mb-3">
                {needsUpdate
                  ? t('cookieConsent.updatedMessage', 'Our privacy policy and terms of service have been updated. Please review the changes.')
                  : t('cookieConsent.message', 'This app uses only essential cookies and local storage to manage authentication, sessions, and learning progress. These functions are necessary for the app to operate correctly and do not require user consent under GDPR or Thailand\'s PDPA. No tracking or advertising cookies are used.')
                }
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <a
                  href="/privacy-policy"
                  className="underline text-blue-600 hover:text-blue-800 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('cookieConsent.privacyPolicy', 'Privacy Policy')}
                </a>
                <a
                  href="/terms-of-service"
                  className="underline text-blue-600 hover:text-blue-800 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('cookieConsent.termsOfService', 'Terms of Service')}
                </a>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-auto sm:w-auto">
              {needsUpdate && (
                <button
                  onClick={handleDecline}
                  className="font-medium rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer px-4 py-2 text-sm sm:px-3 sm:py-1.5 sm:text-sm bg-neutral-200 hover:bg-neutral-300 text-neutral-800 focus:ring-neutral-500 whitespace-nowrap"
                >
                  {t('cookieConsent.decline', 'Decline')}
                </button>
              )}
              <button
                onClick={handleConsent}
                className="font-medium rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer px-4 py-2 text-sm sm:px-3 sm:py-1.5 sm:text-sm bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 whitespace-nowrap"
              >
                {needsUpdate
                  ? t('cookieConsent.accept', 'Accept Updated Policies')
                  : t('cookieConsent.acknowledge', 'I Understand')
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
