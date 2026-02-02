// Cookie Consent Manager
// Handles essential cookie consent with version checking for privacy policy/terms updates

// Current version of privacy policy and terms of service
// Increment these when policies are updated
export const CURRENT_POLICY_VERSION = '1.0.0';
export const CURRENT_TERMS_VERSION = '1.0.0';

export interface ConsentData {
  consented: boolean;
  consentDate: string;
  privacyVersion: string;
  termsVersion: string;
  language: string;
}

const CONSENT_STORAGE_KEY = 'cookie_consent_data';

/**
 * Check if user has given consent
 */
export const hasConsented = (): boolean => {
  try {
    const consentDataStr = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!consentDataStr) return false;

    const consentData: ConsentData = JSON.parse(consentDataStr);
    return consentData.consented;
  } catch (error) {
    console.warn('Error checking cookie consent:', error);
    return false;
  }
};

/**
 * Check if consent is still valid (policies haven't changed since consent)
 */
export const isConsentValid = (): boolean => {
  try {
    const consentDataStr = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!consentDataStr) return false;

    const consentData: ConsentData = JSON.parse(consentDataStr);

    // Check if policies have been updated since last consent
    const privacyChanged = consentData.privacyVersion !== CURRENT_POLICY_VERSION;
    const termsChanged = consentData.termsVersion !== CURRENT_TERMS_VERSION;

    return consentData.consented && !privacyChanged && !termsChanged;
  } catch (error) {
    console.warn('Error checking consent validity:', error);
    return false;
  }
};

/**
 * Check if policies have been updated since last consent
 */
export const hasPoliciesChanged = (): boolean => {
  try {
    const consentDataStr = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!consentDataStr) return false;

    const consentData: ConsentData = JSON.parse(consentDataStr);

    const privacyChanged = consentData.privacyVersion !== CURRENT_POLICY_VERSION;
    const termsChanged = consentData.termsVersion !== CURRENT_TERMS_VERSION;

    return privacyChanged || termsChanged;
  } catch (error) {
    return false;
  }
};

/**
 * Store consent data
 */
export const storeConsent = (language: string = 'en'): void => {
  const consentData: ConsentData = {
    consented: true,
    consentDate: new Date().toISOString(),
    privacyVersion: CURRENT_POLICY_VERSION,
    termsVersion: CURRENT_TERMS_VERSION,
    language
  };

  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentData));
};

/**
 * Get consent data
 */
export const getConsentData = (): ConsentData | null => {
  try {
    const consentDataStr = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!consentDataStr) return null;

    return JSON.parse(consentDataStr);
  } catch (error) {
    console.warn('Error getting consent data:', error);
    return null;
  }
};

/**
 * Clear consent data (for testing or reset purposes)
 */
export const clearConsent = (): void => {
  localStorage.removeItem(CONSENT_STORAGE_KEY);
};
