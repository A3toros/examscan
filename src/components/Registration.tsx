import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, ArrowLeft, CheckCircle, KeyRound, AlertCircle } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import Modal from './ui/Modal';
import LoadingSpinner from './ui/LoadingSpinner';
import { sendOTP, verifyOTP, type User as UserType } from '../utils/auth';

type RegistrationStep = 'email' | 'verify' | 'details';

const Registration: React.FC = () => {
  const [step, setStep] = useState<RegistrationStep>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  // Step 1: Email
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  // Step 2: OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Step 3: User details
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
      const result = await sendOTP(email, 'signup');

      if (result.success) {
        setStep('verify');
        setResendTimer(60);
      } else {
        setError(result.error || 'Failed to send verification code');
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
      // Verify OTP with backend (without userData - just verify the code)
      const result = await verifyOTP(email, otpCode, 'signup');
      
      if (result.success) {
        // OTP is valid, proceed to details form
        setStep('details');
      } else {
        // OTP is invalid
        setOtpError(result.error || 'Invalid verification code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!formData.username.trim() || formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    if (!formData.password || formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsLoading(true);
    setError(null);

    try {
      const result = await verifyOTP(
        email,
        otpCode,
        'signup',
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          password: formData.password
        }
      );

      if (result.success && result.user) {
        // Registration successful, redirect to dashboard
        navigate('/dashboard');
      } else {
        setError(result.error || 'Registration failed');
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
      const result = await sendOTP(email, 'signup');
      if (result.success) {
        setResendTimer(60);
        setError(null);
      } else {
        setError(result.error || 'Failed to resend OTP');
      }
    } catch {
      setError('Failed to resend verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
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
            <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
              <ArrowLeft size={20} className="mr-2" />
              Back to Home
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Join ExamScan</h1>
            <p className="text-gray-600">Create your teacher account</p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'email' ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'}`}>
                {step !== 'email' ? <CheckCircle size={16} /> : '1'}
              </div>
              <div className={`w-16 h-1 ${step !== 'email' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'verify' ? 'bg-blue-600 text-white' : step === 'details' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                {step === 'details' ? <CheckCircle size={16} /> : '2'}
              </div>
              <div className={`w-16 h-1 ${step === 'details' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'details' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
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
                  We'll send a verification code to this email
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="primary"
                disabled={isLoading || !email.trim()}
                isLoading={isLoading}
              >
                Send Verification Code
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

          {/* Step 3: User Details */}
          {step === 'details' && (
            <form onSubmit={handleDetailsSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        formErrors.firstName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="First name"
                      required
                    />
                  </div>
                  {formErrors.firstName && (
                    <p className="mt-1 text-red-600 text-xs">{formErrors.firstName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        formErrors.lastName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Last name"
                      required
                    />
                  </div>
                  {formErrors.lastName && (
                    <p className="mt-1 text-red-600 text-xs">{formErrors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formErrors.username ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Choose a username"
                    required
                  />
                </div>
                {formErrors.username && (
                  <p className="mt-1 text-red-600 text-xs">{formErrors.username}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formErrors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Create a password (min 6 chars)"
                    required
                  />
                </div>
                {formErrors.password && (
                  <p className="mt-1 text-red-600 text-xs">{formErrors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Confirm your password"
                    required
                  />
                </div>
                {formErrors.confirmPassword && (
                  <p className="mt-1 text-red-600 text-xs">{formErrors.confirmPassword}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="primary"
                disabled={isLoading}
                isLoading={isLoading}
              >
                Create Account
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
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Registration;
