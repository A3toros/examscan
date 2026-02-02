import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, Download, Printer, Settings, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType } from 'docx';
import { authenticatedFetch } from '../../utils/auth';
import { BUBBLE_SPACING_MM, getOptionOffsets } from '../../utils/pdfLayout';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

interface TestSection {
  id: string;
  type: 'mc' | 'tf';
  count: number;
  options?: number; // Number of options for MC questions (2-4), default 4
}

interface StudentInfo {
  name: boolean;
  last_name: boolean;
  nickname: boolean;
  class: boolean;
  student_id: boolean;
  student_id_digits: number; // Number of digits in student ID (e.g., 6, 8, 10)
}

interface ExamForm {
  name: string;
  description: string;
  testStructure: TestSection[];
  answerKey: Record<number, string>;
  studentInfo: StudentInfo;
}

function AnswerSheetGenerator() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [examId, setExamId] = useState<number | null>(null);
  const [exam, setExam] = useState<ExamForm>({
    name: '',
    description: '',
    testStructure: [],
    answerKey: {},
    studentInfo: {
      name: true,
      last_name: true,
      nickname: true,
      class: true,
      student_id: true,
      student_id_digits: 6
    }
  });

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Load existing exam for editing if ?id= is present
  useEffect(() => {
    const idParam = searchParams.get('id') || searchParams.get('examId');
    if (!idParam) return;

    const id = parseInt(idParam, 10);
    if (!Number.isFinite(id) || id <= 0) return;

    const loadExamForEdit = async () => {
      try {
        const response = await authenticatedFetch(`/.netlify/functions/exams?id=${id}`);
        if (!response.ok) {
          console.error('Failed to load exam for editing', await response.text());
          return;
        }

        const data = await response.json();
        if (!data.exam) return;

        const examData = data.exam;

        const dbTestStructure = typeof examData.test_structure === 'string'
          ? JSON.parse(examData.test_structure)
          : examData.test_structure || [];

        console.log('[ExamEdit][db] test_structure raw', {
          examId: examData.id,
          examName: examData.exam_name || examData.title,
          testStructure: dbTestStructure,
        });

        const mappedTestStructure: TestSection[] = Array.isArray(dbTestStructure)
          ? dbTestStructure.map((section: any, index: number) => {
              const type = section.type === 'tf' ? 'tf' : 'mc';
              const rawOptions = Number(section.options);
              const safeOptions = Number.isFinite(rawOptions)
                ? Math.min(4, Math.max(2, rawOptions))
                : 4;
              return {
                id: section.id || `section-${index + 1}`,
                type,
                count: Number(section.count) || 0,
                options: type === 'mc' ? safeOptions : undefined,
              };
            })
          : [];

        console.log('[ExamEdit][db] test_structure normalized', {
          examId: examData.id,
          examName: examData.exam_name || examData.title,
          testStructure: mappedTestStructure.map((section) => ({
            type: section.type,
            count: section.count,
            options: section.options,
          }))
        });

        const dbAnswerKey = typeof examData.answer_key === 'string'
          ? JSON.parse(examData.answer_key)
          : examData.answer_key || {};

        const dbStudentInfo = examData.student_info && typeof examData.student_info === 'string'
          ? JSON.parse(examData.student_info)
          : examData.student_info || {};

        setExam({
          name: examData.exam_name || examData.title || '',
          description: examData.description || '',
          testStructure: mappedTestStructure,
          answerKey: dbAnswerKey,
          studentInfo: {
            name: dbStudentInfo.name ?? true,
            last_name: dbStudentInfo.last_name ?? true,
            nickname: dbStudentInfo.nickname ?? false,
            class: dbStudentInfo.class ?? true,
            student_id: dbStudentInfo.student_id ?? false,
            student_id_digits: dbStudentInfo.student_id_digits ?? 6,
          },
        });

        setExamId(id);
        setExpandedSections(new Set(mappedTestStructure.map(s => s.id)));
      } catch (error) {
        console.error('Error loading exam for edit:', error);
      }
    };

    loadExamForEdit();
  }, [searchParams]);

  // Helper function to generate option labels (A-F)
  const getOptionLabels = (count: number): string[] => {
    const safeCount = Math.min(4, Math.max(2, count));
    return Array.from({ length: safeCount }, (_, i) => String.fromCharCode(65 + i)); // A, B, C, D
  };

  // Add a new test section
  const addTestSection = (type: 'mc' | 'tf') => {
    const newSection: TestSection = {
      id: `section-${Date.now()}`,
      type,
      count: 5, // Default count
      options: type === 'mc' ? 4 : undefined // Default 4 options for MC
    };

    setExam(prev => ({
      ...prev,
      testStructure: [...prev.testStructure, newSection]
    }));

    // Expand the new section
    setExpandedSections(prev => new Set(prev).add(newSection.id));
  };

  // Update section count
  const updateSectionCount = (sectionId: string, count: number) => {
    if (count < 1 || count > 50) return; // Reasonable limits

    setExam(prev => ({
      ...prev,
      testStructure: prev.testStructure.map(section =>
        section.id === sectionId ? { ...section, count } : section
      )
    }));
  };

  // Update section options (for MC questions)
  const updateSectionOptions = (sectionId: string, options: number) => {
    if (options < 2 || options > 4) return; // Valid range: 2-4

    setExam(prev => ({
      ...prev,
      testStructure: prev.testStructure.map(section =>
        section.id === sectionId ? { ...section, options } : section
      ),
      // Clear answer keys for questions in this section if options changed
      answerKey: (() => {
        const updatedAnswerKey = { ...prev.answerKey };
        const sectionIndex = prev.testStructure.findIndex(s => s.id === sectionId);
        if (sectionIndex === -1) return updatedAnswerKey;
        
        const { start } = getQuestionRange(sectionIndex);
        const section = prev.testStructure[sectionIndex];
        const newLabels = getOptionLabels(options);
        
        // Remove answers that are no longer valid
        for (let i = 0; i < section.count; i++) {
          const qNum = start + i;
          if (updatedAnswerKey[qNum] && !newLabels.includes(updatedAnswerKey[qNum])) {
            delete updatedAnswerKey[qNum];
          }
        }
        
        return updatedAnswerKey;
      })()
    }));
  };

  // Remove a test section
  const removeTestSection = (sectionId: string) => {
    setExam(prev => {
      const updatedStructure = prev.testStructure.filter(s => s.id !== sectionId);

      // Reindex answer key based on new structure
      const updatedAnswerKey = { ...prev.answerKey };
      const newAnswerKey: Record<number, string> = {};

      let currentQuestionNumber = 1;
      updatedStructure.forEach(section => {
        for (let i = 0; i < section.count; i++) {
          if (updatedAnswerKey[currentQuestionNumber]) {
            newAnswerKey[currentQuestionNumber] = updatedAnswerKey[currentQuestionNumber];
          }
          currentQuestionNumber++;
        }
      });

      return {
        ...prev,
        testStructure: updatedStructure,
        answerKey: newAnswerKey
      };
    });

    setExpandedSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionId);
      return newSet;
    });
  };



  // Calculate total questions
  const getTotalQuestions = () => {
    return exam.testStructure.reduce((total, section) => total + section.count, 0);
  };

  // Get question number range for a section
  const getQuestionRange = (sectionIndex: number) => {
    let startQuestion = 1;
    for (let i = 0; i < sectionIndex; i++) {
      startQuestion += exam.testStructure[i].count;
    }
    const endQuestion = startQuestion + exam.testStructure[sectionIndex].count - 1;
    return { start: startQuestion, end: endQuestion };
  };

  // Update student info fields
  const updateStudentInfo = (field: keyof StudentInfo, value: boolean | number) => {
    setExam(prev => ({
      ...prev,
      studentInfo: {
        ...prev.studentInfo,
        [field]: value
      }
    }));
  };

  // Toggle section expansion
  const toggleSectionExpansion = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };


  // Update answer key
  const updateAnswerKey = (questionNumber: number, answer: string) => {
    setExam(prev => ({
      ...prev,
      answerKey: {
        ...prev.answerKey,
        [questionNumber]: answer
      }
    }));
  };


  // Save exam to database
  const saveExam = async () => {
    if (!exam.name.trim()) {
      alert('Please enter an exam name');
      return;
    }

    if (exam.testStructure.length === 0) {
      alert('Please add at least one test section');
      return;
    }

    const totalQuestions = getTotalQuestions();
    if (totalQuestions === 0) {
      alert('Please add questions to your test sections');
      return;
    }

    // Validate answer key
    const missingAnswers: number[] = [];
    let currentQuestion = 1;
    exam.testStructure.forEach(section => {
      for (let i = 0; i < section.count; i++) {
        if (!exam.answerKey[currentQuestion]) {
          missingAnswers.push(currentQuestion);
        }
        currentQuestion++;
      }
    });

    if (missingAnswers.length > 0) {
      alert(`Please provide answers for questions: ${missingAnswers.join(', ')}`);
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: exam.name,
        description: exam.description,
        testStructure: exam.testStructure.map(section => ({
          type: section.type,
          count: section.count,
          options: section.type === 'mc'
            ? Math.min(4, Math.max(2, Number(section.options) || 4))
            : undefined,
        })),
        answerKey: exam.answerKey,
        studentInfo: exam.studentInfo,
        ...(examId ? { id: examId } : {}),
      };

      const response = await authenticatedFetch('/.netlify/functions/exams', {
        method: examId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert(examId ? 'Exam updated successfully!' : 'Exam saved successfully!');

        // After saving, always go back to dashboard
        navigate('/dashboard');

        // For new exams we still reset local state in case user navigates back here via history
        if (!examId) {
          setExam({
            name: '',
            description: '',
            testStructure: [],
            answerKey: {},
            studentInfo: {
              name: true,
              last_name: true,
              nickname: true,
              class: true,
              student_id: true,
              student_id_digits: 6,
            },
          });
          setExpandedSections(new Set());
        }
      } else if (response.status === 401) {
        alert('Session expired. Please log in again.');
        window.location.href = '/login';
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.details 
          ? `${errorData.error || 'Failed to save exam'}: ${errorData.details}`
          : errorData.error || 'Unknown error';
        console.error('Save exam error:', errorData);
        alert(`Failed to save exam: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error saving exam:', error);
      const errorMsg = error instanceof TypeError && error.message === 'Failed to fetch'
        ? 'Network error. Please check your connection or make sure the server is running.'
        : 'Failed to save exam. Please try again.';
      alert(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const generatePDFDoc = async () => {
    const pdf = new jsPDF();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const topMargin = 30;
    const bottomMargin = 20;
    const margin = 20;

    try {
      const drawCornerMarkers = (doc: jsPDF) => {
        const markerSize = 12; // Size of outer square (mm)
        const innerInset = 2;
        const innerInset2 = 4;
        const drawMarker = (x: number, y: number) => {
          doc.setFillColor(0, 0, 0);
          doc.rect(x, y, markerSize, markerSize, 'F');
          doc.setFillColor(255, 255, 255);
          doc.rect(x + innerInset, y + innerInset, markerSize - innerInset * 2, markerSize - innerInset * 2, 'F');
          doc.setFillColor(0, 0, 0);
          doc.rect(x + innerInset2, y + innerInset2, markerSize - innerInset2 * 2, markerSize - innerInset2 * 2, 'F');
        };

        const markerMargin = 5;
        drawMarker(markerMargin, markerMargin);
        drawMarker(pageWidth - markerMargin - markerSize, markerMargin);
        drawMarker(markerMargin, pageHeight - markerMargin - markerSize);
        drawMarker(pageWidth - markerMargin - markerSize, pageHeight - markerMargin - markerSize);
      };

      // Set up the document (match dashboard header)
      drawCornerMarkers(pdf);
      pdf.setFontSize(16);
      pdf.text(exam.name || 'Untitled Exam', 20, 18);

      if (exam.description) {
        pdf.setFontSize(9);
        pdf.text(exam.description, 20, 26);
      }

      let yPosition = 34;

      // Student Information - all fields on one line
      const studentFields = [];
      if (exam.studentInfo.name) studentFields.push('Name: _______________');
      if (exam.studentInfo.last_name) studentFields.push('Last Name: _______________');
      if (exam.studentInfo.nickname) studentFields.push('Nickname: _______________');
      if (exam.studentInfo.class) studentFields.push('Class: _______________');

      if (studentFields.length > 0) {
        pdf.setFontSize(9);
        pdf.text(studentFields.join('  |  '), 20, yPosition);
        yPosition += 10;
      }

      // Student ID Section
      if (exam.studentInfo.student_id) {
        pdf.setFontSize(9);
        pdf.text('Student ID:', 20, yPosition);
        yPosition += 8;

        // Draw student ID grids (match example digit size/spacing)
        const squareWidth = 5.5;
        const squareHeight = 7;
        const squaresPerRow = 10;
        const squareSpacing = 1;
        const startX = 20; // Match Dashboard.tsx

        for (let i = 0; i < exam.studentInfo.student_id_digits; i++) {
          const row = Math.floor(i / squaresPerRow);
          const col = i % squaresPerRow;
          const x = startX + (col * (squareWidth + squareSpacing));
          const y = yPosition + (row * (squareHeight + squareSpacing + 5));

          // "Digital 8" style guide only (no outer box)
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.3);

          const px = x;
          const py = y;
          const w = squareWidth;
          const h = squareHeight;

          const inset = 0.8;
          const gap = 0.15; // match example digit spacing
          const topY = py + inset;
          const upperMidY = py + h / 3;
          const centerY = py + h / 2;
          const lowerMidY = py + (2 * h) / 3;
          const bottomY = py + h - inset;

          const leftX = px + inset;
          const innerLeftX = px + w / 3;
          const innerRightX = px + (2 * w) / 3;
          const rightX = px + w - inset;

          // Horizontal segments (like digital 8)
          pdf.line(innerLeftX + gap, topY, innerRightX - gap, topY);           // top
          pdf.line(innerLeftX + gap, centerY, innerRightX - gap, centerY);     // middle
          pdf.line(innerLeftX + gap, bottomY, innerRightX - gap, bottomY);     // bottom

          // Vertical segments (upper)
          pdf.line(leftX, topY + gap, leftX, upperMidY - gap);                 // upper-left
          pdf.line(rightX, topY + gap, rightX, upperMidY - gap);               // upper-right

          // Vertical segments (lower)
          pdf.line(leftX, lowerMidY + gap, leftX, bottomY - gap);              // lower-left
          pdf.line(rightX, lowerMidY + gap, rightX, bottomY - gap);            // lower-right

          // No position numbers below grids
        }

        yPosition += Math.ceil(exam.studentInfo.student_id_digits / squaresPerRow) * (squareHeight + squareSpacing + 6) + 4;

        // Ensure we have room for the examples, otherwise move to a new page
        if (yPosition > pageHeight - bottomMargin - 40) {
          pdf.addPage();
          drawCornerMarkers(pdf);
          yPosition = topMargin;
        }

        // Digital number examples (0–9) using the same "digital 8" style grid
        pdf.setFontSize(8);
        pdf.text('Example digits (digital style):', 20, yPosition);
        yPosition += 5;

        const digitWidth = 4.5;  // Smaller example
        const digitHeight = 6;
        const digitSpacing = 2.5;
        const legendStartX = 20;
        const legendY = yPosition;

        // Segment map for 7-seg style digits (A, B, C, D, E, F, G)
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

        for (let d = 0; d <= 9; d++) {
          const x = legendStartX + d * (digitWidth + digitSpacing);
          const y = legendY;

          const px = x;
          const py = y;
          const w = digitWidth;
          const h = digitHeight;

          const inset = 0.8;
          const gap = 0.15; // segments nearly touch but don't overlap
          const topY = py + inset;
          const centerY = py + h / 2;
          const bottomY = py + h - inset;

          const leftX = px + inset;
          const innerLeftX = px + w / 3;
          const innerRightX = px + (2 * w) / 3;
          const rightX = px + w - inset;

          const active = new Set(digitSegments[d] || []);

          pdf.setDrawColor(0, 0, 0); // Black for visibility
          pdf.setLineWidth(0.3);

          // Horizontals: A (top), D (middle), G (bottom)
          if (active.has('A')) {
            pdf.line(innerLeftX + gap, topY, innerRightX - gap, topY);
          }
          if (active.has('D')) {
            pdf.line(innerLeftX + gap, centerY, innerRightX - gap, centerY);
          }
          if (active.has('G')) {
            pdf.line(innerLeftX + gap, bottomY, innerRightX - gap, bottomY);
          }

          // Verticals: F (upper-left), B (upper-right), E (lower-left), C (lower-right)
          const upperMidY = py + h / 3;
          const lowerMidY = py + (2 * h) / 3;

          if (active.has('F')) {
            pdf.line(leftX, topY + gap, leftX, upperMidY - gap);
          }
          if (active.has('B')) {
            pdf.line(rightX, topY + gap, rightX, upperMidY - gap);
          }
          if (active.has('E')) {
            pdf.line(leftX, lowerMidY + gap, leftX, bottomY - gap);
          }
          if (active.has('C')) {
            pdf.line(rightX, lowerMidY + gap, rightX, bottomY - gap);
          }

          // No numeric labels under example digits
        }

        yPosition += digitHeight + 6;
      }

      // Compact instructions (match dashboard)
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

      // Generate answer bubbles for each test section (match dashboard layout)
      exam.testStructure.forEach((section) => {
        // Section header
        if (yPosition > pageHeight - margin - 40) {
          pdf.addPage();
          yPosition = topMargin;
        }

        pdf.setFontSize(11);
        const sectionType = section.type === 'mc' ? 'Multiple Choice' : 'True/False';
        pdf.text(`${sectionType} (${section.count} questions)`, 20, yPosition);
        yPosition += 8;

        const questionsPerRow = 5;
        const usableWidth = pageWidth - (margin * 2);
        const questionWidth = usableWidth / questionsPerRow;
        const rowHeight = 20;
        const padding = 2;
        const totalRows = Math.ceil(section.count / questionsPerRow);

        for (let row = 0; row < totalRows; row++) {
        if (yPosition + rowHeight > pageHeight - margin) {
          pdf.addPage();
          drawCornerMarkers(pdf);
          yPosition = topMargin;
        }

          const rowY = yPosition;
          for (let col = 0; col < questionsPerRow; col++) {
            const index = row * questionsPerRow + col;
            if (index >= section.count) break;

            const questionStartX = margin + (col * questionWidth);
            const questionCenterX = questionStartX + (questionWidth / 2);

            // Draw border around question for separation
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.1);
            pdf.rect(questionStartX + padding, rowY, questionWidth - (padding * 2), rowHeight - 2, 'S');

            // Centered question number
            pdf.setFontSize(8);
            const questionText = `Q${questionNumber}`;
            const textWidth = pdf.getTextWidth(questionText);
            pdf.text(questionText, questionCenterX - (textWidth / 2), rowY + 3);

            // Draw bubbles - compact grid layout, centered
            const bubbleY = rowY + 8;
            const options = section.type === 'mc'
              ? getOptionLabels(section.options || 4)
              : ['T', 'F'];
            const offsets = getOptionOffsets(options.length, BUBBLE_SPACING_MM);

            options.forEach((option, optionIndex) => {
              const x = questionCenterX + offsets[optionIndex];
              pdf.setDrawColor(0, 0, 0);
              pdf.circle(x, bubbleY, 2.5, 'S');
              pdf.setFontSize(6);
              pdf.text(option, x - 1, bubbleY + 4);
            });

            questionNumber++;
          }

          yPosition += rowHeight;
        }

        yPosition += 5; // Space between sections
      });

      return pdf;
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
      throw error;
    }
  };

  // Generate and download PDF
  const downloadPDF = async () => {
    setShowDownloadModal(false);

    try {
      const pdf = await generatePDFDoc();
      pdf.save(`${exam.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_answer_sheet.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const previewPDF = async () => {
    try {
      const pdf = await generatePDFDoc();
      const url = pdf.output('bloburl');
      window.open(url, '_blank');
    } catch (error) {
      console.error('PDF preview failed:', error);
      alert('Failed to preview PDF. Please try again.');
    }
  };

  // Generate and download Word document
  const downloadWord = async () => {
    setShowDownloadModal(false);

    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Title
            new Paragraph({
              children: [
                new TextRun({
                  text: exam.name,
                  bold: true,
                  size: 32,
                }),
              ],
            }),

            // Description
            ...(exam.description ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: exam.description,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({ children: [] }), // Empty line
            ] : []),

            // Instructions
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Answer Sheet Instructions:',
                  bold: true,
                  size: 28,
                }),
              ],
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: '• Fill in the bubbles completely with a dark pencil or pen',
                  size: 24,
                }),
              ],
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: '• Make sure your marks are within the circles',
                  size: 24,
                }),
              ],
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: '• Erase completely if you need to change an answer',
                  size: 24,
                }),
              ],
            }),

            new Paragraph({ children: [] }), // Empty line

            // Student Information Header
            ...(function() {
              const studentElements: (Paragraph | Table)[] = [];
              const studentFields = [];
              if (exam.studentInfo.name) studentFields.push('Name: ____________________');
              if (exam.studentInfo.last_name) studentFields.push('Last Name: ____________________');
              if (exam.studentInfo.nickname) studentFields.push('Nickname: ____________________');
              if (exam.studentInfo.class) studentFields.push('Class: ____________________');

              if (studentFields.length > 0) {
                studentElements.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Student Information:',
                        bold: true,
                        size: 26,
                      }),
                    ],
                  })
                );

                studentFields.forEach(field => {
                  studentElements.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: field,
                          size: 24,
                        }),
                      ],
                    })
                  );
                });

                studentElements.push(new Paragraph({ children: [] })); // Empty line
              }

              // Student ID Section
              if (exam.studentInfo.student_id) {
                studentElements.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Student ID:',
                        bold: true,
                        size: 26,
                      }),
                    ],
                  })
                );

                studentElements.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Write your student ID number in the squares below:',
                        size: 24,
                      }),
                    ],
                  })
                );

                // Create student ID squares table
                const squaresPerRow = 10;
                const rows = Math.ceil(exam.studentInfo.student_id_digits / squaresPerRow);

                for (let row = 0; row < rows; row++) {
                  const cells = [];
                  const squaresInThisRow = Math.min(squaresPerRow, exam.studentInfo.student_id_digits - (row * squaresPerRow));

                  for (let col = 0; col < squaresInThisRow; col++) {
                    const digitNumber = row * squaresPerRow + col + 1;
                    cells.push(
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: '□',
                                size: 32,
                              }),
                            ],
                          }),
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: digitNumber.toString(),
                                size: 16,
                              }),
                            ],
                          }),
                        ],
                        width: {
                          size: 10,
                          type: WidthType.PERCENTAGE,
                        },
                      })
                    );
                  }

                  // Fill remaining cells if needed
                  while (cells.length < squaresPerRow) {
                    cells.push(
                      new TableCell({
                        children: [new Paragraph({ children: [] })],
                        width: {
                          size: 10,
                          type: WidthType.PERCENTAGE,
                        },
                      })
                    );
                  }

                  studentElements.push(
                    new Table({
                      width: {
                        size: 100,
                        type: WidthType.PERCENTAGE,
                      },
                      rows: [
                        new TableRow({
                          children: cells,
                        }),
                      ],
                    })
                  );
                }

                studentElements.push(new Paragraph({ children: [] })); // Empty line
              }

              return studentElements;
            })(),

            // Generate sections and questions
            ...(() => {
              const elements: (Paragraph | Table)[] = [];
              let questionNumber = 1;

              exam.testStructure.forEach(section => {
                const sectionType = section.type === 'mc' ? 'Multiple Choice' : 'True/False';
                elements.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${sectionType} Section (${section.count} questions)`,
                        bold: true,
                        size: 28,
                      }),
                    ],
                  })
                );

                // Generate questions for this section
                for (let i = 0; i < section.count; i++) {
                  elements.push(
                    // Question header
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `Question ${questionNumber}`,
                          bold: true,
                          size: 26,
                        }),
                      ],
                    }),

                    // Answer options table
                    new Table({
                      width: {
                        size: 100,
                        type: WidthType.PERCENTAGE,
                      },
                      rows: [
                        new TableRow({
                          children: (section.type === 'mc' 
                            ? getOptionLabels(section.options || 4)
                            : ['True', 'False']
                          ).map(option =>
                            new TableCell({
                              children: [
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: `○ ${option}`,
                                      size: 24,
                                    }),
                                  ],
                                }),
                              ],
                              width: {
                                size: section.type === 'mc' ? 25 : 50,
                                type: WidthType.PERCENTAGE,
                              },
                            })
                          ),
                        }),
                      ],
                    }),

                    new Paragraph({ children: [] }) // Empty line
                  );
                  questionNumber++;
                }

                elements.push(new Paragraph({ children: [] })); // Space between sections
              });

              return elements;
            })(),
          ],
        }],
      });

      // Generate and download the Word document
      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([new Uint8Array(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${exam.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_answer_sheet.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Word generation failed:', error);
      alert('Failed to generate Word document. Please try again.');
    }
  };

  // Print functionality
  const printTemplate = () => {
    window.print();
  };

  const renderSection = (section: TestSection, sectionIndex: number) => {
    const isExpanded = expandedSections.has(section.id);
    const { start, end } = getQuestionRange(sectionIndex);

    return (
      <motion.div
        key={section.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="border border-gray-200 rounded-lg p-4 mb-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <span className="font-semibold text-gray-800">
              {section.type === 'mc' ? 'Multiple Choice' : 'True/False'} Section
            </span>
            <span className="text-sm text-gray-600">
              {section.count} questions (#{start}-{end})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleSectionExpansion(section.id)}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => removeTestSection(section.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Questions
                    </label>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateSectionCount(section.id, section.count - 1)}
                        disabled={section.count <= 1}
                      >
                        <Minus size={14} />
                      </Button>
                      <input
                        type="number"
                        value={section.count}
                        onChange={(e) => updateSectionCount(section.id, parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                        max="50"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateSectionCount(section.id, section.count + 1)}
                        disabled={section.count >= 50}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  </div>

                  {section.type === 'mc' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Options per Question
                      </label>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSectionOptions(section.id, (section.options || 4) - 1)}
                          disabled={(section.options || 4) <= 2}
                        >
                          <Minus size={14} />
                        </Button>
                        <select
                          value={section.options || 4}
                          onChange={(e) => updateSectionOptions(section.id, parseInt(e.target.value))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSectionOptions(section.id, (section.options || 4) + 1)}
                          disabled={(section.options || 4) >= 4}
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Options: {getOptionLabels(section.options || 4).join(', ')}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Answer Key for Questions #{start}-{end}
                  </label>
                  <div className="grid grid-cols-5 gap-4">
                    {Array.from({ length: section.count }, (_, i) => {
                      const questionNumber = start + i;
                      const currentAnswer = exam.answerKey[questionNumber];

                      return (
                        <div key={questionNumber} className="text-center">
                          <div className="text-sm font-medium mb-1">Q{questionNumber}</div>
                          <div className="flex space-x-1 justify-center">
                            {(section.type === 'mc' 
                              ? getOptionLabels(section.options || 4) 
                              : ['T', 'F']
                            ).map(option => (
                              <label key={option} className="flex items-center">
                                <input
                                  type="radio"
                                  name={`answer-${questionNumber}`}
                                  value={option}
                                  checked={currentAnswer === option}
                                  onChange={(e) => updateAnswerKey(questionNumber, e.target.value)}
                                  className="mr-1"
                                />
                                <span className="text-xs">{option}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 text-sm font-semibold group-hover:bg-emerald-500/20">
            ES
          </span>
          <span className="text-lg font-semibold tracking-tight text-gray-900 group-hover:text-emerald-600">
            Exam<span className="text-emerald-500 group-hover:text-emerald-400">Scan</span>
          </span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Answer Sheet Constructor</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Create custom answer sheets with multiple choice and true/false questions
          </p>
        </div>
      </div>

      {/* Template Settings */}
      <Card className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Template Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exam Name *
            </label>
            <input
              type="text"
              value={exam.name}
              onChange={(e) => setExam(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Math Quiz - Chapter 5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={exam.description}
              onChange={(e) => setExam(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description of the test"
            />
          </div>
        </div>
      </Card>

      {/* Student Information */}
      <Card className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Student Information Header</h2>
        <p className="text-sm text-gray-600 mb-4">Select which student information fields to include at the top of the answer sheet:</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exam.studentInfo.name}
                onChange={(e) => updateStudentInfo('name', e.target.checked)}
                className="mr-2"
              />
              Name
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exam.studentInfo.last_name}
                onChange={(e) => updateStudentInfo('last_name', e.target.checked)}
                className="mr-2"
              />
              Last Name
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exam.studentInfo.nickname}
                onChange={(e) => updateStudentInfo('nickname', e.target.checked)}
                className="mr-2"
              />
              Nickname
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={exam.studentInfo.class}
                onChange={(e) => updateStudentInfo('class', e.target.checked)}
                className="mr-2"
              />
              Class
            </label>
          </div>

          <div className="border-t pt-4">
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                checked={exam.studentInfo.student_id}
                onChange={(e) => updateStudentInfo('student_id', e.target.checked)}
                className="mr-2"
              />
              Student ID (Number Recognition)
            </label>
            {exam.studentInfo.student_id && (
              <div className="ml-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of digits in Student ID:
                </label>
                <select
                  value={exam.studentInfo.student_id_digits}
                  onChange={(e) => updateStudentInfo('student_id_digits', parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={4}>4 digits</option>
                  <option value={5}>5 digits</option>
                  <option value={6}>6 digits</option>
                  <option value={7}>7 digits</option>
                  <option value={8}>8 digits</option>
                  <option value={9}>9 digits</option>
                  <option value={10}>10 digits</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Add Question Buttons */}
      <Card className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Add Test Sections</h2>
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={() => addTestSection('mc')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={20} className="mr-2" />
            Add Multiple Choice Section
          </Button>
          <Button
            onClick={() => addTestSection('tf')}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus size={20} className="mr-2" />
            Add True/False Section
          </Button>
        </div>
      </Card>

      {/* Questions List */}
      <Card className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Questions ({getTotalQuestions()})
          </h2>
          {getTotalQuestions() > 0 && (
            <span className="text-sm text-gray-600">
              {Object.keys(exam.answerKey).length}/{getTotalQuestions()} answered
            </span>
          )}
        </div>

        {getTotalQuestions() === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Settings size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No questions added yet</p>
            <p className="text-sm">Click "Add Multiple Choice Section" or "Add True/False Section" to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {exam.testStructure.map((section, index) => renderSection(section, index))}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* Action Buttons */}
      {exam.testStructure.length > 0 && (
        <Card>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button
              onClick={saveExam}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save size={20} className="mr-2" />
              {isSaving ? 'Saving...' : 'Save Exam'}
            </Button>

            <Button
              onClick={previewPDF}
              variant="outline"
            >
              Preview
            </Button>

            {/* Only allow Print/Download when creating a new exam; for editing focus on saving changes */}
            {!examId && (
              <>
                <Button
                  onClick={printTemplate}
                  variant="outline"
                >
                  <Printer size={20} className="mr-2" />
                  Print
                </Button>

                <Button
                  onClick={() => setShowDownloadModal(true)}
                  variant="outline"
                >
                  <Download size={20} className="mr-2" />
                  Download
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Download Modal */}
      <Modal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        title="Download Answer Sheet"
      >
        <div className="space-y-4">
          <p className="text-gray-600 mb-4">
            Choose the format for your answer sheet:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={downloadPDF}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-colors text-left"
            >
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-red-600 font-bold text-lg">PDF</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">PDF Document</h3>
                  <p className="text-sm text-gray-600">Portable Document Format</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Best for printing and sharing. Universally compatible.
              </p>
            </button>

            <button
              onClick={downloadWord}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-blue-600 font-bold text-lg">DOC</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Word Document</h3>
                  <p className="text-sm text-gray-600">Microsoft Word Format</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Editable format for further customization.
              </p>
            </button>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={() => setShowDownloadModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AnswerSheetGenerator;

