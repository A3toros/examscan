import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Input } from '../ui';
import { motion } from 'framer-motion';
import VocabularyMatchingDrag from '../lesson/activities/VocabularyMatchingDrag';

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

interface VocabularyQuestion {
  id: string;
  type: 'multiple_choice' | 'drag_match' | 'fill_blank';
  prompt: string;
  options?: string[];
  correct: string;
  pairs?: { word: string; match: string }[];
  level: string;
}

interface VocabularyTestProps {
  questions: VocabularyQuestion[];
  onComplete: (results: {
    score: number;
    maxScore: number;
    percentage: number;
    answers: Record<string, string>;
    timeSpent: number;
  }) => void;
}

const VocabularyTest: React.FC<VocabularyTestProps> = ({ questions, onComplete }) => {
  const { t } = useTranslation();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set());
  const [startTime] = useState(Date.now());
  const hasCalledOnCompleteRef = useRef<Set<string>>(new Set());

  const handleAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  }, []);

  const handleNext = useCallback(() => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate results
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      let totalScore = 0;
      let totalMaxScore = 0;

      questions.forEach(question => {
        const userAnswer = answers[question.id];

        if (question.type === 'drag_match' && userAnswer?.startsWith('drag_match_')) {
          // Parse drag_match results: "drag_match_score_maxScore"
          const parts = userAnswer.split('_');
          if (parts.length >= 3) {
            totalScore += parseInt(parts[1]) || 0;
            totalMaxScore += parseInt(parts[2]) || 0;
          }
        } else if (userAnswer === question.correct) {
          totalScore++;
          totalMaxScore++;
        } else {
          totalMaxScore++;
        }
      });

      const percentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

      onComplete({
        score: totalScore,
        maxScore: totalMaxScore,
        percentage,
        answers,
        timeSpent
      });
    }
  }, [currentQuestion, questions, answers, startTime, onComplete]);

  const question = questions[currentQuestion];
  
  // Shuffle options for multiple choice and fill_blank questions
  // Shuffle once per question (when question.id changes)
  const shuffledQuestion = useMemo(() => {
    if (!question) return null;
    
    if (question.type === 'multiple_choice' || question.type === 'fill_blank') {
      if (!question.options || question.options.length === 0) return question;
      
      // Always shuffle when question changes (question.id is the key dependency)
      const shuffledOptions = shuffleArray([...question.options]);
      return {
        ...question,
        options: shuffledOptions
        // Keep original 'correct' value - we'll compare by text, not index
      };
    }
    
    return question;
  }, [question?.id]); // Only depend on question ID - shuffle once per question

  const renderQuestion = (question: VocabularyQuestion) => {
    // Use shuffled question if available, otherwise use original
    const displayQuestion = shuffledQuestion || question;
    
    switch (question.type) {
      case 'multiple_choice':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-center mb-6">
              {question.prompt}
            </h3>
            <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
              {displayQuestion.options?.map((option, index) => (
                <Button
                  key={index}
                  onClick={() => handleAnswer(question.id, option)}
                  variant={answers[question.id] === option ? 'primary' : 'secondary'}
                  className="w-full text-left p-4 h-auto"
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        );

      case 'fill_blank':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-center mb-6">
              {question.prompt}
            </h3>
            <div className="max-w-md mx-auto">
              <select
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none text-lg"
              >
                <option value="">
                  {t('evaluation.selectAnswer', 'Select an answer')}
                </option>
                {displayQuestion.options?.map((option, index) => (
                  <option key={index} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'drag_match':
        // Transform pairs to VocabularyMatchingDrag format
        const leftWords = question.pairs?.map(pair => pair.word) || [];
        const rightWords = question.pairs?.map(pair => pair.match) || [];
        // Create correct pairs mapping (assuming pairs are in correct order)
        const correctPairs = question.pairs?.map((_, index) => index) || [];

        const lessonData = {
          lessonId: '', // Not needed for evaluation
          activityOrder: 0, // Not needed for evaluation
          leftWords,
          rightWords,
          correctPairs
        };

        return (
          <div className="w-full max-w-none self-stretch">
            <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl mx-auto overflow-hidden">
              <VocabularyMatchingDrag
                lessonData={lessonData}
                onComplete={(results) => {
                  if (results) {
                    // Mark this question as completed and store results
                    setCompletedQuestions(prev => new Set(prev).add(question.id));
                    handleAnswer(question.id, `drag_match_${results.score}_${results.maxScore}`);
                  }
                  // In evaluation context, don't auto-advance - let user click Next
                }}
              />
            </div>
          </div>
        );

      default:
        return <div>Unknown question type</div>;
    }
  };

  // Check if question is answered - for drag_match, check completedQuestions; for others, check answers
  const isAnswered = question ? (
    answers[question.id] !== undefined && answers[question.id] !== '' && answers[question.id] !== null
  ) || completedQuestions.has(question.id) : false;

  // For single question (evaluation context), call onComplete when answered to enable Next button
  useEffect(() => {
    if (questions.length === 1 && question && isAnswered && !hasCalledOnCompleteRef.current.has(question.id)) {
      const userAnswer = answers[question.id];
      if (userAnswer && userAnswer !== '') {
        hasCalledOnCompleteRef.current.add(question.id);
        
        let score = 0;
        let maxScore = 1;
        
        if (question.type === 'drag_match' && userAnswer.startsWith('drag_match_')) {
          // Parse "drag_match_score_maxScore" format
          const parts = userAnswer.split('_');
          if (parts.length >= 4) {
            // parts[0] = "drag", parts[1] = "match", parts[2] = score, parts[3] = maxScore
            score = parseInt(parts[2]) || 0;
            maxScore = parseInt(parts[3]) || 1;
          }
        } else if (userAnswer === question.correct) {
          score = 1;
          maxScore = 1;
        }
        
        onComplete({
          score,
          maxScore,
          percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
          answers: { [question.id]: userAnswer },
          timeSpent: Math.round((Date.now() - startTime) / 1000)
        });
      }
    }
  }, [questions.length, question?.id, isAnswered, answers, question, onComplete, startTime]);

  // For drag_match questions, VocabularyMatchingDrag provides its own Card
  const isDragMatch = question?.type === 'drag_match';

  return (
    <motion.div
      {...({ className: "max-w-4xl mx-auto" } as any)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {isDragMatch ? (
        <div className="w-full">
          <div className="min-h-[400px] flex items-center justify-center">
            {renderQuestion(question)}
          </div>

          <div className="mt-8 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {isAnswered && (
                <span className="text-green-600">
                  ✓ {t('evaluation.answered', 'Answered')}
                </span>
              )}
            </div>

            {currentQuestion < questions.length - 1 && (
              <Button
                onClick={handleNext}
                disabled={!isAnswered}
                size="lg"
              >
                {t('evaluation.next', 'Next')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <Card.Header>
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">
                {t('evaluation.vocabularyTest', 'Vocabulary Test')}
              </h2>
              <div className="text-sm text-gray-500">
                {t('evaluation.question', 'Question')} {currentQuestion + 1} / {questions.length}
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="min-h-[400px] flex items-center justify-center">
              {renderQuestion(question)}
            </div>

            <div className="mt-8 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {isAnswered && (
                  <span className="text-green-600">
                    ✓ {t('evaluation.answered', 'Answered')}
                  </span>
                )}
              </div>

              {currentQuestion < questions.length - 1 && (
                <Button
                  onClick={handleNext}
                  disabled={!isAnswered}
                  size="lg"
                >
                  {t('evaluation.next', 'Next')}
                </Button>
              )}
            </div>
          </Card.Body>
        </Card>
      )}
    </motion.div>
  );
};

export default VocabularyTest;
