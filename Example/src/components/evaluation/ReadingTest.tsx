import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button } from '../ui';

interface ReadingTestProps {
  onComplete: (results: any) => void;
}

// Sample reading test content
const readingTestContent = {
  passage: `English is spoken by millions of people around the world. It is the official language in many countries and is used for business, education, and international communication. Learning English can open many doors and create new opportunities.

There are different levels of English proficiency. Beginners start with basic words and simple sentences. Intermediate learners can have conversations about daily topics. Advanced speakers can understand complex texts and express sophisticated ideas.

The best way to learn English is through practice. Reading books, watching movies, and speaking with native speakers all help improve language skills. Regular practice leads to better understanding and fluency.`,
  questions: [
    {
      id: 'q1',
      question: 'What is English used for according to the passage?',
      options: [
        'Only for business',
        'Business, education, and international communication',
        'Only for education',
        'Only for travel'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      question: 'How many levels of English proficiency does the passage mention?',
      options: ['1', '2', '3', '4'],
      correctAnswer: 2
    },
    {
      id: 'q3',
      question: 'What does the passage recommend for learning English?',
      options: [
        'Only reading books',
        'Only watching movies',
        'Regular practice including reading, watching, and speaking',
        'Only speaking with native speakers'
      ],
      correctAnswer: 2
    }
  ]
};

const ReadingTest: React.FC<ReadingTestProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<{[key: string]: number}>({});
  const [startTime] = useState(Date.now());

  const handleAnswerSelect = useCallback((questionId: string, answerIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }));
  }, []);

  const handleComplete = useCallback(() => {
    // Calculate score
    let correct = 0;
    const total = readingTestContent.questions.length;

    readingTestContent.questions.forEach(question => {
      if (answers[question.id] === question.correctAnswer) {
        correct++;
      }
    });

    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    onComplete({
      testType: 'reading',
      score: correct,
      maxScore: total,
      percentage: Math.round((correct / total) * 100),
      answers,
      timeSpent,
      completedAt: new Date().toISOString()
    });
  }, [answers, startTime, onComplete]);

  const answeredQuestions = Object.keys(answers).length;
  const totalQuestions = readingTestContent.questions.length;
  const isComplete = answeredQuestions === totalQuestions;

  return (
    <Card>
      <Card.Header>
        <h3 className="text-xl font-semibold">{t('evaluation.reading.title', 'Reading Comprehension')}</h3>
        <p className="text-sm text-neutral-600">
          {t('evaluation.reading.instructions', 'Read the passage below and answer the questions.')}
        </p>
      </Card.Header>
      <Card.Body>
        {/* Reading Passage */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-3">{t('evaluation.reading.passage', 'Reading Passage')}:</h4>
          <div className="text-blue-900 leading-relaxed whitespace-pre-line">
            {readingTestContent.passage}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-neutral-600 mb-1">
            <span>{t('evaluation.questionsAnswered', 'Questions Answered')}</span>
            <span>{answeredQuestions}/{totalQuestions}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(answeredQuestions / totalQuestions) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {readingTestContent.questions.map((question, index) => (
            <div key={question.id} className="p-4 border border-gray-200 rounded-lg">
              <h5 className="font-medium mb-3">
                {index + 1}. {question.question}
              </h5>

              <div className="space-y-2">
                {question.options.map((option, optionIndex) => {
                  const isSelected = answers[question.id] === optionIndex;
                  return (
                    <button
                      key={optionIndex}
                      onClick={() => handleAnswerSelect(question.id, optionIndex)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <span className={`font-bold mr-3 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                        {String.fromCharCode(65 + optionIndex)}.
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Complete Button */}
        <div className="mt-8 text-center">
          <Button
            onClick={handleComplete}
            disabled={!isComplete}
            size="lg"
            className={isComplete ? 'bg-green-500 hover:bg-green-600' : ''}
          >
            {isComplete
              ? t('evaluation.completeReading', 'Complete Reading Test')
              : t('evaluation.answerAllQuestions', 'Answer all questions to continue')
            }
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default ReadingTest;
