export interface CEFRMapping {
  min: number;
  max: number;
  level: string;
}

export interface EvaluationQuestion {
  id: string;
  type: 'multiple_choice' | 'dropdown' | 'fill_blank' | 'drag_fill' | 'drag_match' | 'speaking';
  prompt: string;
  options?: string[];
  words?: string[]; // For drag_fill type
  correct: string;
  pairs?: { word: string; match: string }[];
  level: string;
  audio?: string;
}

export interface EvaluationSection {
  id: 'vocabulary' | 'grammar' | 'listening' | 'speaking';
  questionCount: number;
  questions: EvaluationQuestion[];
  scoring?: {
    pronunciation?: number;
    grammarAccuracy?: number;
    vocabularyRange?: number;
    fluency?: number;
  };
}

export interface EvaluationConfig {
  testId: string;
  targetDurationMinutes: number;
  cefrMapping: CEFRMapping[];
  scoringWeights: {
    vocabulary: number;
    grammar: number;
    listening: number;
    speaking: number;
  };
  sections: EvaluationSection[];
}

// CEFR Level mapping based on total score percentage
export const CEFR_MAPPING: CEFRMapping[] = [
  { min: 0, max: 19, level: 'Pre-A1' },
  { min: 20, max: 39, level: 'A1' },
  { min: 40, max: 59, level: 'A2' },
  { min: 60, max: 69, level: 'B1' },
  { min: 70, max: 79, level: 'B2' },
  { min: 80, max: 89, level: 'C1' },
  { min: 90, max: 100, level: 'C2' }
];

// NOTE: Evaluation test configuration is now loaded from the database
// via the get-evaluation-test API endpoint. This file contains only
// the CEFR mapping and utility functions. Test questions are managed
// through the admin panel and stored in the evaluation_test table.

// Function to calculate CEFR level from total percentage
export function calculateCEFRLevel(percentage: number): string {
  const mapping = CEFR_MAPPING.find(range => percentage >= range.min && percentage <= range.max);
  return mapping?.level || 'A1';
}

// Convert CEFR level to numeric value for comparison
const CEFR_LEVEL_VALUES: Record<string, number> = {
  'Pre-A1': 0,
  'A1': 1,
  'A2': 2,
  'B1': 3,
  'B2': 4,
  'C1': 5,
  'C2': 6
};

// Convert numeric value back to CEFR level
const CEFR_VALUES_TO_LEVEL: Record<number, string> = {
  0: 'Pre-A1',
  1: 'A1',
  2: 'A2',
  3: 'B1',
  4: 'B2',
  5: 'C1',
  6: 'C2'
};

// Function to calculate overall score using 70/30 weighting
// Speaking score = 70%, Grammar test score = 30%
export function calculateOverallScore(speakingPercentage: number, grammarPercentage: number): number {
  return (speakingPercentage * 0.7) + (grammarPercentage * 0.3);
}

// Function to calculate CEFR level from speaking and grammar percentages
export function calculateLevelFromScores(speakingPercentage: number, grammarPercentage: number): string {
  const overallPercentage = calculateOverallScore(speakingPercentage, grammarPercentage);
  return calculateCEFRLevel(overallPercentage);
}

// NOTE: getQuestionsForTest function removed - questions are now loaded from database
// via get-evaluation-test API endpoint
