import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cookie, Shield, Settings } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';

const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const hasConsented = localStorage.getItem('cookie-consent');
    const consentVersion = localStorage.getItem('cookie-consent-version');

    // If no consent or old version, show banner
    if (!hasConsented || consentVersion !== '1.0') {
      // Small delay to avoid showing immediately on page load
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAllCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    localStorage.setItem('cookie-consent-version', '1.0');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    localStorage.setItem('analytics-consent', 'true');
    localStorage.setItem('functional-consent', 'true');
    setIsVisible(false);
  };

  const acceptEssentialOnly = () => {
    localStorage.setItem('cookie-consent', 'essential-only');
    localStorage.setItem('cookie-consent-version', '1.0');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    localStorage.setItem('analytics-consent', 'false');
    localStorage.setItem('functional-consent', 'true');
    setIsVisible(false);
  };

  const dismissBanner = () => {
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <Card className="max-w-6xl mx-auto shadow-2xl border-2 border-blue-200 bg-white/95 backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <Cookie className="w-8 h-8 text-blue-600 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Cookie Preferences</h3>
                    <p className="text-sm text-gray-600">We use cookies to enhance your experience</p>
                  </div>
                </div>
                <button
                  onClick={dismissBanner}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  aria-label="Close cookie banner"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 leading-relaxed mb-4">
                  ExamScan uses cookies and local storage to provide essential functionality, improve your experience,
                  and analyze usage patterns. We respect your privacy and only collect necessary information.
                </p>

                {!showDetails ? (
                  <button
                    onClick={() => setShowDetails(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                  >
                    <Settings size={16} className="mr-1" />
                    Manage Preferences
                  </button>
                ) : (
                  <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                        <Shield className="w-4 h-4 text-green-600 mr-2" />
                        Essential Cookies (Always Active)
                      </h4>
                      <p className="text-sm text-gray-600">
                        Required for authentication, security, and basic functionality. Cannot be disabled.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Functional Cookies</h4>
                      <p className="text-sm text-gray-600">
                        Remember your preferences and settings for a better experience.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Analytics Cookies</h4>
                      <p className="text-sm text-gray-600">
                        Help us understand how you use ExamScan to improve our service.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={acceptEssentialOnly}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Essential Only
                </Button>
                <Button
                  onClick={acceptAllCookies}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Accept All Cookies
                </Button>
              </div>

              <div className="mt-4 text-xs text-gray-500 text-center">
                By using ExamScan, you agree to our{' '}
                <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                {' '}and{' '}
                <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
