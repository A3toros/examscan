import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FileText, Camera, BarChart3, Users, CheckCircle, ArrowRight, X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import { logSecurityEvent } from '../utils/security';
import CookieConsent from './CookieConsent';

const LandingPage: React.FC = () => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Showcase images/data for the lightbox carousel
  const showcaseItems = [
    {
      id: 1,
      title: "Create Answer Sheets",
      description: "Design professional multiple-choice and true/false answer sheets with customizable layouts and branding.",
      image: "/api/placeholder/600/400", // Placeholder - replace with actual screenshots
      features: ["Multiple choice questions", "True/false questions", "Custom branding", "PDF export"]
    },
    {
      id: 2,
      title: "Mobile Scanning",
      description: "Use your smartphone camera to scan completed answer sheets with advanced computer vision technology.",
      image: "/api/placeholder/600/400",
      features: ["Mobile camera support", "Real-time processing", "iPhone compatible", "No special equipment"]
    },
    {
      id: 3,
      title: "Instant Grading",
      description: "Get immediate scoring results with detailed analytics and performance insights for each student.",
      image: "/api/placeholder/600/400",
      features: ["Real-time grading", "Detailed analytics", "Performance reports", "Instant feedback"]
    },
    {
      id: 4,
      title: "Exam Management",
      description: "Manage multiple exams, track student progress, and generate comprehensive assessment reports.",
      image: "/api/placeholder/600/400",
      features: ["Multi-exam support", "Student tracking", "Progress reports", "Data export"]
    },
    {
      id: 5,
      title: "Security & Privacy",
      description: "Enterprise-grade security with end-to-end encryption and GDPR compliance for educational data.",
      image: "/api/placeholder/600/400",
      features: ["End-to-end encryption", "GDPR compliant", "Secure cloud storage", "Data privacy"]
    }
  ];

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % showcaseItems.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + showcaseItems.length) % showcaseItems.length);
  };

  // Log page visit for security monitoring
  useEffect(() => {
    logSecurityEvent('page_visit', {
      page: 'landing',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  }, []);

  const features = [
    {
      icon: FileText,
      title: 'Generate Answer Sheets',
      description: 'Create professional PDF and Word answer sheets with multiple choice and true/false questions.'
    },
    {
      icon: Camera,
      title: 'Computer Vision Scanning',
      description: 'Use your device camera to scan completed answer sheets with advanced computer vision and OCR technology.'
    },
    {
      icon: BarChart3,
      title: 'Instant Grading',
      description: 'Get immediate scoring and detailed analysis of student performance with automated answer sheet processing.'
    },
    {
      icon: Users,
      title: 'Exam Management',
      description: 'Create exams, manage answer keys, and track student progress with comprehensive analytics.'
    }
  ];

  const benefits = [
    'Completely free - no hidden costs',
    'Works on mobile and desktop',
    'iPhone camera support',
    'No software installation required',
    'Secure cloud storage',
    'Real-time processing',
    'Detailed analytics'
  ];


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-200/50 shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex justify-between items-center py-4"
          >
            <motion.div
              className="flex items-center"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <Link to="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors duration-300">
                Exam<span className="text-blue-600">Scan</span>
              </Link>
            </motion.div>

            <nav className="hidden md:flex space-x-8">
              <motion.a
                href="#features"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200 relative group"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
              </motion.a>
              <motion.a
                href="#benefits"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200 relative group"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                Benefits
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
              </motion.a>
              <motion.a
                href="/privacy"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200 relative group"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                Privacy
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
              </motion.a>
              <motion.a
                href="/terms"
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200 relative group"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                Terms
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
              </motion.a>
            </nav>

            <motion.div
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link to="/login">
                  <Button
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 hover:border-blue-700 transition-all duration-300"
                  >
                    Sign In
                  </Button>
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link to="/register">
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
                    Get Started
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 bg-gradient-to-br from-blue-50 via-white to-blue-50 overflow-hidden">
        {/* Animated background elements */}
        <motion.div
          className="absolute top-20 left-10 w-20 h-20 bg-blue-200 rounded-full opacity-30"
          animate={{
            y: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-40 right-16 w-16 h-16 bg-blue-300 rounded-full opacity-20"
          animate={{
            y: [0, 25, 0],
            scale: [1, 0.9, 1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />

        <div className="max-w-4xl mx-auto text-center relative z-10 px-4">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.div
              className="bg-white/90 backdrop-blur-lg rounded-3xl p-8 md:p-12 shadow-2xl border border-white/30"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
            >
              <motion.h1
                className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <motion.span
                  className="block"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  Exam
                </motion.span>
                <motion.span
                  className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 bg-clip-text text-transparent"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                  Scan
                </motion.span>
              </motion.h1>

              <motion.p
                className="text-xl md:text-2xl text-gray-700 mb-10 max-w-4xl mx-auto leading-relaxed font-medium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1 }}
              >
                Transform traditional exams with computer vision technology for intelligent scanning and instant grading.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-6 justify-center items-center"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.2 }}
              >
                <motion.div
                  whileHover={{
                    scale: 1.05,
                    boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)"
                  }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link to="/register">
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 hover:from-blue-700 hover:via-blue-800 hover:to-blue-900 text-white px-10 py-4 text-lg font-bold shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 transform hover:-translate-y-1 rounded-full relative overflow-hidden group"
                    >
                      <span className="relative z-10 flex items-center">
                        Try For Free
                        <motion.div
                          className="ml-2"
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <ArrowRight className="w-5 h-5" />
                        </motion.div>
                      </span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "100%" }}
                        transition={{ duration: 0.6 }}
                      />
                    </Button>
                  </Link>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link to="/dashboard">
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-10 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-full"
                    >
                      Try Demo
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>

              {/* Trust indicators */}
              <motion.div
                className="mt-12 pt-8 border-t border-gray-200"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.5 }}
              >
                <p className="text-sm text-gray-500 mb-4">Trusted by educators worldwide</p>
                <div className="flex justify-center items-center space-x-8 opacity-60">
                  <motion.div
                    className="text-2xl font-bold text-gray-400"
                    whileHover={{ scale: 1.1, color: "#3B82F6" }}
                    transition={{ duration: 0.2 }}
                  >
                    10K+
                  </motion.div>
                  <motion.div
                    className="text-sm text-gray-500"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    Teachers
                  </motion.div>
                  <motion.div
                    className="w-2 h-2 bg-gray-300 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.div
                    className="text-2xl font-bold text-gray-400"
                    whileHover={{ scale: 1.1, color: "#3B82F6" }}
                    transition={{ duration: 0.2 }}
                  >
                    50K+
                  </motion.div>
                  <motion.div
                    className="text-sm text-gray-500"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    Exams Scanned
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <motion.div
              className="bg-white/70 backdrop-blur-lg rounded-2xl p-8 md:p-12 shadow-xl border border-white/40"
              initial={{ scale: 0.95, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <motion.h2
                className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Powerful Features for
                <motion.span
                  className="block text-blue-600"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  Modern Education
                </motion.span>
              </motion.h2>
              <motion.p
                className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
              >
                Streamline your assessment process with cutting-edge technology designed for teachers.
              </motion.p>
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 50, rotateY: -15 }}
                  whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: index * 0.15,
                    type: "spring",
                    stiffness: 100
                  }}
                  whileHover={{
                    y: -10,
                    transition: { duration: 0.3 }
                  }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full text-center p-8 hover:shadow-2xl transition-all duration-500 border-0 shadow-lg bg-white/80 backdrop-blur-sm group">
                    <motion.div
                      className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300"
                      whileHover={{
                        scale: 1.1,
                        rotate: 5,
                        background: "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)"
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.2, rotate: -5 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Icon size={40} className="text-blue-600" />
                      </motion.div>
                    </motion.div>
                    <motion.h3
                      className="text-2xl font-bold text-gray-900 mb-4 leading-tight group-hover:text-blue-600 transition-colors duration-300"
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      transition={{ duration: 0.6, delay: index * 0.15 + 0.3 }}
                    >
                      {feature.title}
                    </motion.h3>
                    <motion.p
                      className="text-gray-600 text-lg leading-relaxed"
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      transition={{ duration: 0.6, delay: index * 0.15 + 0.5 }}
                    >
                      {feature.description}
                    </motion.p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-24 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
        {/* Animated background elements */}
        <motion.div
          className="absolute top-20 right-20 w-32 h-32 bg-purple-200 rounded-full opacity-20"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute bottom-20 left-20 w-24 h-24 bg-indigo-200 rounded-full opacity-25"
          animate={{
            y: [0, -30, 0],
            x: [0, 20, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <motion.div
              className="bg-white/80 backdrop-blur-lg rounded-2xl p-8 md:p-12 shadow-xl border border-white/50"
              initial={{ scale: 0.95, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <motion.h2
                className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Why Choose
                <motion.span
                  className="block text-blue-600"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  ExamScan?
                </motion.span>
              </motion.h2>
              <motion.p
                className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
              >
                Join thousands of educators who have transformed their assessment workflow.
              </motion.p>
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50, rotateY: index % 2 === 0 ? -15 : 15 }}
                whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
                transition={{
                  duration: 0.8,
                  delay: index * 0.15,
                  type: "spring",
                  stiffness: 100
                }}
                whileHover={{
                  scale: 1.03,
                  transition: { duration: 0.3 }
                }}
                viewport={{ once: true }}
                className="flex items-start space-x-4 p-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 border border-white/50 group"
              >
                <motion.div
                  className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg group-hover:shadow-xl transition-all duration-300"
                  whileHover={{
                    scale: 1.1,
                    rotate: 10,
                    background: "linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)"
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <CheckCircle className="text-green-600" size={24} />
                  </motion.div>
                </motion.div>
                <motion.span
                  className="text-gray-800 text-lg md:text-xl font-medium leading-relaxed group-hover:text-blue-600 transition-colors duration-300"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: index * 0.15 + 0.3 }}
                >
                  {benefit}
                </motion.span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className="py-24 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 relative overflow-hidden">
        {/* Animated background elements */}
        <motion.div
          className="absolute top-40 left-10 w-40 h-40 bg-gradient-to-br from-blue-200 to-indigo-200 rounded-full opacity-20 blur-xl"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, 360],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute bottom-40 right-20 w-32 h-32 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full opacity-25 blur-xl"
          animate={{
            y: [0, -40, 0],
            x: [0, -30, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <motion.div
              className="bg-white/70 backdrop-blur-lg rounded-2xl p-8 md:p-12 shadow-xl border border-white/40"
              initial={{ scale: 0.95, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <motion.h2
                className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                See ExamScan in
                <motion.span
                  className="block text-blue-600"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  Action
                </motion.span>
              </motion.h2>
              <motion.p
                className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
              >
                Explore our platform's powerful features through our interactive carousel - drag to navigate or click any card for detailed demos.
              </motion.p>
            </motion.div>
          </motion.div>

          {/* Carousel Container */}
          <div className="relative overflow-hidden">
            <motion.div
              className="flex gap-8 pb-8"
              drag="x"
              dragConstraints={{ left: -((showcaseItems.length - 1) * 400), right: 0 }}
              dragElastic={0.1}
              dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
            >
              {showcaseItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 60 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: index * 0.15,
                  }}
                  viewport={{ once: true }}
                  className="flex-shrink-0 w-96 group cursor-pointer"
                  onClick={() => openLightbox(index)}
                >
                  <Card className="overflow-hidden hover:shadow-2xl transition-all duration-500 border-0 shadow-xl bg-white/90 backdrop-blur-sm group-hover:scale-105 transform-gpu h-full">
                    <div className="relative">
                      <div className="aspect-video bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex items-center justify-center relative overflow-hidden">
                        {/* Animated background pattern */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-br from-blue-200/50 to-purple-200/50"
                          animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 180, 360],
                          }}
                          transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "linear"
                          }}
                        />

                        <div className="text-center relative z-10">
                          <motion.div
                            className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-2xl transition-all duration-300"
                            whileHover={{
                              scale: 1.1,
                              rotate: 10,
                              boxShadow: "0 20px 40px rgba(59, 130, 246, 0.4)"
                            }}
                            transition={{ duration: 0.3 }}
                          >
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <Play size={28} className="text-white ml-1" />
                            </motion.div>
                          </motion.div>
                          <motion.p
                            className="text-blue-600 font-semibold group-hover:text-blue-700 transition-colors duration-300"
                            whileHover={{ scale: 1.05 }}
                          >
                            Click to View Demo
                          </motion.p>
                        </div>
                      </div>

                      {/* Hover overlay */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                      >
                        <motion.div
                          whileHover={{ scale: 1.2 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Play size={56} className="text-white drop-shadow-lg" />
                        </motion.div>
                      </motion.div>
                    </div>

                    <div className="p-8">
                      <motion.h3
                        className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors duration-300"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: index * 0.15 + 0.3 }}
                      >
                        {item.title}
                      </motion.h3>
                      <motion.p
                        className="text-gray-600 mb-6 leading-relaxed text-lg"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: index * 0.15 + 0.5 }}
                      >
                        {item.description}
                      </motion.p>
                      <div className="flex flex-wrap gap-3">
                        {item.features.slice(0, 2).map((feature, idx) => (
                          <motion.span
                            key={idx}
                            className="px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 text-sm font-medium rounded-full border border-blue-200/50"
                            whileHover={{
                              scale: 1.05,
                              background: "linear-gradient(90deg, #DBEAFE 0%, #E0E7FF 100%)"
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            {feature}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            {/* Scroll indicator */}
            <div className="flex justify-center mt-6">
              <div className="flex space-x-2">
                {showcaseItems.map((_, index) => (
                  <motion.div
                    key={index}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      index === Math.floor(currentImageIndex) ? 'bg-blue-600 scale-125' : 'bg-blue-200'
                    }`}
                    whileHover={{ scale: 1.2 }}
                  />
                ))}
              </div>
            </div>
          </div>

          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <motion.p
              className="text-gray-500 mb-8 text-lg"
              whileHover={{ scale: 1.02 }}
            >
              Drag the carousel or click any card above to explore ExamScan's features in detail
            </motion.p>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Link to="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 hover:from-blue-700 hover:via-blue-800 hover:to-blue-900 text-white px-12 py-5 text-xl font-bold shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 transform hover:-translate-y-2 rounded-full relative overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center">
                    Start Your Free Trial
                    <motion.div
                      className="ml-3"
                      animate={{ x: [0, 8, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <ArrowRight className="w-6 h-6" />
                    </motion.div>
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0"
                    initial={{ x: "-150%" }}
                    whileHover={{ x: "150%" }}
                    transition={{ duration: 0.8 }}
                  />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-gradient-to-br from-blue-600 via-blue-700 via-blue-800 to-indigo-900 relative overflow-hidden">
        {/* Animated background elements */}
        <motion.div
          className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-48 h-48 bg-blue-300/20 rounded-full blur-2xl"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-3xl"
          animate={{
            scale: [0.8, 1.2, 0.8],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/30 rounded-full"
            style={{
              top: `${20 + i * 15}%`,
              left: `${10 + i * 15}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.div
              className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-16 shadow-2xl border border-white/20"
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
            >
              <motion.h2
                className="text-5xl md:text-7xl font-bold text-white mb-8 leading-tight"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                Ready to Transform Your
                <motion.span
                  className="block text-blue-200"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  Assessments?
                </motion.span>
              </motion.h2>

              <motion.p
                className="text-xl md:text-2xl text-blue-100 mb-12 max-w-4xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                Join thousands of educators worldwide and experience the future of educational assessment technology.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1 }}
                className="flex flex-col sm:flex-row gap-6 justify-center items-center"
              >
                <motion.div
                  whileHover={{
                    scale: 1.1,
                    boxShadow: "0 25px 50px rgba(255, 255, 255, 0.3)"
                  }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link to="/register">
                    <Button
                      size="lg"
                      className="bg-white text-blue-600 hover:bg-blue-50 px-12 py-6 text-xl font-bold shadow-2xl hover:shadow-white/50 transition-all duration-300 transform hover:-translate-y-2 rounded-full relative overflow-hidden group"
                    >
                      <span className="relative z-10 flex items-center">
                        🚀 Start Your Free Trial
                        <motion.div
                          className="ml-3"
                          animate={{ x: [0, 10, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <ArrowRight className="w-6 h-6" />
                        </motion.div>
                      </span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-white/30 to-blue-400/20"
                        initial={{ x: "-150%" }}
                        whileHover={{ x: "150%" }}
                        transition={{ duration: 0.8 }}
                      />
                    </Button>
                  </Link>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link to="/login">
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-2 border-white/50 text-white hover:bg-white/10 hover:border-white px-12 py-6 text-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-full backdrop-blur-sm"
                    >
                      Sign In
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>

              {/* Social proof */}
              <motion.div
                className="mt-16 pt-8 border-t border-white/20"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.2 }}
              >
                <motion.p
                  className="text-blue-200 mb-6 text-lg"
                  whileHover={{ scale: 1.02 }}
                >
                  Join 10,000+ educators already using ExamScan
                </motion.p>
                <div className="flex justify-center items-center space-x-8 opacity-80">
                  <motion.div
                    className="flex -space-x-2"
                    whileHover={{ scale: 1.05 }}
                  >
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-10 h-10 bg-gradient-to-br from-blue-300 to-purple-300 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-sm"
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        transition={{ duration: 0.5, delay: 1.4 + i * 0.1 }}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                      >
                        {String.fromCharCode(65 + i)}
                      </motion.div>
                    ))}
                  </motion.div>
                  <motion.div
                    className="text-white/80 text-sm"
                    whileHover={{ scale: 1.05 }}
                  >
                    ⭐⭐⭐⭐⭐ 4.9/5 rating
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
            onClick={closeLightbox}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={closeLightbox}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors z-10"
              >
                <X size={32} />
              </button>

              {/* Main image/content */}
              <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
                <div className="aspect-video bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center relative">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Play size={36} className="text-white ml-2" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {showcaseItems[currentImageIndex].title}
                    </h3>
                    <p className="text-gray-600 max-w-md mx-auto px-4">
                      Interactive demo would show here with actual screenshots and functionality.
                    </p>
                  </div>

                  {/* Navigation arrows */}
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full flex items-center justify-center transition-all duration-200"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full flex items-center justify-center transition-all duration-200"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-4">Key Features</h4>
                      <ul className="space-y-3">
                        {showcaseItems[currentImageIndex].features.map((feature, idx) => (
                          <li key={idx} className="flex items-center">
                            <CheckCircle className="text-green-500 mr-3 flex-shrink-0" size={20} />
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-4">About This Feature</h4>
                      <p className="text-gray-600 leading-relaxed mb-6">
                        {showcaseItems[currentImageIndex].description}
                      </p>
                      <Link to="/register">
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                          Try This Feature
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thumbnails */}
              <div className="flex justify-center mt-6 space-x-2">
                {showcaseItems.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-200 ${
                      index === currentImageIndex
                        ? 'bg-white scale-125'
                        : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center mb-4">
                <h3 className="text-2xl font-bold">Exam<span className="text-blue-400">Scan</span></h3>
              </div>
              <p className="text-gray-400 mb-4 leading-relaxed">
                Transform traditional exams with AI-powered scanning and instant grading.
                Free, secure, and designed for modern education.
              </p>
              <p className="text-sm text-gray-500">
                © 2025 ExamScan. Free and open source educational technology.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><Link to="/generate" className="text-gray-400 hover:text-white transition-colors">Generate Sheets</Link></li>
                <li><Link to="/scan" className="text-gray-400 hover:text-white transition-colors">Scan Exams</Link></li>
                <li><Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-gray-400 hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            <p>
              ExamScan does not collect personal data beyond what's necessary for service functionality.
              Your privacy and data security are our top priorities.
            </p>
          </div>
        </div>
      </footer>

      {/* Cookie Consent Banner */}
      <CookieConsent />

    </div>
  );
};

export default LandingPage;
