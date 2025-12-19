import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Database, Camera, Mail } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link to="/" className="flex items-center text-blue-600 hover:text-blue-700 transition-colors">
            <ArrowLeft size={20} className="mr-2" />
            Back to Home
          </Link>
        </div>

        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Privacy Policy</h1>
          </div>
          <p className="text-xl text-gray-600">Last updated: December 2025</p>
        </div>

        <div className="space-y-8">
          {/* Introduction */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              ExamScan ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our exam scanning and grading platform.
            </p>
            <p className="text-gray-700 leading-relaxed">
              By using ExamScan, you agree to the collection and use of information in accordance with this policy.
            </p>
          </Card>

          {/* Information We Collect */}
          <Card className="p-8">
            <div className="flex items-center mb-4">
              <Database className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Information We Collect</h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Information</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Email address (used for account creation and OTP authentication)</li>
                  <li>First name and last name (optional, for personalization)</li>
                  <li>Account creation and last login timestamps</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Exam and Answer Sheet Data</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Exam templates and answer keys you create</li>
                  <li>Scanned answer sheet images (processed and then deleted)</li>
                  <li>Grading results and analytics data</li>
                  <li>Exam metadata (creation dates, question counts, etc.)</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Camera className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Camera Access</h3>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  ExamScan requires camera access to scan answer sheets. Images are processed locally on your device
                  and only the grading results are sent to our servers. Raw images are never stored on our servers.
                </p>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Eye className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Technical Information</h3>
                </div>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>IP address and geolocation data (for security monitoring)</li>
                  <li>Browser type and version</li>
                  <li>Device information</li>
                  <li>Usage analytics and error logs</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* How We Use Your Information */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">How We Use Your Information</h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700"><strong>Provide Services:</strong> Process exams, generate answer sheets, perform grading, and deliver results</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700"><strong>Account Management:</strong> Create and manage your account, send authentication codes</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700"><strong>Security:</strong> Monitor for suspicious activity and prevent unauthorized access</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700"><strong>Improvement:</strong> Analyze usage patterns to improve our service</p>
              </div>
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <p className="text-gray-700"><strong>Legal Compliance:</strong> Comply with applicable laws and regulations</p>
              </div>
            </div>
          </Card>

          {/* Data Storage and Security */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Storage and Security</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>Server Location:</strong> All data is stored on secure cloud servers with industry-standard encryption.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Data Retention:</strong> Account data is retained as long as your account is active. Exam data may be retained
                for up to 2 years for educational and legal purposes.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Image Processing:</strong> Scanned images are processed locally on your device when possible, and raw images
                are automatically deleted from our servers after processing (typically within minutes).
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Security Measures:</strong> We use SSL/TLS encryption, secure authentication, and regular security audits
                to protect your data.
              </p>
            </div>
          </Card>

          {/* Third-Party Services */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Third-Party Services</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Service (Resend)</h3>
                <p className="text-gray-700 leading-relaxed">
                  We use Resend to send authentication emails. They may collect technical information about email delivery
                  but do not have access to your account data.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Cloud Database (Neon)</h3>
                <p className="text-gray-700 leading-relaxed">
                  We use Neon for database hosting. Your data is encrypted at rest and in transit.
                </p>
              </div>
            </div>
          </Card>

          {/* Your Rights */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Rights</h2>
            <div className="space-y-3">
              <p className="text-gray-700"><strong>Access:</strong> Request a copy of your personal data</p>
              <p className="text-gray-700"><strong>Correction:</strong> Update inaccurate information</p>
              <p className="text-gray-700"><strong>Deletion:</strong> Request deletion of your account and data</p>
              <p className="text-gray-700"><strong>Portability:</strong> Export your exam data</p>
              <p className="text-gray-700"><strong>Opt-out:</strong> Unsubscribe from communications</p>
            </div>
            <p className="text-gray-700 mt-4">
              To exercise these rights, contact us at privacy@examscan.app
            </p>
          </Card>

          {/* Cookies */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Cookies and Local Storage</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              ExamScan uses minimal cookies and local storage:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              <li><strong>Authentication:</strong> Secure HTTP-only cookies for session management</li>
              <li><strong>Preferences:</strong> Local storage for UI preferences and consent status</li>
              <li><strong>Analytics:</strong> Usage analytics (optional, with your consent)</li>
            </ul>
          </Card>

          {/* Contact */}
          <Card className="p-8">
            <div className="flex items-center mb-4">
              <Mail className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Contact Us</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700"><strong>Email:</strong> privacy@examscan.app</p>
              <p className="text-gray-700"><strong>Response Time:</strong> Within 48 hours</p>
            </div>
          </Card>

          {/* Updates */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Policy Updates</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of significant changes via email
              or through our platform. Continued use of ExamScan after changes constitutes acceptance of the updated policy.
            </p>
          </Card>
        </div>

        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <Link to="/" className="inline-block">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              Return to ExamScan
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
