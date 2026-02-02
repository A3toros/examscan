import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Input } from '../ui';
import { motion } from 'framer-motion';

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Grammar Drag Fill Component
interface GrammarDragFillProps {
  question: GrammarQuestion;
  answer: string;
  onAnswer: (answer: string) => void;
}

const GrammarDragFill: React.FC<GrammarDragFillProps> = ({ question, answer, onAnswer }) => {
  const { t } = useTranslation();
  const [draggedWord, setDraggedWord] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Shuffle words once when question changes (question.id is the key dependency)
  const shuffledWords = useMemo(() => {
    if (!question.words || question.words.length === 0) return [];
    // Always shuffle when question changes
    return shuffleArray([...question.words]);
  }, [question.id]); // Only depend on question ID - shuffle once per question

  // Split the prompt into parts, looking for ___ as placeholder
  const promptParts = question.prompt.split('___');

  const handleDragStart = (word: string) => {
    setDraggedWord(word);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedWord) {
      onAnswer(draggedWord);
      setDraggedWord(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Touch handlers for mobile support
  const handleTouchStart = (word: string) => {
    setDraggedWord(word);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Prevent scrolling while dragging
    e.preventDefault();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (draggedWord && isDragging) {
      // Check if touch ended over the drop zone
      const touch = e.changedTouches[0];
      const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);

      // Check if the element is the tap zone or its children
      if (elementAtPoint && (
        elementAtPoint.classList.contains('tap-zone') ||
        elementAtPoint.closest('.tap-zone')
      )) {
        onAnswer(draggedWord);
      }
    }

    setDraggedWord(null);
    setIsDragging(false);
  };

  const clearAnswer = () => {
    onAnswer('');
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-center mb-6">
        {t('evaluation.dragWordsToComplete', 'Complete the sentence')}
      </h3>

      {/* Sentence with drop zone */}
      <div className="text-center text-lg mb-6 p-4 bg-gray-50 rounded-lg">
        {promptParts[0]}
        <span
          className={`tap-zone inline-block mx-2 px-4 py-2 min-w-[120px] border-2 border-dashed rounded ${
            answer ? 'border-green-400 bg-green-50' : 'border-gray-300'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onTouchEnd={handleTouchEnd}
        >
          {answer || t('evaluation.dropHere', 'Tap here')}
        </span>
        {promptParts[1]}
        {answer && (
          <Button
            onClick={clearAnswer}
            variant="secondary"
            size="sm"
            className="ml-2"
          >
            ✕
          </Button>
        )}
      </div>

      {/* Word bank */}
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-3">
          {t('evaluation.dragWordToBlank', 'Tap on correct word below, then tap on drop zone')}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {shuffledWords.map((word, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => handleDragStart(word)}
              onTouchStart={() => handleTouchStart(word)}
              onTouchMove={handleTouchMove}
              className={`px-4 py-2 bg-blue-100 border border-blue-300 rounded-lg cursor-move hover:bg-blue-200 transition-colors transform hover:scale-105 active:scale-95 select-none touch-manipulation ${
                draggedWord === word ? 'opacity-50 scale-95' : ''
              }`}
              style={{
                touchAction: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none'
              }}
            >
              {word}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface GrammarQuestion {
  id: string;
  type: 'dropdown' | 'fill_blank' | 'drag_fill';
  prompt: string;
  options?: string[];
  words?: string[]; // For drag_fill type
  correct: string;
  level: string;
}

interface GrammarTestProps {
  questions: GrammarQuestion[];
  onComplete: (results: {
    score: number;
    maxScore: number;
    percentage: number;
    answers: Record<string, string>;
    timeSpent: number;
  }) => void;
}

const GrammarTest: React.FC<GrammarTestProps> = ({ questions, onComplete }) => {
  const { t } = useTranslation();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startTime] = useState(Date.now());
  const hasCalledOnCompleteRef = useRef<Set<string>>(new Set());

  // Ensure questions is an array
  const safeQuestions = Array.isArray(questions) ? questions : [];
  console.log('GrammarTest render:', { questions, safeQuestions, currentQuestion });

  const handleAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  }, []);

  const handleNext = useCallback(() => {
    if (currentQuestion < safeQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate results
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      let correctAnswers = 0;

      safeQuestions.forEach(question => {
        const userAnswer = answers[question.id];
        if (userAnswer === question.correct) {
          correctAnswers++;
        }
      });

      const percentage = safeQuestions.length > 0 ? Math.round((correctAnswers / safeQuestions.length) * 100) : 0;

      onComplete({
        score: correctAnswers,
        maxScore: safeQuestions.length,
        percentage,
        answers,
        timeSpent
      });
    }
  }, [currentQuestion, safeQuestions, answers, startTime, onComplete]);

  const question = safeQuestions[currentQuestion];
  
  // Shuffle options for dropdown questions
  // Shuffle once per question (when question.id changes)
  const shuffledQuestion = useMemo(() => {
    if (!question) return null;
    
    if (question.type === 'dropdown' && question.options && question.options.length > 0) {
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

  const renderQuestion = (question: GrammarQuestion) => {
    // Use shuffled question if available, otherwise use original
    const displayQuestion = shuffledQuestion || question;
    
    switch (question.type) {
      case 'dropdown':
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

      case 'fill_blank':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-center mb-6">
              {question.prompt}
            </h3>
            <div className="max-w-md mx-auto">
              <Input
                placeholder={t('evaluation.typeYourAnswer', 'Type your answer')}
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                className="w-full text-center text-lg"
              />
            </div>
          </div>
        );

      case 'drag_fill':
        return (
          <GrammarDragFill
            question={question}
            answer={answers[question.id] || ''}
            onAnswer={(answer) => handleAnswer(question.id, answer)}
          />
        );

      default:
        return <div>Unknown question type</div>;
    }
  };

  // Consider answered if answer exists and is not empty string
  const isAnswered = question ? (answers[question.id] !== undefined && answers[question.id] !== '' && String(answers[question.id]).trim() !== '') : false;

  // For single question (evaluation context), call onComplete when answered to enable Next button
  useEffect(() => {
    if (safeQuestions.length === 1 && question && isAnswered && !hasCalledOnCompleteRef.current.has(question.id)) {
      const userAnswer = answers[question.id];
      if (userAnswer && userAnswer !== '') {
        hasCalledOnCompleteRef.current.add(question.id);
        
        const isCorrect = userAnswer === question.correct;
        onComplete({
          score: isCorrect ? 1 : 0,
          maxScore: 1,
          percentage: isCorrect ? 100 : 0,
          answers: { [question.id]: userAnswer },
          timeSpent: Math.round((Date.now() - startTime) / 1000)
        });
      }
    }
  }, [safeQuestions.length, question?.id, isAnswered, answers, question, onComplete, startTime]);

  return (
    <motion.div
      {...({ className: "max-w-4xl mx-auto" } as any)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">
              {t('evaluation.grammarTest', 'Grammar Test')}
            </h2>
            <div className="text-sm text-gray-500">
              {t('evaluation.question', 'Question')} {currentQuestion + 1} / {safeQuestions.length}
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="min-h-[400px] flex items-center justify-center">
            {question ? renderQuestion(question) : (
              <div className="text-center text-red-500">
                <p>{t('evaluation.noQuestions', 'No questions available')}</p>
                <p className="text-sm mt-2">Questions: {JSON.stringify(safeQuestions)}</p>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {isAnswered && (
                <span className="text-green-600">
                  ✓ {t('evaluation.answered', 'Answered')}
                </span>
              )}
            </div>

            {/* Only show Next button if there are multiple questions */}
            {safeQuestions.length > 1 && currentQuestion < safeQuestions.length - 1 && (
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
    </motion.div>
  );
};

export default GrammarTest;
