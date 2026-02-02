import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, CheckCircle, AlertCircle, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import Card from './ui/Card';
import Modal from './ui/Modal';
import LoadingSpinner from './ui/LoadingSpinner';
import { loginWithPassword } from '../utils/auth';

const Login = (): React.JSX.Element => {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password login state
  const [username, setUsername] = useState<string>('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [password, setPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const navigate = useNavigate();

  const isPasswordFormValid = useMemo(() => 
    username.trim() && !usernameError && password.length >= 6 && !passwordError,
    [username, usernameError, password, passwordError]
  );

  const handlePasswordLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!username.trim() || username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (!password || password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setUsernameError(null);
    setPasswordError(null);
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginWithPassword(username, password);

      if (result.success && result.user) {
        setShowSuccessModal(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
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
          {/* Password Login Form */}
          <form onSubmit={handlePasswordLogin} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username or Email
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
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      usernameError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your username or email"
                    autoComplete="username"
                    required
                  />
                </div>
                {usernameError && (
                  <p className="mt-2 text-red-600 text-sm">{usernameError}</p>
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
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      passwordError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                {passwordError && (
                  <p className="mt-2 text-red-600 text-sm">{passwordError}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || !isPasswordFormValid}
                className="w-full"
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
            </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="text-red-500 mr-3" size={20} />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign up
              </Link>
            </p>
            <p className="text-gray-600">
              <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 text-sm">
                Forgot your password?
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
