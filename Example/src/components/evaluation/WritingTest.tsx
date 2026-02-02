import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button } from '../ui';

interface WritingTestProps {
  onComplete: (results: any) => void;
}

// Sample writing test prompts
const writingPrompts = [
  {
    id: 'prompt1',
    prompt: 'Describe your daily routine. What time do you wake up? What activities do you do during the day?',
    minWords: 50,
    instructions: 'Write at least 50 words describing your typical day.'
  },
  {
    id: 'prompt2',
    prompt: 'If you could travel anywhere in the world, where would you go and why? Describe the place and explain your reasons.',
    minWords: 60,
    instructions: 'Write at least 60 words explaining your dream destination and why you want to go there.'
  }
];

const WritingTest: React.FC<WritingTestProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [responses, setResponses] = useState<{[key: string]: string}>({});
  const [startTime] = useState(Date.now());

  const currentPrompt = writingPrompts[currentPromptIndex];
  const currentResponse = responses[currentPrompt.id] || '';

  const handleResponseChange = useCallback((response: string) => {
    setResponses(prev => ({
      ...prev,
      [currentPrompt.id]: response
    }));
  }, [currentPrompt.id]);

  const handleNext = useCallback(() => {
    if (currentPromptIndex < writingPrompts.length - 1) {
      setCurrentPromptIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentPromptIndex, writingPrompts.length]);

  const handleComplete = useCallback(() => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    // Basic scoring based on word count and response completeness
    let totalScore = 0;
    let maxScore = 0;

    writingPrompts.forEach(prompt => {
      const response = responses[prompt.id] || '';
      const wordCount = response.trim().split(/\s+/).filter(word => word.length > 0).length;
      maxScore += 10; // Max 10 points per prompt

      // Score based on word count meeting minimum requirement
      if (wordCount >= prompt.minWords) {
        totalScore += 8; // 8 points for meeting word count
      } else if (wordCount >= prompt.minWords * 0.7) {
        totalScore += 6; // 6 points for 70% of minimum
      } else if (wordCount >= prompt.minWords * 0.5) {
        totalScore += 4; // 4 points for 50% of minimum
      } else if (response.trim().length > 0) {
        totalScore += 2; // 2 points for any attempt
      }
    });

    onComplete({
      testType: 'writing',
      score: totalScore,
      maxScore,
      percentage: Math.round((totalScore / maxScore) * 100),
      responses,
      wordCounts: writingPrompts.map(prompt => ({
        promptId: prompt.id,
        wordCount: (responses[prompt.id] || '').trim().split(/\s+/).filter(word => word.length > 0).length,
        requiredWords: prompt.minWords
      })),
      timeSpent,
      completedAt: new Date().toISOString()
    });
  }, [responses, startTime, onComplete]);

  const wordCount = currentResponse.trim().split(/\s+/).filter(word => word.length > 0).length;
  const meetsRequirement = wordCount >= currentPrompt.minWords;

  const canProceed = currentResponse.trim().length > 0;
  const allPromptsAnswered = writingPrompts.every(prompt => (responses[prompt.id] || '').trim().length > 0);

  return (
    <Card>
      <Card.Header>
        <h3 className="text-xl font-semibold">{t('evaluation.writing.title', 'Writing Skills Test')}</h3>
        <p className="text-sm text-neutral-600">
          {t('evaluation.writing.instructions', 'Write clear and complete responses to the prompts below.')}
        </p>
      </Card.Header>
      <Card.Body>
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-neutral-600 mb-2">
            <span>{t('evaluation.prompt', 'Prompt')}</span>
            <span>{currentPromptIndex + 1} of {writingPrompts.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentPromptIndex + 1) / writingPrompts.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Current Prompt */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
          <h4 className="font-semibold text-green-800 mb-2">
            {t('evaluation.writing.prompt', 'Writing Prompt')} {currentPromptIndex + 1}:
          </h4>
          <p className="text-green-900 mb-3">{currentPrompt.prompt}</p>
          <div className="text-sm text-green-700 bg-green-100 p-2 rounded">
            <strong>{t('evaluation.writing.instructions', 'Instructions')}:</strong> {currentPrompt.instructions}
          </div>
        </div>

        {/* Writing Area */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('evaluation.writing.yourResponse', 'Your Response')}:
          </label>
          <textarea
            value={currentResponse}
            onChange={(e) => handleResponseChange(e.target.value)}
            placeholder={t('evaluation.writing.startWriting', 'Start writing your response here...')}
            className="w-full h-64 p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
            style={{ minHeight: '200px' }}
          />
        </div>

        {/* Word Count Indicator */}
        <div className="mb-6 flex items-center justify-between">
          <div className={`text-sm font-medium ${meetsRequirement ? 'text-green-600' : 'text-orange-600'}`}>
            {t('evaluation.writing.wordCount', 'Word Count')}: {wordCount}
            {meetsRequirement ? ' ✓' : ` (${t('evaluation.writing.minimum', 'minimum')}: ${currentPrompt.minWords})`}
          </div>

          {!meetsRequirement && wordCount > 0 && (
            <div className="text-xs text-orange-600">
              {currentPrompt.minWords - wordCount} {t('evaluation.writing.moreWords', 'more words needed')}
            </div>
          )}
        </div>

        {/* Previous Responses Summary */}
        {Object.keys(responses).length > 0 && (
          <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <h5 className="font-medium text-blue-800 mb-2">
              {t('evaluation.writing.responsesSummary', 'Responses Summary')}:
            </h5>
            <div className="space-y-1 text-sm text-blue-700">
              {writingPrompts.map((prompt, index) => {
                const response = responses[prompt.id];
                const wordCount = response ? response.trim().split(/\s+/).filter(word => word.length > 0).length : 0;
                return (
                  <div key={prompt.id} className="flex justify-between">
                    <span>Prompt {index + 1}:</span>
                    <span className={wordCount >= prompt.minWords ? 'text-green-600' : 'text-orange-600'}>
                      {wordCount} words {wordCount >= prompt.minWords ? '✓' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-neutral-600">
            {currentPromptIndex === writingPrompts.length - 1
              ? (allPromptsAnswered
                  ? t('evaluation.readyToSubmit', 'Ready to submit your writing test')
                  : t('evaluation.completeAllPrompts', 'Complete all prompts to finish')
                )
              : (canProceed
                  ? t('evaluation.clickNext', 'Click Next to continue')
                  : t('evaluation.writeSomething', 'Write something to continue')
                )
            }
          </div>

          <Button
            onClick={handleNext}
            disabled={!canProceed}
            size="lg"
            className={canProceed ? 'bg-blue-500 hover:bg-blue-600' : ''}
          >
            {currentPromptIndex < writingPrompts.length - 1
              ? t('evaluation.nextPrompt', 'Next')
              : t('evaluation.completeWriting', 'Complete Writing Test')
            }
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default WritingTest;
