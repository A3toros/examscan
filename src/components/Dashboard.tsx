import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Camera, Plus, Eye, Download, Trash2, ArrowLeft, Calendar, Users, LogOut, User } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import { getAuthCookies, clearAuthCookies } from '../utils/auth';

interface Exam {
  id: number;
  name: string;
  description?: string;
  questions: number;
  createdAt: string;
  status: 'draft' | 'active' | 'completed';
  scansCount: number;
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface ApiExam {
  id: number;
  exam_name: string;
  description?: string;
  questions?: unknown[];
  created_at: string;
  status?: string;
  total_scans?: number;
}

interface ExamsResponse {
  exams?: ApiExam[];
}

const Dashboard = (): React.JSX.Element => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [teacher, setTeacher] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication using cookies
    const authData = getAuthCookies();

    if (!authData) {
      navigate('/login');
      return;
    }

    setTeacher(authData.user);

    // Load exams from API
    loadExams(authData.token);
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadExams = async (token: string): Promise<void> => {
    try {
      const response = await fetch('/functions/exams.ts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data: ExamsResponse = await response.json();
        // Transform API data to component format
        const transformedExams = data.exams?.map((exam: ApiExam) => ({
          id: exam.id,
          name: exam.exam_name,
          description: exam.description,
          questions: exam.questions?.length || 0,
          createdAt: exam.created_at,
          status: (exam.status || 'draft') as 'draft' | 'active' | 'completed',
          scansCount: exam.total_scans || 0
        })) || [];

        setExams(transformedExams);
      } else if (response.status === 401) {
        // Token expired, redirect to login
        handleLogout();
      }
    } catch {
      // Error loading exams
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      const authData = getAuthCookies();
      if (authData?.token) {
        await fetch('/functions/logout.ts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authData.token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch {
      // Logout error
    }

    // Clear authentication cookies
    clearAuthCookies();

    // Redirect to login
    navigate('/login');
  };

  const features = [
    {
      icon: FileText,
      title: 'Create New Exam',
      description: 'Build custom answer sheets with multiple choice and true/false questions',
      path: '/generate',
      color: 'bg-blue-500',
      primary: true
    },
    {
      icon: Camera,
      title: 'Scan Answer Sheets',
      description: 'Use your camera to grade completed exams with AI-powered OCR',
      path: '/scan',
      color: 'bg-green-500',
      primary: false
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const totalScans = exams.reduce((sum, exam) => sum + exam.scansCount, 0);
  const activeExams = exams.filter(exam => exam.status === 'active').length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">ExamScan Dashboard</h1>
            <p className="text-gray-600">
              {teacher ? `Welcome back, ${teacher.first_name || teacher.username}!` : 'Manage your exams and scan answer sheets'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {teacher && (
              <div className="flex items-center space-x-2 text-gray-600">
                <User size={20} />
                <span className="text-sm">{teacher.first_name} {teacher.last_name}</span>
              </div>
            )}
            <Button
              onClick={handleLogout}
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <LogOut size={20} className="mr-2" />
              Logout
            </Button>
          </div>
          <Link
            to="/"
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Home
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Link key={index} to={feature.path}>
                <Card hover className="h-full">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="text-blue-600" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{exams.length}</div>
                <p className="text-gray-600 text-sm">Total Exams</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Camera className="text-green-600" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{totalScans}</div>
                <p className="text-gray-600 text-sm">Total Scans</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="text-purple-600" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{activeExams}</div>
                <p className="text-gray-600 text-sm">Active Exams</p>
              </div>
            </div>
          </Card>
        </div>

        {/* My Exams Section */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">My Exams</h2>
            <Link to="/generate">
              <Button className="bg-blue-600 hover:bg-blue-700" variant="primary">
                <Plus size={20} className="mr-2" />
                Create New Exam
              </Button>
            </Link>
          </div>

          {exams.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No exams created yet</h3>
              <p className="text-gray-500 mb-6">Get started by creating your first exam</p>
              <Link to="/generate">
                <Button variant="primary">
                  <Plus size={20} className="mr-2" />
                  Create Your First Exam
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">{exam.name}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(exam.status)}`}>
                        {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                      </span>
                    </div>
                    {exam.description && (
                      <p className="text-gray-600 text-sm mb-2">{exam.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <FileText size={16} className="mr-1" />
                        {exam.questions} questions
                      </span>
                      <span className="flex items-center">
                        <Camera size={16} className="mr-1" />
                        {exam.scansCount} scans
                      </span>
                      <span className="flex items-center">
                        <Calendar size={16} className="mr-1" />
                        {formatDate(exam.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="outline">
                      <Eye size={16} className="mr-1" />
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download size={16} className="mr-1" />
                      Export
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
