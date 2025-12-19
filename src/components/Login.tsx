import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import Card from './ui/Card';
import Modal from './ui/Modal';
import LoadingSpinner from './ui/LoadingSpinner';
import { validateEmail, sanitizeInput } from '../utils/security';
import { setAuthCookies } from '../utils/auth';

interface OtpResponse {
  success: boolean;
  error?: string;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  error?: string;
}

const Login = (): React.JSX.Element => {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple form state management with XSS protection
  const [email, setEmail] = useState<string>('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otp, setOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Computed values for cleaner JSX
  const isEmailValid = useMemo(() => email.trim() && !emailError, [email, emailError]);
  const isOtpValid = useMemo(() => otp.length === 6 && !otpError, [otp, otpError]);
  const emailInputClassName = useMemo(() => `w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
    emailError ? 'border-red-500' : 'border-gray-300'
  }`, [emailError]);
  const otpInputClassName = useMemo(() => `w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-2xl font-mono tracking-widest ${
    otpError ? 'border-red-500' : 'border-gray-300'
  }`, [otpError]);

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    // Validate email with XSS protection
    const sanitizedEmail = sanitizeInput(email);
    const emailValidation = validateEmail(sanitizedEmail);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.errors[0]);
      return;
    }

    setEmailError(null);
    setIsLoading(true);
    setError(null);

    try {
      // Send OTP for login
      const response = await fetch('/functions/send-otp.ts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sanitizedEmail,
          type: 'login_2fa'
        })
      });

      const data: OtpResponse = await response.json();

      if (data.success) {
        setStep('otp');
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    // Validate OTP
    const sanitizedOtp = sanitizeInput(otp);
    if (!sanitizedOtp || sanitizedOtp.length !== 6) {
      setOtpError('Please enter a valid 6-digit code');
      return;
    }

    setOtpError(null);
    setIsLoading(true);
    setError(null);

    try {
      // Login with OTP
      const response = await fetch('/functions/login.ts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sanitizeInput(email),
          otp: sanitizedOtp
        })
      });

      const data: LoginResponse = await response.json();

      if (data.success && data.token && data.user) {
        // Store authentication data in secure cookies
        setAuthCookies({
          token: data.token,
          user: data.user
        });

        setShowSuccessModal(true);

        // Redirect after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = (): void => {
    setStep('email');
    setError(null);
    setOtp('');
    setOtpError(null);
  };

  const handleSubmit = step === 'email' ? handleEmailSubmit : handleOtpSubmit;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to ExamScan</p>
        </header>

        <Card className="shadow-lg">
          <form
            id="login-form"
            name="login-form"
            onSubmit={handleSubmit}
            method="post"
            className="space-y-6"
            noValidate
            role="form"
            autoComplete="on"
          >
            <fieldset className="space-y-6">
            {step === 'email' ? (
              <div key="email-step">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError(null);
                      }}
                      className={emailInputClassName}
                      placeholder="Enter your email"
                      autoComplete="email"
                      required
                      {...(emailError ? { 'aria-describedby': 'email-error' } : {})}
                    />
                  </div>
                  {emailError && (
                    <div id="email-error" className="mt-2" role="alert" aria-live="polite">
                      <p className="text-red-600 text-sm">{emailError}</p>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !isEmailValid}
                  className="w-full"
                  aria-label="Send login code to email"
                  variant="primary"
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Send Login Code
                      <ArrowRight className="ml-2" size={20} />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div key="otp-step">
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="text-blue-600" size={24} />
                  </div>
                  <p className="text-gray-600 mb-2">
                    We sent a 6-digit code to
                  </p>
                  <p className="font-semibold text-gray-800">{email}</p>
                </div>

                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Login Code
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      id="otp"
                      name="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => {
                        // Only allow numbers and limit to 6 digits
                        const numericValue = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtp(numericValue);
                        setOtpError(null);
                      }}
                      className={otpInputClassName}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      {...(otpError ? { 'aria-describedby': 'otp-error' } : {})}
                    />
                  </div>
                  {otpError && (
                    <div id="otp-error" className="mt-2" role="alert" aria-live="polite">
                      <p className="text-red-600 text-sm">{otpError}</p>
                    </div>
                  )}
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleBackToEmail()}
                    className="flex-1"
                    aria-label="Go back to email input"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !isOtpValid}
                    className="flex-1"
                    aria-label="Verify and sign in with login code"
                    variant="primary"
                  >
                    {isLoading ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Signing In...
                      </>
                    ) : (
                      <>Sign In</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="text-red-500 mr-3" size={20} />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}
            </fieldset>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </Card>

        {/* Success Modal */}
        <Modal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          title="Login Successful"
          size="sm"
        >
          <div className="text-center py-6">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Welcome back!</h3>
            <p className="text-gray-600 mb-4">Login successful. Redirecting to dashboard...</p>
            <LoadingSpinner size="sm" />
          </div>
        </Modal>
      </motion.div>
    </div>
  );
};

Login.displayName = 'Login';

export default Login;
