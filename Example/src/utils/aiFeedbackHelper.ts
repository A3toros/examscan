import { makeAuthenticatedRequest } from './api';

export interface AIFeedbackRequest {
  type: 'speech_evaluation' | 'text_analysis' | 'similarity_check';
  content: string;
  context?: {
    prompt?: string;
    expectedAnswer?: string;
    language?: string;
    level?: string;
  };
  audioBlob?: Blob; // For speech evaluation
}

export interface AIFeedbackResponse {
  success: boolean;
  feedback: {
    score?: number;
    comments: string;
    corrections?: string[];
    suggestions?: string[];
    similarity?: number;
    grammarIssues?: Array<{
      issue: string;
      suggestion: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    vocabularyIssues?: Array<{
      word: string;
      suggestion: string;
      context: string;
    }>;
    pronunciationIssues?: Array<{
      word: string;
      expected: string;
      heard: string;
    }>;
  };
  processingTime: number;
  error?: string;
}

export interface AISimilarityRequest {
  originalText: string;
  userText: string;
  language?: string;
}

export interface AISimilarityResponse {
  success: boolean;
  similarity: number; // 0-100
  detailedAnalysis?: {
    exactMatches: number;
    partialMatches: number;
    missingWords: string[];
    extraWords: string[];
    pronunciationAccuracy?: number;
  };
  error?: string;
}

export class AIFeedbackHelper {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  // Evaluate speech input
  async evaluateSpeech(
    audioBlob: Blob,
    prompt?: string,
    language: string = 'en-US',
    level: string = 'A1'
  ): Promise<AIFeedbackResponse> {
    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('type', 'speech_evaluation');
      formData.append('language', language);
      formData.append('level', level);

      if (prompt) {
        formData.append('prompt', prompt);
      }

      const response = await fetch(`${this.baseUrl}/.netlify/functions/ai-feedback`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      return {
        ...result,
        processingTime
      };
    } catch (error) {
      console.error('Speech evaluation failed:', error);
      return {
        success: false,
        feedback: {
          comments: 'Failed to process speech. Please try again.',
          score: 0
        },
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Evaluate text input
  async evaluateText(
    text: string,
    prompt?: string,
    expectedAnswer?: string,
    language: string = 'en',
    level: string = 'A1'
  ): Promise<AIFeedbackResponse> {
    const startTime = Date.now();

    try {
      const response = await makeAuthenticatedRequest('/.netlify/functions/ai-feedback', {
        method: 'POST',
        body: JSON.stringify({
          type: 'text_analysis',
          content: text,
          context: {
            prompt,
            expectedAnswer,
            language,
            level
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      return {
        ...result,
        processingTime
      };
    } catch (error) {
      console.error('Text evaluation failed:', error);
      return {
        success: false,
        feedback: {
          comments: 'Failed to analyze text. Please try again.',
          score: 0
        },
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Check similarity between texts
  async checkSimilarity(
    originalText: string,
    userText: string,
    language: string = 'en'
  ): Promise<AISimilarityResponse> {
    try {
      const response = await makeAuthenticatedRequest('/.netlify/functions/ai-similarity', {
        method: 'POST',
        body: JSON.stringify({
          originalText,
          userText,
          language
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Similarity check failed:', error);
      return {
        success: false,
        similarity: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generic feedback request
  async getFeedback(request: AIFeedbackRequest): Promise<AIFeedbackResponse> {
    const startTime = Date.now();

    try {
      let body: FormData | string;
      const headers: Record<string, string> = {};

      if (request.audioBlob) {
        // Handle audio upload
        const formData = new FormData();
        formData.append('audio', request.audioBlob);
        formData.append('type', request.type);
        formData.append('content', request.content);

        if (request.context) {
          formData.append('context', JSON.stringify(request.context));
        }

        body = formData;
      } else {
        // Handle text request
        body = JSON.stringify(request);
        headers['Content-Type'] = 'application/json';
      }

      const response = await makeAuthenticatedRequest('/.netlify/functions/ai-feedback', {
        method: 'POST',
        headers,
        body
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      return {
        ...result,
        processingTime
      };
    } catch (error) {
      console.error('AI feedback request failed:', error);
      return {
        success: false,
        feedback: {
          comments: 'Failed to get AI feedback. Please try again.',
          score: 0
        },
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Process feedback for display
  processFeedbackForDisplay(feedback: AIFeedbackResponse['feedback']): {
    overallScore: number;
    comment: string;
    detailedFeedback: string[];
    corrections: string[];
    suggestions: string[];
  } {
    const overallScore = feedback.score || 0;
    const comment = feedback.comments || '';

    const detailedFeedback: string[] = [];

    // Add grammar feedback
    if (feedback.grammarIssues && feedback.grammarIssues.length > 0) {
      detailedFeedback.push('📝 Grammar Issues:');
      feedback.grammarIssues.forEach(issue => {
        detailedFeedback.push(`  • ${issue.issue} → ${issue.suggestion}`);
      });
    }

    // Add vocabulary feedback
    if (feedback.vocabularyIssues && feedback.vocabularyIssues.length > 0) {
      detailedFeedback.push('📚 Vocabulary Suggestions:');
      feedback.vocabularyIssues.forEach(issue => {
        detailedFeedback.push(`  • "${issue.word}" → "${issue.suggestion}"`);
      });
    }

    // Add pronunciation feedback
    if (feedback.pronunciationIssues && feedback.pronunciationIssues.length > 0) {
      detailedFeedback.push('🎤 Pronunciation:');
      feedback.pronunciationIssues.forEach(issue => {
        detailedFeedback.push(`  • "${issue.heard}" should be "${issue.expected}"`);
      });
    }

    return {
      overallScore,
      comment,
      detailedFeedback,
      corrections: feedback.corrections || [],
      suggestions: feedback.suggestions || []
    };
  }
}

// Singleton instance
let aiFeedbackHelperInstance: AIFeedbackHelper | null = null;

export const getAIFeedbackHelper = (): AIFeedbackHelper => {
  if (!aiFeedbackHelperInstance) {
    aiFeedbackHelperInstance = new AIFeedbackHelper();
  }
  return aiFeedbackHelperInstance;
};
