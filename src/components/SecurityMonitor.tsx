import React, { useEffect } from 'react';
import { logSecurityEvent, isSuspiciousRequest } from '../utils/security';

interface SecurityMonitorProps {
  children: React.ReactNode;
}

const SecurityMonitor: React.FC<SecurityMonitorProps> = ({ children }) => {
  useEffect(() => {
    // Monitor for suspicious activities
    const handleBeforeUnload = () => {
      logSecurityEvent('page_unload', {
        timestamp: new Date().toISOString(),
        timeOnPage: Date.now() - window.performance.timing.navigationStart
      });
    };

    const handleFocus = () => {
      logSecurityEvent('window_focus', {
        timestamp: new Date().toISOString()
      });
    };

    const handleBlur = () => {
      logSecurityEvent('window_blur', {
        timestamp: new Date().toISOString()
      });
    };

    // Monitor copy/paste events for security
    const handleCopy = (e: ClipboardEvent) => {
      logSecurityEvent('clipboard_copy', {
        timestamp: new Date().toISOString(),
        target: e.target?.toString() || 'unknown'
      });
    };

    const handlePaste = (e: ClipboardEvent) => {
      const pastedText = e.clipboardData?.getData('text') || '';
      if (pastedText.length > 1000) {
        logSecurityEvent('large_paste_attempt', {
          timestamp: new Date().toISOString(),
          length: pastedText.length
        });
      }
    };

    // Monitor for developer tools
    let devtoolsOpen = false;
    const threshold = 160;
    const checkDevTools = () => {
      if (window.outerHeight - window.innerHeight > threshold || window.outerWidth - window.innerWidth > threshold) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          logSecurityEvent('devtools_opened', {
            timestamp: new Date().toISOString(),
            outerHeight: window.outerHeight,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            innerWidth: window.innerWidth
          });
        }
      } else {
        devtoolsOpen = false;
      }
    };

    // Check for suspicious user agent
    if (isSuspiciousRequest(navigator.userAgent, 'unknown')) {
      logSecurityEvent('suspicious_user_agent', {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
    }

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);

    // Check for dev tools periodically
    const devToolsInterval = setInterval(checkDevTools, 1000);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
      clearInterval(devToolsInterval);
    };
  }, []);

  // Monitor network requests
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const startTime = Date.now();
      const [resource] = args;

      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - startTime;

        // Log slow or failed requests
        if (response.status >= 400 || duration > 5000) {
          logSecurityEvent('network_request', {
            url: typeof resource === 'string' ? resource : resource.url,
            method: typeof resource === 'string' ? 'GET' : resource.method || 'GET',
            status: response.status,
            duration,
            timestamp: new Date().toISOString()
          });
        }

        return response;
      } catch (error) {
        logSecurityEvent('network_error', {
          url: typeof resource === 'string' ? resource : resource.url,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return <>{children}</>;
};

export default SecurityMonitor;
