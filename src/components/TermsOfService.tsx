import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, AlertTriangle, Scale, Users, Shield } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';

const TermsOfService: React.FC = () => {
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
            <FileText className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Terms of Service</h1>
          </div>
          <p className="text-xl text-gray-600">Last updated: December 2025</p>
        </div>

        <div className="space-y-8">
          {/* Acceptance */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              By accessing and using ExamScan ("the Service"), you accept and agree to be bound by the terms and
              provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
              <p className="text-blue-800 text-sm">
                <strong>Important:</strong> This service is provided "as is" and is intended for educational use only.
                Always verify grading results manually for critical assessments.
              </p>
            </div>
          </Card>

          {/* Service Description */}
          <Card className="p-8">
            <div className="flex items-center mb-4">
              <Users className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Service Description</h2>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                ExamScan is an educational technology platform that provides:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                <li>Digital answer sheet generation (PDF and Word formats)</li>
                <li>Mobile camera-based answer sheet scanning</li>
                <li>Automated grading using computer vision and OCR</li>
                <li>Exam management and analytics</li>
                <li>Secure cloud storage for educational data</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                <strong>Free Service:</strong> ExamScan is provided completely free of charge. We do not charge
                for any features or usage limits.
              </p>
            </div>
          </Card>

          {/* User Responsibilities */}
          <Card className="p-8">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">User Responsibilities</h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Security</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Maintain the confidentiality of your account credentials</li>
                  <li>Notify us immediately of any unauthorized use</li>
                  <li>Use strong, unique passwords</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceptable Use</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Use the service for legitimate educational purposes only</li>
                  <li>Do not attempt to reverse engineer or hack the service</li>
                  <li>Do not upload inappropriate or illegal content</li>
                  <li>Respect intellectual property rights</li>
                  <li>Do not use the service to cheat on examinations</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Camera and Device Access</h3>
                <p className="text-gray-700 leading-relaxed">
                  The service requires camera access for scanning. You are responsible for:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                  <li>Granting necessary permissions when prompted</li>
                  <li>Ensuring your device meets minimum requirements</li>
                  <li>Using the camera in well-lit conditions for accurate scanning</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Service Limitations */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Service Limitations & Disclaimers</h2>

            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Accuracy Limitations</h3>
                <p className="text-yellow-700">
                  While we strive for high accuracy, computer vision and OCR technology is not 100% perfect.
                  <strong> Always manually verify grading results for important assessments.</strong>
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Technical Limitations</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Requires modern browsers with camera support (Chrome, Safari, Firefox)</li>
                  <li>May not work properly in poor lighting conditions</li>
                  <li>Answer sheets must be clearly printed and properly aligned</li>
                  <li>Complex handwriting may reduce recognition accuracy</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Service Availability</h3>
                <p className="text-gray-700 leading-relaxed">
                  We strive for high availability but cannot guarantee uninterrupted service.
                  The service may be temporarily unavailable for maintenance, updates, or unforeseen issues.
                </p>
              </div>
            </div>
          </Card>

          {/* Data and Privacy */}
          <Card className="p-8">
            <div className="flex items-center mb-4">
              <Shield className="w-6 h-6 text-green-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Data Handling</h2>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Your privacy is important to us. Please review our <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> for details about:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                <li>What information we collect</li>
                <li>How we use and protect your data</li>
                <li>Your rights regarding your data</li>
                <li>Camera access and image processing</li>
              </ul>
            </div>
          </Card>

          {/* Intellectual Property */}
          <Card className="p-8">
            <div className="flex items-center mb-4">
              <Scale className="w-6 h-6 text-purple-600 mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Intellectual Property</h2>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>Our Rights:</strong> The ExamScan service, including all software, algorithms, user interfaces,
                and content, is protected by copyright and other intellectual property laws.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Your Rights:</strong> You retain ownership of the exams and answer sheets you create.
                You grant us a limited license to process and store this content for service provision.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Usage Restrictions:</strong> You may not copy, modify, or distribute our service or technology
                without explicit written permission.
              </p>
            </div>
          </Card>

          {/* Termination */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Account Termination</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>Your Rights:</strong> You may delete your account at any time through the dashboard settings.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Our Rights:</strong> We reserve the right to suspend or terminate accounts that violate these terms,
                engage in abusive behavior, or appear to be compromised.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Data Retention:</strong> Upon account deletion, your personal data will be removed within 30 days,
                though some anonymized usage data may be retained for service improvement.
              </p>
            </div>
          </Card>

          {/* Liability Limitations */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Limitation of Liability</h2>
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
                <p className="text-red-800 font-semibold mb-2">Important Disclaimer</p>
                <p className="text-red-700">
                  ExamScan is provided "as is" without warranties of any kind. We are not liable for grading errors,
                  service interruptions, or any consequential damages.
                </p>
              </div>
              <p className="text-gray-700 leading-relaxed">
                In no event shall ExamScan or its affiliates be liable for any indirect, incidental, special,
                or consequential damages arising out of or in connection with your use of the service.
              </p>
            </div>
          </Card>

          {/* Governing Law */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These terms shall be governed by and construed in accordance with applicable laws.
              Any disputes shall be resolved through binding arbitration or competent courts.
            </p>
          </Card>

          {/* Changes to Terms */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may update these terms periodically to reflect changes in our service or legal requirements.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We will notify users of significant changes via email or platform notifications.
              Continued use of the service after changes constitutes acceptance of the updated terms.
            </p>
          </Card>

          {/* Contact */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700"><strong>Email:</strong> legal@examscan.app</p>
              <p className="text-gray-700"><strong>Response Time:</strong> Within 48 hours</p>
            </div>
          </Card>
        </div>

        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <div className="space-x-4">
            <Link to="/privacy" className="inline-block">
              <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                View Privacy Policy
              </Button>
            </Link>
            <Link to="/" className="inline-block">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Return to ExamScan
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
