import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Save, Download, Printer, Settings, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType } from 'docx';
import { getCurrentToken } from '../../utils/auth';

interface TestSection {
  id: string;
  type: 'mc' | 'tf';
  count: number;
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
  const [exam, setExam] = useState<ExamForm>({
    name: '',
    description: '',
    testStructure: [],
    answerKey: {},
    studentInfo: {
      name: true,
      last_name: true,
      nickname: false,
      class: true,
      student_id: false,
      student_id_digits: 6
    }
  });

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Add a new test section
  const addTestSection = (type: 'mc' | 'tf') => {
    const newSection: TestSection = {
      id: `section-${Date.now()}`,
      type,
      count: 5 // Default count
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
      const token = getCurrentToken();
      if (!token) {
        alert('Please log in first');
        return;
      }

      const response = await fetch('/.netlify/functions/exams', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: exam.name,
          description: exam.description,
          testStructure: exam.testStructure.map(section => ({
            type: section.type,
            count: section.count
          })),
          answerKey: exam.answerKey,
          studentInfo: exam.studentInfo
        })
      });

      if (response.ok) {
        alert('Exam saved successfully!');
        // Reset form
        setExam({
          name: '',
          description: '',
          testStructure: [],
          answerKey: {},
          studentInfo: {
            name: true,
            last_name: true,
            nickname: false,
            class: true,
            student_id: false,
            student_id_digits: 6
          }
        });
        setExpandedSections(new Set());
      } else {
        const errorData = await response.json();
        alert(`Failed to save exam: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving exam:', error);
      alert('Failed to save exam. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate and download PDF
  const downloadPDF = async () => {
    setShowDownloadModal(false);

    try {
      const pdf = new jsPDF();

      // Set up the document
      pdf.setFontSize(20);
      pdf.text(exam.name, 20, 30);

      if (exam.description) {
        pdf.setFontSize(12);
        pdf.text(exam.description, 20, 45);
      }

      // Instructions
      pdf.setFontSize(14);
      pdf.text('Answer Sheet Instructions:', 20, 70);
      pdf.setFontSize(10);
      pdf.text('• Fill in the bubbles completely with a dark pencil or pen', 20, 85);
      pdf.text('• Make sure your marks are within the circles', 20, 95);
      pdf.text('• Erase completely if you need to change an answer', 20, 105);

      let yPosition = 125;

      // Student Information Header
      const studentFields = [];
      if (exam.studentInfo.name) studentFields.push('Name: ____________________');
      if (exam.studentInfo.last_name) studentFields.push('Last Name: ____________________');
      if (exam.studentInfo.nickname) studentFields.push('Nickname: ____________________');
      if (exam.studentInfo.class) studentFields.push('Class: ____________________');

      if (studentFields.length > 0) {
        pdf.setFontSize(12);
        pdf.text('Student Information:', 20, yPosition);
        yPosition += 15;

        pdf.setFontSize(10);
        studentFields.forEach(field => {
          pdf.text(field, 30, yPosition);
          yPosition += 12;
        });
        yPosition += 15;
      }

      // Student ID Section
      if (exam.studentInfo.student_id) {
        pdf.setFontSize(12);
        pdf.text('Student ID:', 20, yPosition);
        yPosition += 15;

        pdf.setFontSize(10);
        pdf.text('Write your student ID number in the squares below:', 30, yPosition);
        yPosition += 15;

        // Draw student ID squares
        const squareSize = 12;
        const squaresPerRow = 10;
        const squareSpacing = 2;
        const startX = 30;

        for (let i = 0; i < exam.studentInfo.student_id_digits; i++) {
          const row = Math.floor(i / squaresPerRow);
          const col = i % squaresPerRow;
          const x = startX + (col * (squareSize + squareSpacing));
          const y = yPosition + (row * (squareSize + squareSpacing + 5));

          // Draw square
          pdf.rect(x, y, squareSize, squareSize);

          // Add number label below square
          pdf.setFontSize(8);
          pdf.text((i + 1).toString(), x + squareSize/2 - 1, y + squareSize + 4);
        }

        yPosition += Math.ceil(exam.studentInfo.student_id_digits / squaresPerRow) * (squareSize + squareSpacing + 10) + 15;
      }
      let questionNumber = 1;

      // Generate answer bubbles for each test section
      exam.testStructure.forEach(section => {
        // Section header
        if (yPosition > 200) {
          pdf.addPage();
          yPosition = 30;
        }

        pdf.setFontSize(14);
        const sectionType = section.type === 'mc' ? 'Multiple Choice' : 'True/False';
        pdf.text(`${sectionType} Questions (${section.count} questions)`, 20, yPosition);
        yPosition += 15;

        // Generate bubbles for each question in this section
        for (let i = 0; i < section.count; i++) {
          if (yPosition > 250) { // New page if needed
            pdf.addPage();
            yPosition = 30;
          }

          // Question number
          pdf.setFontSize(12);
          pdf.text(`Question ${questionNumber}`, 20, yPosition);

          // Draw bubbles
          const bubbleY = yPosition + 10;
          const options = section.type === 'mc' ? ['A', 'B', 'C', 'D'] : ['T', 'F'];

          options.forEach((option, optionIndex) => {
            const x = 40 + (optionIndex * 25);
            // Draw circle
            pdf.circle(x, bubbleY, 4, 'stroke');
            // Option label
            pdf.setFontSize(8);
            pdf.text(option, x - 2, bubbleY + 8);
          });

          yPosition += 25;
          questionNumber++;
        }

        yPosition += 10; // Space between sections
      });

      // Save the PDF
      pdf.save(`${exam.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_answer_sheet.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
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
                          children: (section.type === 'mc' ? ['A', 'B', 'C', 'D'] : ['True', 'False']).map(option =>
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
                            {(section.type === 'mc' ? ['A', 'B', 'C', 'D'] : ['T', 'F']).map(option => (
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Answer Sheet Constructor</h1>
        <p className="text-gray-600">Create custom answer sheets with multiple choice and true/false questions</p>
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
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>

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

