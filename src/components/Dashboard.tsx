import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Camera, Plus, Eye, Download, Printer, Trash2, Calendar, Users, LogOut, User as UserIcon } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import { getCurrentUser, logout, authenticatedFetch, type User } from '../utils/auth';
import jsPDF from 'jspdf';
import { BUBBLE_SPACING_MM, getOptionOffsets } from '../utils/pdfLayout';

interface Exam {
  id: number;
  name: string;
  description?: string;
  questions: number;
  createdAt: string;
  status: 'draft' | 'active' | 'completed';
  scansCount: number;
}

interface FullExamData {
  id: number;
  exam_name: string;
  description?: string;
  total_questions: number;
  test_structure: { type: string; count: number }[];
  answer_key: Record<number, string>;
  student_info?: {
    name: boolean;
    last_name: boolean;
    nickname: boolean;
    class: boolean;
    student_id?: boolean;
    student_id_digits?: number;
  };
  created_at: string;
  status: string;
  total_scans: number;
}

interface ApiUser {
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
    // Check authentication and load user
    const checkAuth = async () => {
      const user = await getCurrentUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      setTeacher(user);
      // Load exams from API
      await loadExams();
    };

    checkAuth();
  }, [navigate]);

  const loadExams = async (): Promise<void> => {
    try {
      const response = await authenticatedFetch('/.netlify/functions/exams');

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
      await logout();
    } catch {
      // Logout error
    }

    // Redirect to login
    navigate('/login');
  };

  const fetchFullExamData = async (examId: number): Promise<FullExamData | null> => {
    try {
      const response = await authenticatedFetch(`/.netlify/functions/exams?id=${examId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched exam data:', data);
        
        if (data.exam) {
          // Ensure JSONB fields are objects (Neon returns them as objects already, but double-check)
          const exam = data.exam;
          
          // Parse JSONB fields if they're strings (shouldn't be needed but safety check)
          const examData: FullExamData = {
            ...exam,
            test_structure: typeof exam.test_structure === 'string' 
              ? JSON.parse(exam.test_structure) 
              : exam.test_structure,
            answer_key: typeof exam.answer_key === 'string'
              ? JSON.parse(exam.answer_key)
              : exam.answer_key,
            student_info: exam.student_info && typeof exam.student_info === 'string'
              ? JSON.parse(exam.student_info)
              : exam.student_info
          };
          
          console.log('Processed exam data:', examData);
          return examData;
        }
        return null;
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch exam:', response.status, errorText);
        return null;
      }
    } catch (error) {
      console.error('Error fetching exam:', error);
      return null;
    }
  };

  const generatePDF = (examData: FullExamData): jsPDF => {
    // Validate exam data before generating PDF
    if (!examData.test_structure || !Array.isArray(examData.test_structure)) {
      throw new Error(`Invalid test_structure: expected array, got ${typeof examData.test_structure}`);
    }
    
    if (examData.test_structure.length === 0) {
      throw new Error('test_structure is empty');
    }

    // Helper function to generate option labels (A-D)
    const getOptionLabels = (count: number): string[] => {
      const safeCount = Math.min(4, Math.max(2, count));
      return Array.from({ length: safeCount }, (_, i) => String.fromCharCode(65 + i)); // A, B, C, D
    };

    // Helper function to draw fiducial markers for camera recognition (nested squares)
    const drawCornerMarkers = (pdf: jsPDF) => {
      const markerSize = 12; // Size of outer square (mm)
      const innerInset = 2; // White inset
      const innerInset2 = 4; // Inner black square inset
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 5; // Margin from edge

      const drawMarker = (x: number, y: number) => {
        pdf.setFillColor(0, 0, 0);
        pdf.rect(x, y, markerSize, markerSize, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.rect(x + innerInset, y + innerInset, markerSize - innerInset * 2, markerSize - innerInset * 2, 'F');
        pdf.setFillColor(0, 0, 0);
        pdf.rect(x + innerInset2, y + innerInset2, markerSize - innerInset2 * 2, markerSize - innerInset2 * 2, 'F');
      };

      drawMarker(margin, margin);
      drawMarker(pageWidth - margin - markerSize, margin);
      drawMarker(margin, pageHeight - margin - markerSize);
      drawMarker(pageWidth - margin - markerSize, pageHeight - margin - markerSize);
    };

    // Helper function to draw footer on each page
    const drawFooter = (pdf: jsPDF) => {
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const footerY = pageHeight - 10; // 10mm from bottom
      
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100); // Gray color for footer
      const footerText = 'ExamScan by Aleksand Petrov';
      const textWidth = pdf.getTextWidth(footerText);
      // Center the footer text
      pdf.text(footerText, (pageWidth / 2) - (textWidth / 2), footerY);
      pdf.setTextColor(0, 0, 0); // Reset to black
    };

    try {
      const pdf = new jsPDF();
      // Use actual A4 dimensions from jsPDF for pagination
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      
      // Add corner markers for camera recognition on first page
      drawCornerMarkers(pdf);
      // Add footer on first page
      drawFooter(pdf);
      
      // Set up the document - compact header
      pdf.setFontSize(16);
      pdf.text(examData.exam_name || 'Untitled Exam', 20, 18);

      if (examData.description) {
        pdf.setFontSize(9);
        pdf.text(examData.description, 20, 26);
      }

      let yPosition: number = 34;

      // Student Information - all fields on one line
      const studentInfo = examData.student_info || { name: true, last_name: true, nickname: false, class: true };
      const studentFields = [];
      if (studentInfo.name) studentFields.push('Name: _______________');
      if (studentInfo.last_name) studentFields.push('Last Name: _______________');
      if (studentInfo.nickname) studentFields.push('Nickname: _______________');
      if (studentInfo.class) studentFields.push('Class: _______________');

      if (studentFields.length > 0) {
        pdf.setFontSize(9);
        // Put all fields on one line with separators
        pdf.text(studentFields.join('  |  '), 20, yPosition);
        yPosition += 10;
      }

      // Student ID Section – thick filled bars; student darkens bars to form each digit
      const SEG_BAR_THICK = 1.2;
      const SEG_BAR_GAP = 0.2;
      const SEG_LIGHT_GRAY = 230;

      if (studentInfo.student_id) {
        pdf.setFontSize(9);
        pdf.text('Student ID:', 20, yPosition);
        yPosition += 6;
        pdf.setFontSize(8);
        pdf.text('Darken the bars for each digit (see example below). Leave bars light if that segment is off.', 20, yPosition);
        yPosition += 8;

        const squareWidth = 5.5;
        const squareHeight = 7;
        const squaresPerRow = 10;
        const squareSpacing = 1;
        const startX = 20;
        const digits = Number(studentInfo.student_id_digits) || 6;
        const halfThick = SEG_BAR_THICK / 2;

        for (let i = 0; i < digits; i++) {
          const row = Math.floor(i / squaresPerRow);
          const col = i % squaresPerRow;
          const x = startX + (col * (squareWidth + squareSpacing));
          const y = yPosition + (row * (squareHeight + squareSpacing + 5));

          const px = x;
          const py = y;
          const w = squareWidth;
          const h = squareHeight;
          const inset = 0.6;
          const topY = py + inset;
          const centerY = py + h / 2;
          const bottomY = py + h - inset;
          const leftX = px + inset;
          const rightX = px + w - inset;
          const innerLeftX = px + 0.12 * w;
          const innerRightX = px + 0.88 * w;

          pdf.setFillColor(SEG_LIGHT_GRAY, SEG_LIGHT_GRAY, SEG_LIGHT_GRAY);
          const barW = innerRightX - innerLeftX - 2 * SEG_BAR_GAP;
          const barX = innerLeftX + SEG_BAR_GAP;
          pdf.rect(barX, topY - halfThick, barW, SEG_BAR_THICK, 'F');
          pdf.rect(barX, centerY - halfThick, barW, SEG_BAR_THICK, 'F');
          pdf.rect(barX, bottomY - halfThick, barW, SEG_BAR_THICK, 'F');
          const vBarW = SEG_BAR_THICK;
          const vBarXLeft = leftX - halfThick;
          const vBarXRight = rightX - halfThick;
          const upperVertH = centerY - halfThick - SEG_BAR_GAP - (topY + SEG_BAR_GAP);
          const lowerVertY = centerY + halfThick + SEG_BAR_GAP;
          const lowerVertH = bottomY - SEG_BAR_GAP - lowerVertY;
          pdf.rect(vBarXLeft, topY + SEG_BAR_GAP, vBarW, upperVertH, 'F');
          pdf.rect(vBarXRight, topY + SEG_BAR_GAP, vBarW, upperVertH, 'F');
          pdf.rect(vBarXLeft, lowerVertY, vBarW, lowerVertH, 'F');
          pdf.rect(vBarXRight, lowerVertY, vBarW, lowerVertH, 'F');
        }

        const rowsNeeded = Math.ceil(digits / squaresPerRow);
        yPosition += (rowsNeeded * (squareHeight + squareSpacing + 6)) + 4;

        if (yPosition > pageHeight - margin - 30) {
          pdf.addPage();
          drawCornerMarkers(pdf);
          drawFooter(pdf);
          yPosition = 20;
        }

        pdf.setFontSize(8);
        pdf.text('Example digits (darken bars like these):', 20, yPosition);
        yPosition += 5;

        const digitWidth = 4.5;
        const digitHeight = 6;
        const digitSpacing = 2.5;
        const legendStartX = 20;
        const legendY = yPosition;
        const digitSegments: Record<number, string[]> = {
          0: ['A', 'B', 'C', 'E', 'F', 'G'],
          1: ['B', 'C'],
          2: ['A', 'B', 'D', 'E', 'G'],
          3: ['A', 'B', 'C', 'D', 'G'],
          4: ['B', 'C', 'D', 'F'],
          5: ['A', 'C', 'D', 'F', 'G'],
          6: ['A', 'C', 'D', 'E', 'F', 'G'],
          7: ['A', 'B', 'C'],
          8: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
          9: ['A', 'B', 'C', 'D', 'F', 'G'],
        };

        const t = Math.min(SEG_BAR_THICK * 0.7, 0.8);
        const halfT = t / 2;
        const g = SEG_BAR_GAP * 0.5;
        for (let d = 0; d <= 9; d++) {
          const digX = legendStartX + d * (digitWidth + digitSpacing);
          const py = legendY;
          const pw = digitWidth;
          const ph = digitHeight;
          const inSet = 0.6;
          const topY = py + inSet;
          const centerY = py + ph / 2;
          const bottomY = py + ph - inSet;
          const leftX = digX + inSet;
          const rightX = digX + pw - inSet;
          const innerLeftX = digX + 0.12 * pw;
          const innerRightX = digX + 0.88 * pw;
          const active = new Set(digitSegments[d] || []);

          const drawBar = (x: number, y: number, w: number, h: number, on: boolean) => {
            pdf.setFillColor(on ? 0 : SEG_LIGHT_GRAY, on ? 0 : SEG_LIGHT_GRAY, on ? 0 : SEG_LIGHT_GRAY);
            pdf.rect(x, y, w, h, 'F');
          };
          const hW = innerRightX - innerLeftX - 2 * g;
          const hX = innerLeftX + g;
          drawBar(hX, topY - halfT, hW, t, active.has('A'));
          drawBar(hX, centerY - halfT, hW, t, active.has('D'));
          drawBar(hX, bottomY - halfT, hW, t, active.has('G'));
          const upperVertH = centerY - halfT - g - (topY + g);
          const lowerVertY = centerY + halfT + g;
          const lowerVertH = bottomY - g - lowerVertY;
          drawBar(leftX - halfT, topY + g, t, upperVertH, active.has('F'));
          drawBar(rightX - halfT, topY + g, t, upperVertH, active.has('B'));
          drawBar(leftX - halfT, lowerVertY, t, lowerVertH, active.has('E'));
          drawBar(rightX - halfT, lowerVertY, t, lowerVertH, active.has('C'));
        }

        yPosition += digitHeight + 6;
      }

      // Compact instructions - placed after student info and ID
      pdf.setFontSize(9);
      pdf.text('Instructions: Fill bubbles completely • Keep marks within circles • Erase completely to change', 20, yPosition);
      yPosition += 6;

      // Start marker to help CV align the first row of bubbles
      const startMarkerY = yPosition + 2;
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.6);
      pdf.line(20, startMarkerY, pageWidth - 20, startMarkerY);
      pdf.setFontSize(8);
      pdf.text('START', 20, startMarkerY - 2);
      yPosition += 8;

      let questionNumber = 1;

      // Generate answer bubbles for each test section
      examData.test_structure.forEach((section: any, index: number) => {
        if (!section || typeof section.type !== 'string' || typeof section.count !== 'number') {
          throw new Error(`Invalid section at index ${index}: ${JSON.stringify(section)}`);
        }
        
        // Ensure count is a valid positive number
        const sectionCount = Number(section.count);
        if (isNaN(sectionCount) || sectionCount <= 0) {
          console.error('Invalid section count:', section.count);
          throw new Error(`Invalid section count at index ${index}: ${section.count}`);
        }
        
        // Ensure type is valid
        if (section.type !== 'mc' && section.type !== 'tf') {
          console.error('Invalid section type:', section.type);
          throw new Error(`Invalid section type at index ${index}: ${section.type}`);
        }

        // Compact section header - ensure we stay within A4 height
        if (yPosition > pageHeight - margin - 40) {
          pdf.addPage();
          // Add corner markers on new page for camera recognition
          drawCornerMarkers(pdf);
          // Add footer on new page
          drawFooter(pdf);
          yPosition = 20;
        }

        pdf.setFontSize(11);
        const sectionType = section.type === 'mc' ? 'Multiple Choice' : 'True/False';
        pdf.text(`${sectionType} (${sectionCount} questions)`, 20, yPosition);
        yPosition += 8;

        // Generate bubbles in a grid layout - 5 questions per row with clear separation
        const questionsPerRow = 5;
        const usableWidth = pageWidth - (margin * 2);
        const questionWidth = usableWidth / questionsPerRow;
        const rowHeight = 20; // Height of each row
        const padding = 2; // Padding inside each question box
        
        for (let i = 0; i < sectionCount; i++) {
          const row = Math.floor(i / questionsPerRow);
          const col = i % questionsPerRow;
          const questionY = yPosition + (row * rowHeight);
          
          // Check if we need a new page for this row of questions
          if (questionY + rowHeight > pageHeight - margin) {
            pdf.addPage();
            // Add corner markers on new page for camera recognition
            drawCornerMarkers(pdf);
            // Add footer on new page
            drawFooter(pdf);
            yPosition = 20;
            // Recalculate row for new page
            const newRow = 0;
            const actualY = yPosition + (newRow * rowHeight);
            const questionStartX = margin + (col * questionWidth);
            const questionCenterX = questionStartX + (questionWidth / 2);
            
            // Draw border around question for separation
            pdf.setDrawColor(200, 200, 200); // Light gray border
            pdf.setLineWidth(0.1);
            pdf.rect(questionStartX + padding, actualY, questionWidth - (padding * 2), rowHeight - 2);
            
            // Centered question number
            pdf.setFontSize(8);
            const questionText = `Q${questionNumber}`;
            const textWidth = pdf.getTextWidth(questionText);
            pdf.text(questionText, questionCenterX - (textWidth / 2), actualY + 3);

            // Draw bubbles - compact grid layout, centered
            const bubbleY = actualY + 8;
            const options = section.type === 'mc' 
              ? getOptionLabels(section.options || 4) 
              : ['T', 'F'];
            const offsets = getOptionOffsets(options.length, BUBBLE_SPACING_MM);

            options.forEach((option, optionIndex) => {
              const x = questionCenterX + offsets[optionIndex];
              // Draw circle - smaller radius for compact look
              pdf.setDrawColor(0, 0, 0); // Black for circles
              pdf.circle(x, bubbleY, 2.5, 'S');
              // Option label - smaller font
              pdf.setFontSize(6);
              pdf.text(option, x - 1, bubbleY + 4);
            });
            
            // Update yPosition for next row
            yPosition = actualY + rowHeight;
          } else {
            const questionStartX = margin + (col * questionWidth);
            const questionCenterX = questionStartX + (questionWidth / 2);
            
            // Draw border around question for separation
            pdf.setDrawColor(200, 200, 200); // Light gray border
            pdf.setLineWidth(0.1);
            pdf.rect(questionStartX + padding, questionY, questionWidth - (padding * 2), rowHeight - 2);
            
            // Centered question number
            pdf.setFontSize(8);
            const questionText = `Q${questionNumber}`;
            const textWidth = pdf.getTextWidth(questionText);
            pdf.text(questionText, questionCenterX - (textWidth / 2), questionY + 3);

            // Draw bubbles - compact grid layout, centered
            const bubbleY = questionY + 8;
            const options = section.type === 'mc' 
              ? getOptionLabels(section.options || 4) 
              : ['T', 'F'];
            const offsets = getOptionOffsets(options.length, BUBBLE_SPACING_MM);

            options.forEach((option, optionIndex) => {
              const x = questionCenterX + offsets[optionIndex];
              // Draw circle - smaller radius for compact look
              pdf.setDrawColor(0, 0, 0); // Black for circles
              pdf.circle(x, bubbleY, 2.5, 'S');
              // Option label - smaller font
              pdf.setFontSize(6);
              pdf.text(option, x - 1, bubbleY + 4);
            });
          }
          
          questionNumber++;
        }

        // Move to next row after all questions in section
        const totalRows = Math.ceil(sectionCount / questionsPerRow);
        yPosition += (totalRows * rowHeight) + 5; // Space after section
      });

      return pdf;
    } catch (error) {
      console.error('PDF generation error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        errorValue: error
      });
      console.error('Exam data that caused error:', examData);
      console.error('Test structure:', examData.test_structure);
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  const handleViewExam = async (examId: number): Promise<void> => {
    try {
      const examData = await fetchFullExamData(examId);
      if (!examData) {
        alert('Failed to load exam data. Please try again.');
        return;
      }

      // Validate exam data structure
      if (!examData.test_structure || !Array.isArray(examData.test_structure)) {
        console.error('Invalid test_structure:', examData.test_structure);
        alert('Invalid exam data structure. Please try again.');
        return;
      }

      // Generate PDF and open in new window for viewing
      const pdf = generatePDF(examData);
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
    } catch (error) {
      console.error('View error:', error);
      alert(`Failed to view exam: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDownloadExam = async (examId: number, examName: string): Promise<void> => {
    const examData = await fetchFullExamData(examId);
    if (!examData) {
      alert('Failed to load exam data. Please try again.');
      return;
    }

    try {
      const pdf = generatePDF(examData);
      pdf.save(`${examName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_answer_sheet.pdf`);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download exam. Please try again.');
    }
  };

  const handlePrintExam = async (examId: number): Promise<void> => {
    const examData = await fetchFullExamData(examId);
    if (!examData) {
      alert('Failed to load exam data. Please try again.');
      return;
    }

    try {
      const pdf = generatePDF(examData);
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Open PDF in new window and trigger print
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            URL.revokeObjectURL(pdfUrl);
          }, 250);
        };
      }
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to print exam. Please try again.');
    }
  };

  const handleDeleteExam = async (examId: number, examName: string): Promise<void> => {
    if (!confirm(`Are you sure you want to delete "${examName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/.netlify/functions/exams`, {
        method: 'DELETE',
        body: JSON.stringify({ id: examId })
      });

      if (response.ok) {
        // Remove exam from list
        setExams(exams.filter(exam => exam.id !== examId));
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Failed to delete exam. Please try again.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete exam. Please try again.');
    }
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
              {teacher ? `Welcome back, ${teacher.firstName || teacher.username}!` : 'Manage your exams and scan answer sheets'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {teacher && (
              <div className="flex items-center space-x-2 text-gray-600">
                <UserIcon size={20} />
                <span className="text-sm">{teacher.firstName} {teacher.lastName}</span>
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
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base md:text-lg font-semibold text-gray-800 truncate max-w-full md:max-w-xs">
                        {exam.name}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(exam.status)}`}>
                        {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                      </span>
                    </div>
                    {exam.description && (
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2 md:line-clamp-3">
                        {exam.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm text-gray-500">
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

                  <div className="flex flex-wrap justify-start md:justify-end gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewExam(exam.id)}
                    >
                      <Eye size={16} className="mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/generate?id=${exam.id}`)}
                    >
                      <FileText size={16} className="mr-1" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDownloadExam(exam.id, exam.name)}
                    >
                      <Download size={16} className="mr-1" />
                      Download
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handlePrintExam(exam.id)}
                    >
                      <Printer size={16} className="mr-1" />
                      Print
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteExam(exam.id, exam.name)}
                    >
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
