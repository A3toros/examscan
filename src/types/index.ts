// Core types for ExamScan
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'teacher';
}

export interface Template {
  id: string;
  name: string;
  teacher_id: string;
  template_data: any;
  question_types: QuestionType[];
  created_at: string;
}

export interface QuestionType {
  question_number: number;
  type: 'mc' | 'tf';
}

export interface ScanResult {
  id: string;
  template_id: string;
  student_id: string;
  scanned_answers: Record<number, string>;
  score: number;
  total_questions: number;
  scanned_at: string;
}

export interface AnswerSheetData {
  templateId: string;
  studentId: string;
  answers: Record<number, string>;
  score: number;
  totalQuestions: number;
}

export type ModalType = 'loading' | 'notification' | 'confirm' | 'camera' | 'results';

export interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title?: string;
  message?: string;
  data?: any;
}
