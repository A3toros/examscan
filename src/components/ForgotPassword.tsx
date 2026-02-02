import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, Lock, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import Modal from './ui/Modal';
import LoadingSpinner from './ui/LoadingSpinner';
import { sendOTP, verifyOTP, resetPassword } from '../utils/auth';

type ResetStep = 'email' | 'verify' | 'reset';

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<ResetStep>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Step 1: Email
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  // Step 2: OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Step 3: New password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailError(null);
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendOTP(email, 'password_reset');

      if (result.success) {
        setStep('verify');
        setResendTimer(60);
      } else {
        setError(result.error || 'Failed to send reset code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      setOtpError('Please enter a valid 6-digit code');
      return;
    }

    setOtpError(null);
    setIsLoading(true);
    setError(null);

    try {
      // Verify OTP (just check format, actual verification happens in reset step)
      const result = await verifyOTP(email, otpCode, 'password_reset');

      if (result.success) {
        setStep('reset');
      } else {
        setError(result.error || 'Invalid verification code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordError(null);
    setIsLoading(true);
    setError(null);

    try {
      const result = await resetPassword(email, otpCode, newPassword);

      if (result.success) {
        setShowSuccessModal(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(result.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;

    setIsLoading(true);
    try {
      const result = await sendOTP(email, 'password_reset');
      if (result.success) {
        setResendTimer(60);
        setError(null);
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch {
      setError('Failed to resend verification code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 to-white">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md"
      >
        <Card className="p-8">
          <div className="text-center mb-8">
            <Link to="/login" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
              <ArrowLeft size={20} className="mr-2" />
              Back to Login
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Reset Password</h1>
            <p className="text-gray-600">Enter your email to receive a reset code</p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'email' ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'}`}>
                {step !== 'email' ? <CheckCircle size={16} /> : '1'}
              </div>
              <div className={`w-16 h-1 ${step !== 'email' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'verify' ? 'bg-blue-600 text-white' : step === 'reset' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                {step === 'reset' ? <CheckCircle size={16} /> : '2'}
              </div>
              <div className={`w-16 h-1 ${step === 'reset' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'reset' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                3
              </div>
            </div>
          </div>

          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError(null);
                    }}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      emailError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your email"
                    required
                  />
                </div>
                {emailError && (
                  <p className="mt-2 text-red-600 text-sm">{emailError}</p>
                )}
                <p className="mt-2 text-sm text-gray-500">
                  We'll send a reset code to this email
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="primary"
                disabled={isLoading || !email.trim()}
                isLoading={isLoading}
              >
                Send Reset Code
              </Button>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 'verify' && (
            <form onSubmit={handleOTPSubmit} className="space-y-6">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  We sent a 6-digit code to <strong>{email}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtpCode('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Change email
                </button>
              </div>

              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    id="otp"
                    name="otp"
                    value={otpCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(value);
                      setOtpError(null);
                    }}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 ${
                      otpError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                </div>
                {otpError && (
                  <p className="mt-2 text-red-600 text-sm">{otpError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendTimer > 0 || isLoading}
                  variant="outline"
                  className="flex-1"
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  variant="primary"
                  disabled={isLoading || otpCode.length !== 6}
                  isLoading={isLoading}
                >
                  Verify Code
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Reset Password */}
          {step === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-6">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError(null);
                    }}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      passwordError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter new password (min 6 chars)"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError(null);
                    }}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      passwordError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
                {passwordError && (
                  <p className="mt-2 text-red-600 text-sm">{passwordError}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="primary"
                disabled={isLoading || !newPassword || newPassword !== confirmPassword}
                isLoading={isLoading}
              >
                Reset Password
              </Button>
            </form>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="text-red-500 mr-3" size={20} />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Remember your password?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </Card>

        {/* Success Modal */}
        <Modal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          title="Password Reset Successful"
          size="sm"
        >
          <div className="text-center py-6">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Password Reset Complete!</h3>
            <p className="text-gray-600 mb-4">Your password has been reset. Please log in with your new password.</p>
            <LoadingSpinner size="sm" />
          </div>
        </Modal>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
