import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button } from '../ui';

interface ListeningTestProps {
  onComplete: (results: any) => void;
}

// Sample listening test content
const listeningTestContent = {
  audioDescription: 'Listen to a conversation between two friends discussing their weekend plans.',
  transcript: 'Anna: What did you do last weekend?\nTom: I went to the park with my family. We had a picnic and played games.\nAnna: That sounds fun! Did you take any photos?\nTom: Yes, I took many photos of my little sister playing.\nAnna: I went shopping and bought new clothes.\nTom: Shopping is always nice. What did you buy?\nAnna: I bought a red dress and black shoes.',
  questions: [
    {
      id: 'q1',
      question: 'Where did Tom go last weekend?',
      options: [
        'To the cinema',
        'To the park',
        'Shopping',
        'To a restaurant'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      question: 'What did Tom do at the park?',
      options: [
        'Played games and had a picnic',
        'Went shopping',
        'Took photos only',
        'Played with friends'
      ],
      correctAnswer: 0
    },
    {
      id: 'q3',
      question: 'What did Anna buy?',
      options: [
        'A red dress and shoes',
        'Only a dress',
        'Only shoes',
        'A hat and sunglasses'
      ],
      correctAnswer: 0
    }
  ]
};

const ListeningTest: React.FC<ListeningTestProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<{[key: string]: number}>({});
  const [showTranscript, setShowTranscript] = useState(false);
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
    const total = listeningTestContent.questions.length;

    listeningTestContent.questions.forEach(question => {
      if (answers[question.id] === question.correctAnswer) {
        correct++;
      }
    });

    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    onComplete({
      testType: 'listening',
      score: correct,
      maxScore: total,
      percentage: Math.round((correct / total) * 100),
      answers,
      timeSpent,
      completedAt: new Date().toISOString()
    });
  }, [answers, startTime, onComplete]);

  const answeredQuestions = Object.keys(answers).length;
  const totalQuestions = listeningTestContent.questions.length;
  const isComplete = answeredQuestions === totalQuestions;

  return (
    <Card>
      <Card.Header>
        <h3 className="text-xl font-semibold">{t('evaluation.listening.title', 'Listening Comprehension')}</h3>
        <p className="text-sm text-neutral-600">
          {t('evaluation.listening.instructions', 'Listen to the audio and answer the questions.')}
        </p>
      </Card.Header>
      <Card.Body>
        {/* Audio Section */}
        <div className="mb-6 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
          <h4 className="font-semibold text-purple-800 mb-3">
            🎧 {t('evaluation.listening.audioDescription', 'Audio Description')}:
          </h4>
          <p className="text-purple-900 mb-4">{listeningTestContent.audioDescription}</p>

          {/* Audio Player (Placeholder - in real app would be actual audio) */}
          <div className="bg-white p-4 rounded-lg border border-purple-300">
            <div className="flex items-center space-x-4">
              <button className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center hover:bg-purple-600">
                ▶️
              </button>
              <div className="flex-1">
                <div className="text-sm font-medium text-purple-800">Sample Conversation</div>
                <div className="text-xs text-purple-600">Duration: 45 seconds</div>
                <div className="mt-2 bg-purple-200 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full w-1/3"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 text-sm text-purple-700">
            <strong>{t('evaluation.listening.note', 'Note')}:</strong> {t('evaluation.listening.noteText', 'In a real evaluation, you would listen to actual audio. For this demo, you can proceed to answer the questions.')}
          </div>

          {/* Show Transcript Button */}
          <div className="mt-3">
            <Button
              onClick={() => setShowTranscript(!showTranscript)}
              variant="secondary"
              size="sm"
            >
              {showTranscript
                ? t('evaluation.listening.hideTranscript', 'Hide Transcript')
                : t('evaluation.listening.showTranscript', 'Show Transcript (for demo)')
              }
            </Button>
          </div>

          {/* Transcript */}
          {showTranscript && (
            <div className="mt-3 p-3 bg-white rounded border text-sm text-purple-800">
              <strong>{t('evaluation.listening.transcript', 'Transcript')}:</strong>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{listeningTestContent.transcript}</pre>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-neutral-600 mb-1">
            <span>{t('evaluation.questionsAnswered', 'Questions Answered')}</span>
            <span>{answeredQuestions}/{totalQuestions}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(answeredQuestions / totalQuestions) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {listeningTestContent.questions.map((question, index) => (
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
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <span className={`font-bold mr-3 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`}>
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
              ? t('evaluation.completeListening', 'Complete Listening Test')
              : t('evaluation.answerAllQuestions', 'Answer all questions to continue')
            }
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default ListeningTest;
