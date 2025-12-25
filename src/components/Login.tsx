import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, CheckCircle, AlertCircle, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import Card from './ui/Card';
import Modal from './ui/Modal';
import LoadingSpinner from './ui/LoadingSpinner';
import { validateEmail, sanitizeInput } from '../utils/security';
import { setAuthCookies } from '../utils/auth';

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
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple form state management with XSS protection
  const [username, setUsername] = useState<string>('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [password, setPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Computed values for cleaner JSX
  const isUsernameValid = useMemo(() => username.trim() && !usernameError, [username, usernameError]);
  const isPasswordValid = useMemo(() => password.length >= 6 && !passwordError, [password, passwordError]);
  const usernameInputClassName = useMemo(() => `w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
    usernameError ? 'border-red-500' : 'border-gray-300'
  }`, [usernameError]);
  const passwordInputClassName = useMemo(() => `w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
    passwordError ? 'border-red-500' : 'border-gray-300'
  }`, [passwordError]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    // Validate username
    const sanitizedUsername = sanitizeInput(username);
    if (!sanitizedUsername || sanitizedUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    // Validate password
    const sanitizedPassword = sanitizeInput(password);
    if (!sanitizedPassword || sanitizedPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setUsernameError(null);
    setPasswordError(null);
    setIsLoading(true);
    setError(null);

    try {
      // Login with username and password
      const response = await fetch('/.netlify/functions/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: sanitizedUsername,
          password: sanitizedPassword
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
              <div>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setUsernameError(null);
                      }}
                      className={usernameInputClassName}
                      placeholder="Enter your username"
                      autoComplete="username"
                      required
                      {...(usernameError ? { 'aria-describedby': 'username-error' } : {})}
                    />
                  </div>
                  {usernameError && (
                    <div id="username-error" className="mt-2" role="alert" aria-live="polite">
                      <p className="text-red-600 text-sm">{usernameError}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError(null);
                      }}
                      className={passwordInputClassName}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      {...(passwordError ? { 'aria-describedby': 'password-error' } : {})}
                    />
                  </div>
                  {passwordError && (
                    <div id="password-error" className="mt-2" role="alert" aria-live="polite">
                      <p className="text-red-600 text-sm">{passwordError}</p>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !isUsernameValid || !isPasswordValid}
                  className="w-full"
                  aria-label="Sign in with username and password"
                  variant="primary"
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Signing In...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="ml-2" size={20} />
                    </>
                  )}
                </Button>
              </div>

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
