import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button } from '../ui';
import VocabularyTest from './VocabularyTest';
import GrammarTest from './GrammarTest';
import SpeakingTest from './SpeakingTest';

interface EvaluationTestProps {
  testType: 'vocabulary' | 'grammar' | 'speaking';
  questions?: any[];
  onComplete: (results: any) => void;
  onCancel: () => void;
}

const EvaluationTest: React.FC<EvaluationTestProps> = ({ testType, questions, onComplete, onCancel }) => {
  const { t } = useTranslation();

  // Debug logging
  console.log('EvaluationTest render:', { testType, questions, questionsType: typeof questions, questionsKeys: questions && typeof questions === 'object' ? Object.keys(questions) : 'not object' });

  const handleTestComplete = useCallback((results: any) => {
    console.log(`Evaluation test ${testType} completed:`, results);
    onComplete(results);
  }, [testType, onComplete]);

  const renderTestComponent = () => {
    // Ensure questions is an array for vocabulary and grammar tests
    const safeQuestions = Array.isArray(questions) ? questions : [];

    // Warn if questions is not an array when it should be
    if ((testType === 'vocabulary' || testType === 'grammar') && !Array.isArray(questions)) {
      console.error('EvaluationTest: questions prop is not an array!', {
        testType,
        questions,
        questionsType: typeof questions,
        questionsKeys: questions && typeof questions === 'object' ? Object.keys(questions) : 'not object'
      });
    }

    switch (testType) {
      case 'vocabulary':
        return <VocabularyTest questions={safeQuestions} onComplete={handleTestComplete} />;
      case 'grammar':
        return <GrammarTest questions={safeQuestions} onComplete={handleTestComplete} />;
      case 'speaking':
        return <SpeakingTest onComplete={handleTestComplete} />;
      default:
        return (
          <Card>
            <Card.Body>
              <p className="text-center text-red-500">
                Unknown test type: {testType}
              </p>
            </Card.Body>
          </Card>
        );
    }
  };

  return (
    <div>
      {renderTestComponent()}

      {/* Cancel button */}
      <div className="mt-6 text-center">
        <Button onClick={onCancel} variant="secondary">
          {t('evaluation.cancel', 'Cancel Evaluation')}
        </Button>
      </div>
    </div>
  );
};

export default EvaluationTest;
