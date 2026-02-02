/**
 * Advanced OCR and Computer Vision Service for ExamScan
 * Uses OpenCV with enhanced algorithms for better accuracy
 */

declare global {
  interface Window {
    cv: any;
  }
}

export interface BubbleDetectionResult {
  questionNumber: number;
  answer: string | null;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface NumberRecognitionResult {
  square: { x: number; y: number; width: number; height: number };
  digit: number | null;
  confidence: number;
}

export interface OCRResult {
  detectedBubbles: BubbleDetectionResult[];
  recognizedNumbers: NumberRecognitionResult[];
  processingTime: number;
  imageQuality: number;
  confidence: number;
  // Dual detection results
  templateMethod?: {
    bubbles: BubbleDetectionResult[];
    confidence: number;
  };
  detectionMethod?: {
    bubbles: BubbleDetectionResult[];
    confidence: number;
  };
}

class OCRService {
  private cv: any = null;
  private isInitialized = false;
  private lastGray: any = null;
  private readonly debug = true;

  private log(stage: string, data?: Record<string, unknown>) {
    if (!this.debug) return;
    if (data) {
      try {
        console.log(`[OCR][${stage}] ${JSON.stringify(data)}`);
      } catch {
        console.log(`[OCR][${stage}]`, data);
      }
    } else {
      console.log(`[OCR][${stage}]`);
    }
  }

  /**
   * Initialize OpenCV
   */
  async initialize(): Promise<void> {
    return new Promise((resolve) => {
      if (window.cv) {
        this.cv = window.cv;
        this.isInitialized = true;
        resolve();
      } else {
        // Wait for OpenCV to load
        const checkCV = () => {
          if (window.cv) {
            this.cv = window.cv;
            this.isInitialized = true;
            resolve();
          } else {
            setTimeout(checkCV, 100);
          }
        };
        checkCV();
      }
    });
  }

  /**
   * Process an image and detect answer bubbles
   */
  async processAnswerSheet(
    imageData: ImageData | HTMLImageElement | string,
    questionTypes: { questionNumber: number; type: 'mc' | 'tf'; options?: number }[],
    layoutConfig?: {
      studentInfoEnabled?: boolean;
      studentIdEnabled?: boolean;
      studentIdDigits?: number;
    }
  ): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      const cv = this.cv;

      // Convert input to OpenCV Mat
      let mat = await this.imageDataToMat(imageData);
      this.log('input', { cols: mat.cols, rows: mat.rows });
      this.log('questionTypes', {
        count: questionTypes.length,
        summary: questionTypes.map(q => ({
          questionNumber: q.questionNumber,
          type: q.type,
          options: q.options
        }))
      });

      // Downscale only very large images (preserve detail for A4 paper)
      // A4 at 300 DPI is ~2480x3508, target template is 2100x2970
      // Only scale down if significantly larger than template
      const maxDim = 3500; // Allow up to ~3500px to preserve detail
      const width = mat.cols;
      const height = mat.rows;
      if (Math.max(width, height) > maxDim) {
        const scale = maxDim / Math.max(width, height);
        const newWidth = Math.max(1, Math.round(width * scale));
        const newHeight = Math.max(1, Math.round(height * scale));
        const resized = new cv.Mat();
        cv.resize(mat, resized, new cv.Size(newWidth, newHeight), 0, 0, cv.INTER_AREA);
        mat.delete();
        mat = resized;
        this.log('resize', { cols: mat.cols, rows: mat.rows, scale });
      }

      const analyze = async (sourceMat: any) => {
        let processedImage = await this.preprocessImage(sourceMat);

        // Try to align to template using corner markers
        const corners = this.detectCornerMarkers(processedImage);
        let alignedMat: any | null = null;
        let templateAlignmentScore: number | null = null;
        if (corners) {
          alignedMat = this.warpToTemplate(sourceMat, corners);
          if (alignedMat) {
            processedImage.delete();
            processedImage = await this.preprocessImage(alignedMat);
            const alignment = this.calculateTemplateAlignmentScore(
              processedImage,
              questionTypes,
              layoutConfig
            );
            templateAlignmentScore = alignment.score;
            this.log('template:alignment', alignment);
          } else {
            this.log('template:reject', { reason: 'aspect_ratio_mismatch' });
          }
        }

        const layout = await this.detectLayout(processedImage);
        let bubbles = await this.detectBubbles(processedImage, layout, questionTypes);
        let rawConfidence = this.calculateOverallConfidence(bubbles);

        // Run both detection methods
        let templateBubbles: BubbleDetectionResult[] = [];
        let templateConfidence = 0;
        let detectionBubbles: BubbleDetectionResult[] = [];
        let detectionConfidence = 0;

        // Method 1: Detection-based (HoughCircles + actual bubble detection) - PRIMARY METHOD
        if (alignedMat) {
          detectionBubbles = await this.detectBubblesByHoughCircles(
            processedImage,
            questionTypes,
            layoutConfig
          );
          if (detectionBubbles.length > 0) {
            detectionConfidence = this.calculateOverallConfidence(detectionBubbles);
            this.log('detection:confidence', {
              detectionConfidence: Number(detectionConfidence.toFixed(4)),
              contourConfidence: Number(rawConfidence.toFixed(4))
            });
            // Use Detection as primary if it has good confidence
            if (detectionConfidence >= rawConfidence * 0.8) {
              bubbles = detectionBubbles;
              rawConfidence = detectionConfidence;
            }
          }
        }

        // Method 2: Template-based (if aligned) - FALLBACK/COMPARISON
        if (alignedMat && (templateAlignmentScore === null || templateAlignmentScore >= 0.12)) {
          templateBubbles = await this.detectBubblesFromTemplate(
            processedImage,
            questionTypes,
            layoutConfig
          );
          if (templateBubbles.length > 0) {
            templateConfidence = this.calculateOverallConfidence(templateBubbles);
            this.log('template:confidence', {
              templateConfidence: Number(templateConfidence.toFixed(4)),
              detectionConfidence: Number(detectionConfidence.toFixed(4))
            });
            // Only use template if detection failed or has very low confidence
            if (detectionBubbles.length === 0 || detectionConfidence < 0.3) {
              if (templateConfidence >= rawConfidence) {
                bubbles = templateBubbles;
                rawConfidence = templateConfidence;
              }
            }
          }
        } else if (alignedMat) {
          this.log('template:reject', {
            reason: 'low_alignment_score',
            templateAlignmentScore
          });
        }

        // Assess quality on grayscale image, not binary processed image
        const qualitySourceMat = alignedMat || sourceMat;
        const rawQuality = await this.assessImageQuality(qualitySourceMat);

        return {
          processedImage,
          layout,
          bubbles,
          rawConfidence,
          rawQuality,
          alignedMat,
          templateAlignmentScore,
          templateBubbles,
          templateConfidence,
          detectionBubbles,
          detectionConfidence
        };
      };

      // First pass
      let result = await analyze(mat);
      this.log('analyze:first', {
        sheetBounds: !!result.layout.sheetBounds,
        isPortrait: result.layout.isPortrait,
        bubbleCount: result.bubbles.length,
        confidence: result.rawConfidence,
        imageQuality: result.rawQuality,
        templateAlignmentScore: result.templateAlignmentScore
      });

      // Portrait only: no rotation fallback
      let rotatedMat: any | null = null;

      if (!result.layout.sheetBounds) {
        console.warn('[OCR] Sheet border not detected; results may be less accurate.');
      }

      const borderFactor = result.layout.sheetBounds ? 1 : 0.8;
      const confidence = Math.max(0, Math.min(1, result.rawConfidence * borderFactor));
      const imageQuality = Math.max(0, Math.min(1, result.rawQuality * borderFactor));

      // Cleanup
      mat.delete();
      if (rotatedMat) {
        rotatedMat.delete();
      }
      if (this.lastGray) {
        this.lastGray.delete();
        this.lastGray = null;
      }
      result.processedImage.delete();
      if (result.alignedMat) {
        result.alignedMat.delete();
      }

      this.log('final', { confidence, imageQuality, detectedBubbles: result.bubbles.length });

      return {
        detectedBubbles: result.bubbles,
        recognizedNumbers: [], // TODO: Implement student ID recognition
        processingTime: Date.now() - startTime,
        imageQuality,
        confidence,
        templateMethod: result.templateBubbles && result.templateBubbles.length > 0 ? {
          bubbles: result.templateBubbles,
          confidence: result.templateConfidence
        } : undefined,
        detectionMethod: result.detectionBubbles && result.detectionBubbles.length > 0 ? {
          bubbles: result.detectionBubbles,
          confidence: result.detectionConfidence
        } : undefined
      };

    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Recognize numbers in squares (for Student ID)
   */
  async recognizeNumbersInSquares(
    imageData: ImageData,
    expectedDigits: number
  ): Promise<NumberRecognitionResult[]> {
    const cv = this.cv;

    try {
      // Convert ImageData to OpenCV Mat
      const src = cv.matFromImageData(imageData);
      this.log('studentId:input', { cols: src.cols, rows: src.rows, expectedDigits });

      // Downscale only very large images (preserve detail for Student ID recognition)
      const maxDim = 3500; // Match main OCR limit
      const width = src.cols;
      const height = src.rows;
      let working = src;
      if (Math.max(width, height) > maxDim) {
        const scale = maxDim / Math.max(width, height);
        const newWidth = Math.max(1, Math.round(width * scale));
        const newHeight = Math.max(1, Math.round(height * scale));
        const resized = new cv.Mat();
        cv.resize(src, resized, new cv.Size(newWidth, newHeight), 0, 0, cv.INTER_AREA);
        working = resized;
        this.log('studentId:resize', { cols: resized.cols, rows: resized.rows, scale });
      }

      const gray = new cv.Mat();
      const processed = new cv.Mat();

      // Convert to grayscale
      cv.cvtColor(working, gray, cv.COLOR_RGBA2GRAY);

      // Apply preprocessing for better square detection
      cv.GaussianBlur(gray, processed, new cv.Size(3, 3), 0);
      cv.adaptiveThreshold(processed, processed, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

      // Find contours
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(processed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      this.log('studentId:contours', { count: contours.size() });

      const squares: any[] = [];

      // Filter contours to find squares
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        // Filter by area (reasonable square size)
        if (area < 100 || area > 10000) continue;

        // Get bounding rectangle
        const rect = cv.boundingRect(contour);
        const aspectRatio = rect.width / rect.height;

        // Check if it's roughly square (aspect ratio between 0.8 and 1.2)
        if (aspectRatio >= 0.8 && aspectRatio <= 1.2) {
          squares.push(rect);
        }
      }

      // Sort squares by x-coordinate (left to right)
      squares.sort((a, b) => a.x - b.x);

      // Limit to expected number of digits
      const selectedSquares = squares.slice(0, expectedDigits);

      const results: NumberRecognitionResult[] = [];

      // Recognize digits in each square
      for (const square of selectedSquares) {
        const digit = await this.recognizeDigitInSquare(gray, square);
        results.push({
          square: {
            x: square.x,
            y: square.y,
            width: square.width,
            height: square.height
          },
          digit: digit.digit,
          confidence: digit.confidence
        });
      }

      // Cleanup
      if (working !== src) {
        working.delete();
      }
      src.delete();
      gray.delete();
      processed.delete();
      contours.delete();
      hierarchy.delete();

      return results;

    } catch (error) {
      console.error('Number recognition failed:', error);
      return [];
    }
  }

  /**
   * Recognize a single digit in a square
   */
  private async recognizeDigitInSquare(
    image: any,
    square: any
  ): Promise<{ digit: number | null; confidence: number }> {
    const cv = this.cv;

    try {
      // Extract the square region
      const roi = image.roi(square);

      // Prefer 7-segment style recognition to match the template digits
      const segmentResult = this.recognizeDigitBySegments(roi);
      if (segmentResult.confidence >= 0.15 || segmentResult.digit !== null) {
        roi.delete();
        return segmentResult;
      }

      // Fallback: Resize to standard size for recognition (28x28 for MNIST-like models)
      const resized = new cv.Mat();
      cv.resize(roi, resized, new cv.Size(28, 28), 0, 0, cv.INTER_LINEAR);

      // Apply threshold to get binary image
      const binary = new cv.Mat();
      cv.threshold(resized, binary, 127, 255, cv.THRESH_BINARY_INV);

      const digit = this.recognizeDigitByFeatures(binary);
      const confidence = this.calculateDigitConfidence(binary, digit);

      roi.delete();
      resized.delete();
      binary.delete();

      return { digit, confidence };

    } catch (error) {
      console.error('Digit recognition error:', error);
      return { digit: null, confidence: 0 };
    }
  }

  private recognizeDigitBySegments(roi: any): { digit: number | null; confidence: number } {
    const cv = this.cv;
    const width = roi.cols;
    const height = roi.rows;

    if (width < 10 || height < 10) {
      return { digit: null, confidence: 0 };
    }

    const blurred = new cv.Mat();
    cv.GaussianBlur(roi, blurred, new cv.Size(3, 3), 0);

    const thresh = new cv.Mat();
    cv.threshold(blurred, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

    const segmentRects = this.getSegmentRegions(width, height);
    const segmentDarkness: Record<string, number> = {};

    for (const [segment, rect] of Object.entries(segmentRects)) {
      const region = thresh.roi(rect);
      const total = rect.width * rect.height;
      const filled = cv.countNonZero(region);
      const darkness = total > 0 ? filled / total : 0;
      segmentDarkness[segment] = darkness;
      region.delete();
    }

    thresh.delete();
    blurred.delete();

    const maxDarkness = Math.max(...Object.values(segmentDarkness));
    const minDarkness = Math.min(...Object.values(segmentDarkness));
    const avgDarkness = Object.values(segmentDarkness).reduce((a, b) => a + b, 0) / Object.keys(segmentDarkness).length;
    
    // Use very low threshold - handwritten digits are faint
    // Also use weighted scoring instead of binary active/inactive
    const absoluteThreshold = 0.05; // Very low absolute threshold
    const relativeThreshold = maxDarkness * 0.15; // Lower relative threshold (15% instead of 30%)
    const activationThreshold = Math.max(absoluteThreshold, relativeThreshold);
    
    this.log('studentId:segment', {
      segments: segmentDarkness,
      activationThreshold: Number(activationThreshold.toFixed(3)),
      maxDarkness: Number(maxDarkness.toFixed(3)),
      minDarkness: Number(minDarkness.toFixed(3)),
      avgDarkness: Number(avgDarkness.toFixed(3))
    });

    if (maxDarkness < 0.03) {
      return { digit: null, confidence: 0 };
    }

    // Use weighted segments: segments with darkness > threshold are "strong", 
    // segments with darkness > threshold*0.5 are "weak"
    const strongSegments = Object.entries(segmentDarkness)
      .filter(([, darkness]) => darkness >= activationThreshold)
      .map(([segment]) => segment);
    const weakSegments = Object.entries(segmentDarkness)
      .filter(([, darkness]) => darkness >= activationThreshold * 0.5 && darkness < activationThreshold)
      .map(([segment]) => segment);
    
    // Use both strong and weak segments for matching
    const activeSegments = [...strongSegments, ...weakSegments];

    if (activeSegments.length === 0) {
      return { digit: null, confidence: 0 };
    }

    const digitSegments: Record<number, string[]> = {
      0: ['A', 'B', 'C', 'E', 'F', 'G'],
      1: ['B', 'C'],
      2: ['A', 'B', 'D', 'E', 'G'],
      3: ['A', 'B', 'C', 'D', 'G'],
      4: ['B', 'C', 'D', 'F'],
      5: ['A', 'C', 'D', 'F', 'G'],
      6: ['A', 'C', 'D', 'E', 'F', 'G'],
      7: ['A', 'B', 'C'],
      8: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      9: ['A', 'B', 'C', 'D', 'F', 'G'],
    };

    let bestDigit: number | null = null;
    let bestScore = -Infinity;
    let bestMatches = 0;
    let bestStrongMatches = 0;
    let bestWeakMatches = 0;
    const strongSet = new Set(strongSegments);
    const weakSet = new Set(weakSegments);
    const allActiveSet = new Set(activeSegments);
    const digitScores: Record<number, { score: number; matches: number; missing: number; extra: number; strongMatches: number; weakMatches: number }> = {};

    for (const [digit, segments] of Object.entries(digitSegments)) {
      const expected = new Set(segments);
      let strongMatches = 0;
      let weakMatches = 0;
      let missing = 0;
      let extra = 0;
      
      // Count matches: strong segments count more than weak
      for (const seg of expected) {
        if (strongSet.has(seg)) {
          strongMatches++;
        } else if (weakSet.has(seg)) {
          weakMatches++;
        } else {
          missing++;
        }
      }
      
      // Count extra segments (not expected) - penalize less if they're weak
      for (const seg of allActiveSet) {
        if (!expected.has(seg)) {
          if (strongSet.has(seg)) {
            extra += 1; // Strong extra segment
          } else {
            extra += 0.5; // Weak extra segment - less penalty
          }
        }
      }
      
      // Score: heavily reward strong matches, moderately reward weak matches
      // Lightly penalize missing/extra (handles partial fills and misalignment)
      const matches = strongMatches + weakMatches;
      const score = (strongMatches * 3) + (weakMatches * 1.5) - (missing * 0.15) - (extra * 0.2);
      digitScores[Number(digit)] = { score, matches, missing, extra, strongMatches, weakMatches };
      
      if (score > bestScore) {
        bestScore = score;
        bestMatches = matches;
        bestStrongMatches = strongMatches;
        bestWeakMatches = weakMatches;
        bestDigit = Number(digit);
      }
    }
    
    // Log top 3 candidates for debugging
    const sortedScores = Object.entries(digitScores)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 3);
    this.log('studentId:segment:scores', {
      strongSegments,
      weakSegments,
      activeSegments,
      topCandidates: sortedScores.map(([digit, data]) => ({
        digit: Number(digit),
        score: Number(data.score.toFixed(2)),
        strongMatches: data.strongMatches,
        weakMatches: data.weakMatches,
        totalMatches: data.matches,
        missing: data.missing,
        extra: Number(data.extra.toFixed(1))
      }))
    });

    // Require at least 1 match
    if (bestMatches < 1 || bestDigit === null) {
      return { digit: null, confidence: 0 };
    }
    
    // Confidence: base on matches and score
    // New scoring: (strongMatches * 3) + (weakMatches * 1.5) - (missing * 0.15) - (extra * 0.2)
    const expectedSegments = digitSegments[bestDigit]?.length || 7;
    // Max score: all expected segments are strong matches
    const maxPossibleScore = expectedSegments * 3;
    // Min score: all wrong (all missing, some extra)
    const minPossibleScore = -(expectedSegments * 0.15) - (expectedSegments * 0.2);
    
    // Normalize score to 0-1 range
    const scoreRange = maxPossibleScore - minPossibleScore;
    const normalizedScore = scoreRange > 0 ? Math.max(0, Math.min(1, (bestScore - minPossibleScore) / scoreRange)) : 0;
    
    // Match ratio: weight strong matches more
    const weightedMatchRatio = (bestStrongMatches * 1.0 + bestWeakMatches * 0.5) / expectedSegments;
    
    // Combine normalized score (50%) and weighted match ratio (50%)
    const confidence = Math.max(0, Math.min(1, normalizedScore * 0.5 + weightedMatchRatio * 0.5));
    
    // Return digit if confidence is reasonable (lowered threshold)
    const minConfidence = 0.05; // Lower threshold to accept more digits
    if (confidence < minConfidence && bestDigit !== null) {
      this.log('studentId:segment:lowConfidence', {
        digit: bestDigit,
        confidence: Number(confidence.toFixed(3)),
        activeSegments,
        bestScore: Number(bestScore.toFixed(2)),
        bestMatches
      });
    }
    
    return { digit: confidence >= minConfidence ? bestDigit : null, confidence };
  }

  private getSegmentRegions(width: number, height: number): Record<string, any> {
    // Make segments slightly larger and more centered to better capture handwritten digits
    const segmentThicknessX = Math.max(3, Math.round(width * 0.15)); // Increased from 0.12
    const segmentThicknessY = Math.max(3, Math.round(height * 0.15)); // Increased from 0.12
    const centerX = Math.round(width / 2);
    const topY = Math.round(height * 0.12); // Moved up slightly from 0.14
    const midY = Math.round(height * 0.50);
    const bottomY = Math.round(height * 0.88); // Moved down slightly from 0.86
    const leftX = Math.round(width * 0.08); // Moved in from 0.12
    const rightX = Math.round(width * 0.80); // Moved in from 0.76

    return {
      // Horizontal segments: wider coverage
      A: new this.cv.Rect(centerX - Math.round(width * 0.25), topY - Math.round(segmentThicknessY / 2), Math.round(width * 0.5), segmentThicknessY),
      D: new this.cv.Rect(centerX - Math.round(width * 0.25), midY - Math.round(segmentThicknessY / 2), Math.round(width * 0.5), segmentThicknessY),
      G: new this.cv.Rect(centerX - Math.round(width * 0.25), bottomY - Math.round(segmentThicknessY / 2), Math.round(width * 0.5), segmentThicknessY),
      // Vertical segments: taller coverage
      F: new this.cv.Rect(leftX, topY - Math.round(height * 0.05), segmentThicknessX, Math.round(height * 0.35)),
      B: new this.cv.Rect(rightX, topY - Math.round(height * 0.05), segmentThicknessX, Math.round(height * 0.35)),
      E: new this.cv.Rect(leftX, midY - Math.round(height * 0.05), segmentThicknessX, Math.round(height * 0.35)),
      C: new this.cv.Rect(rightX, midY - Math.round(height * 0.05), segmentThicknessX, Math.round(height * 0.35)),
    };
  }

  private calculateTemplateAlignmentScore(
    processedImage: any,
    questionTypes: { questionNumber: number; type: 'mc' | 'tf'; options?: number }[],
    layoutConfig?: {
      studentInfoEnabled?: boolean;
      studentIdEnabled?: boolean;
      studentIdDigits?: number;
    }
  ): { score: number; samples: number; averageMaxRing: number; markerDarkness: number } {
    if (!this.lastGray || !processedImage) {
      return { score: 0, samples: 0, averageMaxRing: 0, markerDarkness: 0 };
    }

    // Scale: template assumes A4 width = 210mm
    // Convert mm to pixels: 1mm = (imageWidth / 210mm) pixels
    const scale = processedImage.cols / 210; // 210mm = A4 width
    const mm = (v: number) => v * scale;
    const metrics = {
      margin: mm(20),
      questionWidth: mm((210 - 40) / 5),
      rowHeight: mm(20),
      padding: mm(2),
      totalBubbleSpacing: mm(8),
      bubbleRadius: mm(2.5),
      scale
    };

    const grid = this.buildTemplateQuestionGrid(questionTypes, metrics, layoutConfig);
    const sampleQuestions = grid.slice(0, Math.min(grid.length, 10));
    let total = 0;
    let count = 0;

    for (const question of sampleQuestions) {
      let maxRing = 0;
      for (const bubble of question.bubbleCenters) {
        const ring = this.calculateRingDarknessFromCircle(bubble.x, bubble.y, metrics.bubbleRadius);
        if (ring > maxRing) {
          maxRing = ring;
        }
      }
      total += maxRing;
      count += 1;
    }

    const averageMaxRing = count > 0 ? total / count : 0;
    const markerDarkness = this.calculateMarkerDarkness(processedImage, scale);
    const score = (averageMaxRing * 0.7) + (markerDarkness * 0.3);
    return {
      score,
      samples: count,
      averageMaxRing,
      markerDarkness
    };
  }

  private calculateMarkerDarkness(processedImage: any, scale: number): number {
    if (!this.lastGray) return 0;
    const cv = this.cv;
    // Scale is already pixels/mm (imageWidth / 210mm)
    const mm = (v: number) => v * scale;
    const markerSize = mm(12);
    const margin = mm(5);
    const regions = [
      { x: margin, y: margin },
      { x: processedImage.cols - margin - markerSize, y: margin },
      { x: margin, y: processedImage.rows - margin - markerSize },
      { x: processedImage.cols - margin - markerSize, y: processedImage.rows - margin - markerSize },
    ];

    let totalDarkness = 0;
    let count = 0;

    for (const region of regions) {
      const x = Math.max(0, Math.min(this.lastGray.cols - 1, Math.round(region.x)));
      const y = Math.max(0, Math.min(this.lastGray.rows - 1, Math.round(region.y)));
      const w = Math.max(1, Math.min(this.lastGray.cols - x, Math.round(markerSize)));
      const h = Math.max(1, Math.min(this.lastGray.rows - y, Math.round(markerSize)));
      if (w <= 1 || h <= 1) continue;
      const roi = this.lastGray.roi(new cv.Rect(x, y, w, h));
      const mean = cv.mean(roi)[0] ?? 255;
      const darkness = Math.max(0, Math.min(1, 1 - (mean / 255)));
      roi.delete();
      totalDarkness += darkness;
      count += 1;
    }

    return count > 0 ? totalDarkness / count : 0;
  }

  /**
   * Simple digit recognition using basic feature analysis
   * In production, replace with trained ML model
   */
  private recognizeDigitByFeatures(binaryImage: any): number | null {
    // This is a very basic implementation
    // Count pixels in different regions to identify digit patterns

    const width = binaryImage.cols;
    const height = binaryImage.rows;

    // Divide into 3x3 grid
    const regions = [
      [0, 0, width/3, height/3],       // top-left
      [width/3, 0, width/3, height/3], // top-center
      [2*width/3, 0, width/3, height/3], // top-right
      [0, height/3, width/3, height/3], // middle-left
      [width/3, height/3, width/3, height/3], // center
      [2*width/3, height/3, width/3, height/3], // middle-right
      [0, 2*height/3, width/3, height/3], // bottom-left
      [width/3, 2*height/3, width/3, height/3], // bottom-center
      [2*width/3, 2*height/3, width/3, height/3], // bottom-right
    ];

    const regionCounts = regions.map(([x, y, w, h]) => {
      let count = 0;
      for (let i = Math.floor(y); i < Math.floor(y + h); i++) {
        for (let j = Math.floor(x); j < Math.floor(x + w); j++) {
          if (binaryImage.ucharPtr(i, j)[0] > 127) {
            count++;
          }
        }
      }
      return count / (w * h); // Normalize by region size
    });

    // Simple pattern matching for digits 0-9
    // This is a very basic implementation - use ML model for production
    const [tl, tc, tr, ml, c, mr, bl, bc, br] = regionCounts;

    // Basic digit recognition logic
    if (tl > 0.3 && tr > 0.3 && bl > 0.3 && br > 0.3 && ml > 0.3 && mr > 0.3 && c < 0.2) return 0;
    if (tr > 0.3 && mr > 0.3 && br > 0.3) return 1;
    if (tl > 0.3 && tc > 0.3 && tr > 0.3 && ml < 0.2 && mr > 0.3 && bl > 0.3) return 2;
    if (tl > 0.3 && tc > 0.3 && tr > 0.3 && mr > 0.3 && br > 0.3 && bl > 0.3) return 3;
    if (ml > 0.3 && tc > 0.3 && tr > 0.3 && mr > 0.3) return 4;
    if (tl > 0.3 && ml > 0.3 && tc > 0.3 && tr > 0.3 && mr > 0.3 && br > 0.3) return 5;
    if (tl > 0.3 && ml > 0.3 && c > 0.3 && mr > 0.3 && br > 0.3) return 6;
    if (tl > 0.3 && tc > 0.3 && tr > 0.3 && mr > 0.3) return 7;
    if (tl > 0.3 && tc > 0.3 && tr > 0.3 && ml > 0.3 && c > 0.3 && mr > 0.3 && bl > 0.3 && bc > 0.3 && br > 0.3) return 8;
    if (tl > 0.3 && tc > 0.3 && tr > 0.3 && ml > 0.3 && c > 0.3 && mr > 0.3 && br > 0.3) return 9;

    return null; // Unrecognized
  }

  /**
   * Calculate confidence in digit recognition
   */
  private calculateDigitConfidence(binaryImage: any, digit: number | null): number {
    if (digit === null) return 0;

    // Simple confidence calculation based on image clarity
    // In production, use model confidence scores
    const totalPixels = binaryImage.rows * binaryImage.cols;
    let filledPixels = 0;

    for (let y = 0; y < binaryImage.rows; y++) {
      for (let x = 0; x < binaryImage.cols; x++) {
        if (binaryImage.ucharPtr(y, x)[0] > 127) {
          filledPixels++;
        }
      }
    }

    const fillRatio = filledPixels / totalPixels;

    // Good digits typically have 20-80% fill ratio
    if (fillRatio >= 0.2 && fillRatio <= 0.8) {
      return Math.min(fillRatio * 2, 1); // Scale to 0-1
    }

    return 0.1; // Low confidence for unusual fill ratios
  }

  /**
   * Process answer sheet with student ID recognition
   */
  async processAnswerSheetWithStudentID(
    imageData: ImageData | HTMLImageElement | string,
    questionTypes: { questionNumber: number; type: 'mc' | 'tf'; options?: number }[],
    studentIdDigits: number,
    layoutConfig?: {
      studentInfoEnabled?: boolean;
      studentIdEnabled?: boolean;
      studentIdDigits?: number;
    }
  ): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Get regular OCR results
      const ocrResult = await this.processAnswerSheet(imageData, questionTypes, layoutConfig);

      // Recognize student ID numbers
      let recognizedNumbers = await this.recognizeStudentIdFromTemplate(
        imageData,
        studentIdDigits,
        layoutConfig
      );

      if (recognizedNumbers.length === 0) {
        recognizedNumbers = await this.recognizeNumbersInSquares(
          imageData as ImageData,
          studentIdDigits
        );
      }

      return {
        ...ocrResult,
        recognizedNumbers,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('OCR processing with student ID failed:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async recognizeStudentIdFromTemplate(
    imageData: ImageData | HTMLImageElement | string,
    studentIdDigits: number,
    layoutConfig?: {
      studentInfoEnabled?: boolean;
      studentIdEnabled?: boolean;
      studentIdDigits?: number;
    }
  ): Promise<NumberRecognitionResult[]> {
    const cv = this.cv;
    const results: NumberRecognitionResult[] = [];

    try {
      let mat = await this.imageDataToMat(imageData);
      this.log('studentId:template:input', { cols: mat.cols, rows: mat.rows, studentIdDigits });

      // Preserve detail for Student ID template recognition
      const maxDim = 3500; // Match main OCR limit
      if (Math.max(mat.cols, mat.rows) > maxDim) {
        const scale = maxDim / Math.max(mat.cols, mat.rows);
        const newWidth = Math.max(1, Math.round(mat.cols * scale));
        const newHeight = Math.max(1, Math.round(mat.rows * scale));
        const resized = new cv.Mat();
        cv.resize(mat, resized, new cv.Size(newWidth, newHeight), 0, 0, cv.INTER_AREA);
        mat.delete();
        mat = resized;
        this.log('studentId:template:resize', { cols: mat.cols, rows: mat.rows, scale });
      }

      const processed = await this.preprocessImage(mat);
      const corners = this.detectCornerMarkers(processed);
      let alignedMat = mat;
      if (corners) {
        const warped = this.warpToTemplate(mat, corners);
        if (warped) {
          alignedMat = warped;
        } else {
          this.log('studentId:template:reject', { reason: 'aspect_ratio_mismatch' });
        }
      }

      const gray = new cv.Mat();
      cv.cvtColor(alignedMat, gray, cv.COLOR_RGBA2GRAY);

      // Scale: template assumes A4 width = 210mm
      const scale = alignedMat.cols / 210; // 210mm = A4 width
      const squares = this.getStudentIdTemplateSquares(scale, layoutConfig, studentIdDigits);
      this.log('studentId:template:squares', { count: squares.length, squares });

      for (const square of squares) {
        const x = Math.max(0, Math.min(gray.cols - 1, Math.round(square.x)));
        const y = Math.max(0, Math.min(gray.rows - 1, Math.round(square.y)));
        const w = Math.max(1, Math.min(gray.cols - x, Math.round(square.width)));
        const h = Math.max(1, Math.min(gray.rows - y, Math.round(square.height)));
        if (w <= 1 || h <= 1) continue;

        const digit = await this.recognizeDigitInSquare(gray, new cv.Rect(x, y, w, h));
        this.log('studentId:template:digit', {
          square: { x, y, width: w, height: h },
          digit: digit.digit,
          confidence: Number(digit.confidence.toFixed(3))
        });
        results.push({
          square: { x, y, width: w, height: h },
          digit: digit.digit,
          confidence: digit.confidence
        });
      }

      gray.delete();
      processed.delete();
      if (alignedMat !== mat) {
        alignedMat.delete();
      }
      mat.delete();
      if (this.lastGray) {
        this.lastGray.delete();
        this.lastGray = null;
      }

      return results;
    } catch (error) {
      console.error('Student ID template recognition failed:', error);
      return [];
    }
  }

  private getStudentIdTemplateSquares(
    scale: number,
    layoutConfig: {
      studentInfoEnabled?: boolean;
      studentIdEnabled?: boolean;
      studentIdDigits?: number;
    } | undefined,
    studentIdDigits: number
  ): Array<{ x: number; y: number; width: number; height: number }> {
    // Scale is already pixels/mm (imageWidth / 210mm)
    const mm = (v: number) => v * scale;
    let yPosition = mm(34); // PDF: starts at 34mm from top

    if (layoutConfig?.studentInfoEnabled !== false) {
      yPosition += mm(10); // PDF: after student info line
    }

    if (layoutConfig?.studentIdEnabled !== false) {
      yPosition += mm(8); // PDF: after "Student ID:" text (yPosition += 8)
    }

    const digits = studentIdDigits || layoutConfig?.studentIdDigits || 6;
    const squareWidth = mm(5.5); // PDF: squareWidth = 5.5
    const squareHeight = mm(7); // PDF: squareHeight = 7
    const squareSpacing = mm(1); // PDF: squareSpacing = 1
    const extraRowGap = mm(5); // PDF: +5 in row calculation
    const startX = mm(20); // PDF: startX = 20 (Dashboard) or 30 (AnswerSheetGenerator - FIXED to 20)
    const squaresPerRow = 10; // PDF: squaresPerRow = 10

    this.log('studentId:template:calc', {
      scale: Number(scale.toFixed(4)),
      initialY: Number((mm(34) / scale).toFixed(2)),
      afterStudentInfo: layoutConfig?.studentInfoEnabled !== false ? Number((mm(10) / scale).toFixed(2)) : 0,
      afterStudentIdLabel: layoutConfig?.studentIdEnabled !== false ? Number((mm(8) / scale).toFixed(2)) : 0,
      finalYmm: Number((yPosition / scale).toFixed(2)),
      startXmm: Number((startX / scale).toFixed(2)),
      squareWidthmm: Number((squareWidth / scale).toFixed(2)),
      squareHeightmm: Number((squareHeight / scale).toFixed(2)),
      digits
    });

    const squares: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (let i = 0; i < digits; i++) {
      const row = Math.floor(i / squaresPerRow);
      const col = i % squaresPerRow;
      const x = startX + (col * (squareWidth + squareSpacing));
      const y = yPosition + (row * (squareHeight + squareSpacing + extraRowGap));
      squares.push({ x, y, width: squareWidth, height: squareHeight });
    }

    return squares;
  }

  /**
   * Convert various image formats to OpenCV Mat
   */
  private async imageDataToMat(imageData: ImageData | HTMLImageElement | string): Promise<any> {
    const cv = this.cv;

    if (typeof imageData === 'string') {
      // Handle base64 string
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
          const mat = cv.matFromImageData(imageData!);
          resolve(mat);
        };
        img.onerror = reject;
        img.src = imageData;
      });
    } else if (imageData instanceof HTMLImageElement) {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(imageData, 0, 0);
      const imgData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      return cv.matFromImageData(imgData!);
    } else {
      // ImageData object
      return cv.matFromImageData(imageData);
    }
  }

  /**
   * Advanced image preprocessing with multiple techniques
   */
  private async preprocessImage(mat: any): Promise<any> {
    const cv = this.cv;

    // Convert to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    // Keep a copy for fill analysis
    if (this.lastGray) {
      this.lastGray.delete();
      this.lastGray = null;
    }
    this.lastGray = gray.clone();

    // Apply Gaussian blur to reduce noise
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);

    // Adaptive thresholding for better contrast
    const thresholded = new cv.Mat();
    cv.adaptiveThreshold(
      blurred,
      thresholded,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      11,
      2
    );

    // Enhanced morphological operations to clean up the image
    // Step 1: Remove small noise with opening
    const kernelOpen = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2));
    const opened = new cv.Mat();
    cv.morphologyEx(thresholded, opened, cv.MORPH_OPEN, kernelOpen);
    
    // Step 2: Fill small gaps with closing
    const kernelClose = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    const morphed = new cv.Mat();
    cv.morphologyEx(opened, morphed, cv.MORPH_CLOSE, kernelClose);

    // Cleanup intermediate mats
    gray.delete();
    blurred.delete();
    thresholded.delete();
    opened.delete();
    kernelOpen.delete();
    kernelClose.delete();

    return morphed;
  }

  /**
   * Detect the answer sheet layout and structure
   */
  private async detectLayout(processedImage: any): Promise<{
    questionRows: Array<{ y: number; height: number; questions: number[] }>;
    bubbleSpacing: { horizontal: number; vertical: number };
    sheetBounds: { x: number; y: number; width: number; height: number } | null;
    isPortrait: boolean;
    aspectRatio: number;
    bubbleSize: number | null;
  }> {
    const cv = this.cv;

    // Find contours to identify potential bubble areas
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
      processedImage,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    // Analyze contours to determine layout
    const boundingRects = [];
    let largestRect: { x: number; y: number; width: number; height: number } | null = null;
    let largestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const rect = cv.boundingRect(contours.get(i));
      boundingRects.push(rect);
      const area = rect.width * rect.height;
      if (area > largestArea) {
        largestArea = area;
        largestRect = rect;
      }
    }

    // Prefer bubble-like contours for layout (filters out text/lines)
    const minDim = Math.min(processedImage.rows, processedImage.cols);
    const minBubble = Math.max(6, Math.round(minDim * 0.008));
    const maxBubble = Math.max(minBubble + 4, Math.round(minDim * 0.04));
    const bubbleCandidates = boundingRects.filter((rect: any) => {
      const aspect = rect.width / rect.height;
      return rect.width >= minBubble
        && rect.height >= minBubble
        && rect.width <= maxBubble
        && rect.height <= maxBubble
        && aspect >= 0.7
        && aspect <= 1.3;
    });

    const layoutRects = bubbleCandidates.length > 0 ? bubbleCandidates : boundingRects;
    const bubbleSize = bubbleCandidates.length > 0
      ? bubbleCandidates.reduce((sum, rect) => sum + (rect.width + rect.height) / 2, 0) / bubbleCandidates.length
      : null;

    // Group contours by Y position to identify rows
    const rows = this.groupContoursByRows(layoutRects);

    // Calculate spacing based on detected layout
    const spacing = this.calculateBubbleSpacing(layoutRects);

    // Detect corner markers (L-shapes) to infer sheet bounds
    const imgWidth = processedImage.cols;
    const imgHeight = processedImage.rows;
    const minDimForMarkers = Math.min(imgWidth, imgHeight);
    const minMarker = Math.max(8, Math.round(minDimForMarkers * 0.02));
    const maxMarker = Math.max(minMarker + 6, Math.round(minDimForMarkers * 0.12));
    const cornerZone = Math.round(minDimForMarkers * 0.12);

    const cornerRects = boundingRects.filter((rect: any) => {
      const sizeOk =
        rect.width >= minMarker &&
        rect.height >= minMarker &&
        rect.width <= maxMarker &&
        rect.height <= maxMarker;
      if (!sizeOk) return false;

      const nearLeft = rect.x <= cornerZone;
      const nearRight = rect.x + rect.width >= (imgWidth - cornerZone);
      const nearTop = rect.y <= cornerZone;
      const nearBottom = rect.y + rect.height >= (imgHeight - cornerZone);

      return (nearLeft || nearRight) && (nearTop || nearBottom);
    });

    let cornerBasedBounds: { x: number; y: number; width: number; height: number } | null = null;
    if (cornerRects.length >= 2) {
      const minX = Math.min(...cornerRects.map(r => r.x));
      const minY = Math.min(...cornerRects.map(r => r.y));
      const maxX = Math.max(...cornerRects.map(r => r.x + r.width));
      const maxY = Math.max(...cornerRects.map(r => r.y + r.height));
      cornerBasedBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    // Detect sheet border by looking for a large contour
    const imageArea = processedImage.rows * processedImage.cols;
    const areaRatio = largestArea > 0 ? largestArea / imageArea : 0;
    const largeContourBounds = areaRatio >= 0.2 ? largestRect : null;

    const sheetBounds = cornerBasedBounds || largeContourBounds;
    const aspectRatio = sheetBounds
      ? sheetBounds.height / sheetBounds.width
      : processedImage.rows / processedImage.cols;
    const isPortrait = aspectRatio >= 1;

    // Cleanup
    contours.delete();
    hierarchy.delete();

    return {
      questionRows: rows,
      bubbleSpacing: spacing,
      sheetBounds,
      isPortrait,
      aspectRatio,
      bubbleSize
    };
  }

  /**
   * Group contours by Y position to identify question rows
   */
  private groupContoursByRows(rects: any[]): Array<{ y: number; height: number; questions: number[] }> {
    if (rects.length === 0) return [];

    // Sort by Y position
    rects.sort((a, b) => a.y - b.y);

    const rows: Array<{ y: number; height: number; questions: number[] }> = [];
    const rowTolerance = 20; // pixels

    rects.forEach(rect => {
      let foundRow = false;

      for (const row of rows) {
        if (Math.abs(rect.y - row.y) <= rowTolerance) {
          row.questions.push(rect.x);
          foundRow = true;
          break;
        }
      }

      if (!foundRow) {
        rows.push({
          y: rect.y,
          height: rect.height,
          questions: [rect.x]
        });
      }
    });

    // Sort questions in each row by X position
    rows.forEach(row => {
      row.questions.sort((a, b) => a - b);
    });

    return rows;
  }

  /**
   * Calculate spacing between bubbles
   */
  private calculateBubbleSpacing(rects: any[]): { horizontal: number; vertical: number } {
    if (rects.length < 2) return { horizontal: 25, vertical: 15 }; // Default spacing

    // Calculate horizontal spacing (between bubbles in same row)
    const sameRowRects = rects.filter((rect, i) =>
      rects.some((other, j) => i !== j && Math.abs(rect.y - other.y) < 10)
    );

    const horizontalSpacings = [];
    for (let i = 0; i < sameRowRects.length - 1; i++) {
      const current = sameRowRects[i];
      const next = sameRowRects[i + 1];
      if (Math.abs(current.y - next.y) < 10) {
        horizontalSpacings.push(next.x - (current.x + current.width));
      }
    }

    const avgHorizontal = horizontalSpacings.length > 0
      ? horizontalSpacings.reduce((sum, spacing) => sum + spacing, 0) / horizontalSpacings.length
      : 25;

    // Calculate vertical spacing (between rows)
    const verticalSpacings = [];
    const sortedRects = [...rects].sort((a, b) => a.y - b.y);

    for (let i = 0; i < sortedRects.length - 1; i++) {
      const current = sortedRects[i];
      const next = sortedRects[i + 1];
      if (next.y > current.y + current.height) {
        verticalSpacings.push(next.y - (current.y + current.height));
      }
    }

    const avgVertical = verticalSpacings.length > 0
      ? verticalSpacings.reduce((sum, spacing) => sum + spacing, 0) / verticalSpacings.length
      : 15;

    return {
      horizontal: Math.max(15, Math.min(50, avgHorizontal)),
      vertical: Math.max(10, Math.min(30, avgVertical))
    };
  }

  /**
   * Detect and analyze answer bubbles with enhanced algorithms
   */
  private async detectBubbles(
    processedImage: any,
    layout: any,
    questionTypes: { questionNumber: number; type: 'mc' | 'tf'; options?: number }[]
  ): Promise<BubbleDetectionResult[]> {
    // Prefer contour-based bubble detection when possible
    const contourResults = await this.detectBubblesByContours(processedImage, questionTypes);
    if (contourResults && contourResults.length > 0) {
      return contourResults;
    }

    const results: BubbleDetectionResult[] = [];

    // For each question type, detect the appropriate bubbles
    for (const questionType of questionTypes) {
      const questionResult = await this.detectQuestionBubbles(
        processedImage,
        layout,
        questionType
      );

      if (questionResult) {
        results.push(questionResult);
      }
    }

    return results;
  }

  private async detectBubblesByContours(
    processedImage: any,
    questionTypes: { questionNumber: number; type: 'mc' | 'tf'; options?: number }[]
  ): Promise<BubbleDetectionResult[] | null> {
    const cv = this.cv;
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(processedImage, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    this.log('bubbles:contours', { count: contours.size() });

    const minDim = Math.min(processedImage.rows, processedImage.cols);
    const minSize = Math.max(6, Math.round(minDim * 0.008));
    const maxSize = Math.max(minSize + 4, Math.round(minDim * 0.04));
    const minArea = Math.max(60, Math.round(minSize * minSize * 0.5));
    const maxArea = Math.max(minArea + 100, Math.round(maxSize * maxSize * 2.5));

    const bubbles: Array<{
      contour: any;
      x: number;
      y: number;
      w: number;
      h: number;
      center: { x: number; y: number };
      area: number;
    }> = [];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area < minArea || area > maxArea) continue;

      const perimeter = cv.arcLength(contour, true);
      if (perimeter === 0) continue;

      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      if (circularity < 0.6) continue;

      const rect = cv.boundingRect(contour);
      const aspect = rect.width / rect.height;
      if (aspect < 0.75 || aspect > 1.3) continue;

      bubbles.push({
        contour,
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        area
      });
    }

    if (bubbles.length < 2) {
      contours.delete();
      hierarchy.delete();
      this.log('bubbles:contoursFiltered', { bubbles: bubbles.length });
      return null;
    }

    const grid = this.sortBubblesIntoGrid(bubbles);
    if (grid.length < questionTypes.length) {
      contours.delete();
      hierarchy.delete();
      this.log('bubbles:grid', { rows: grid.length, expected: questionTypes.length });
      return null;
    }

    const fillThreshold = 0.08;
    const results: BubbleDetectionResult[] = [];

    for (let qIndex = 0; qIndex < questionTypes.length; qIndex++) {
      const row = grid[qIndex];
      if (!row || row.length === 0) {
        return null;
      }

      const qType = questionTypes[qIndex].type;
      const expectedChoices = qType === 'mc'
        ? Math.min(4, Math.max(2, Number(questionTypes[qIndex].options) || 4))
        : 2;
      if (row.length < expectedChoices) {
        return null;
      }

      const bubblesInRow = row.slice(0, expectedChoices);
      let maxFill = 0;
      let secondFill = 0;
      let selectedIndex: number | null = null;

      for (let i = 0; i < bubblesInRow.length; i++) {
        const bubble = bubblesInRow[i];
        const fillPct = this.calculateFillPercentageFromContour(processedImage, bubble.contour);
        if (fillPct > maxFill) {
          secondFill = maxFill;
          maxFill = fillPct;
          selectedIndex = i;
        } else if (fillPct > secondFill) {
          secondFill = fillPct;
        }
      }

      const isDistinct = (maxFill - secondFill) >= 0.01;
      let answer: string | null = null;
      const nearThreshold = maxFill >= (fillThreshold * 0.95);
      if (selectedIndex !== null && (maxFill >= fillThreshold || (nearThreshold && isDistinct))) {
        answer = qType === 'mc'
          ? String.fromCharCode(65 + selectedIndex)
          : (selectedIndex === 0 ? 'T' : 'F');
      }

      const confidence = Math.max(0, Math.min(1, maxFill / 0.2));
      this.log('bubbles:contourFill', {
        question: questionTypes[qIndex].questionNumber,
        maxFill: Number(confidence.toFixed(4)),
        selectedIndex,
        threshold: fillThreshold,
        secondFill: Number(secondFill.toFixed(4)),
        distinct: isDistinct,
        nearThreshold
      });

      const first = bubblesInRow[0];
      const last = bubblesInRow[bubblesInRow.length - 1];
      const rowBounds = {
        x: first.x,
        y: first.y,
        width: (last.x + last.w) - first.x,
        height: Math.max(...bubblesInRow.map(b => b.h))
      };

      results.push({
        questionNumber: questionTypes[qIndex].questionNumber,
        answer,
        confidence,
        boundingBox: rowBounds
      });
    }

    contours.delete();
    hierarchy.delete();
    return results;
  }

  private sortBubblesIntoGrid<T extends { x: number; y: number; w: number; h: number }>(bubbles: T[]) {
    const sorted = [...bubbles].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const rows: Array<T[]> = [];
    const avgHeight = sorted.reduce((sum, b) => sum + b.h, 0) / sorted.length;
    const tolerance = Math.max(8, Math.round(avgHeight * 0.6));

    for (const bubble of sorted) {
      let row = rows.find(r => Math.abs(r[0].y - bubble.y) <= tolerance);
      if (!row) {
        row = [];
        rows.push(row);
      }
      row.push(bubble);
    }

    rows.forEach(r => r.sort((a, b) => a.x - b.x));
    return rows;
  }

  private calculateFillPercentageFromContour(processedImage: any, contour: any): number {
    const cv = this.cv;
    const mask = new cv.Mat.zeros(processedImage.rows, processedImage.cols, cv.CV_8UC1);
    const contourVec = new cv.MatVector();
    contourVec.push_back(contour);
    cv.drawContours(mask, contourVec, 0, new cv.Scalar(255), -1);

    // Erode to ignore the bubble outline and measure only the interior fill
    const rect = cv.boundingRect(contour);
    const iterations = rect.width < 12 || rect.height < 12 ? 1 : 2;
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
    const innerMask = new cv.Mat();
    cv.erode(mask, innerMask, kernel, new cv.Point(-1, -1), iterations);

    const masked = new cv.Mat();
    cv.bitwise_and(processedImage, processedImage, masked, innerMask);
    const totalPixels = cv.countNonZero(innerMask);
    const filledPixels = cv.countNonZero(masked);

    let effectiveTotal = totalPixels;
    let fillRatio = totalPixels > 0 ? filledPixels / totalPixels : 0;

    if (totalPixels === 0) {
      // Fall back to using the full mask if erosion removed everything
      const fallbackMasked = new cv.Mat();
      cv.bitwise_and(processedImage, processedImage, fallbackMasked, mask);
      const fallbackTotal = cv.countNonZero(mask);
      const fallbackFilled = cv.countNonZero(fallbackMasked);
      effectiveTotal = fallbackTotal;
      fillRatio = fallbackTotal > 0 ? fallbackFilled / fallbackTotal : 0;
      fallbackMasked.delete();
    }

    // If binary fill is too low, fall back to grayscale intensity
    if (
      this.lastGray &&
      this.lastGray.rows === processedImage.rows &&
      this.lastGray.cols === processedImage.cols
    ) {
      try {
        const baseMask = effectiveTotal > 0 ? innerMask : mask;
        const meanInner = cv.mean(this.lastGray, baseMask)[0] ?? 255;

        // Compare inner fill to ring (outline) to normalize lighting
        const ringMask = new cv.Mat();
        cv.subtract(mask, innerMask, ringMask);
        const ringPixels = cv.countNonZero(ringMask);
        const meanRing = ringPixels > 0 ? (cv.mean(this.lastGray, ringMask)[0] ?? 255) : 255;

        // If inner is darker than ring, treat as filled
        if (meanRing > 0) {
          const relativeFill = Math.max(0, Math.min(1, (meanRing - meanInner) / meanRing));
          fillRatio = Math.max(fillRatio, relativeFill);
        } else if (fillRatio < 0.05) {
          // Fallback to absolute intensity
          fillRatio = Math.max(0, Math.min(1, 1 - (meanInner / 255)));
        }

        ringMask.delete();
      } catch (err) {
        console.warn('[OCR] Grayscale fill fallback failed; using binary fill.', err);
      }
    }

    contourVec.delete();
    mask.delete();
    kernel.delete();
    innerMask.delete();
    masked.delete();

    if (effectiveTotal === 0) {
      return 0;
    }
    return fillRatio;
  }

  private async detectBubblesFromTemplate(
    processedImage: any,
    questionTypes: { questionNumber: number; type: 'mc' | 'tf'; options?: number }[],
    layoutConfig?: {
      studentInfoEnabled?: boolean;
      studentIdEnabled?: boolean;
      studentIdDigits?: number;
    }
  ): Promise<BubbleDetectionResult[]> {
    const results: BubbleDetectionResult[] = [];

    if (!this.lastGray || this.lastGray.rows !== processedImage.rows || this.lastGray.cols !== processedImage.cols) {
      return results;
    }

    // Scale: template assumes A4 width = 210mm
    // Convert mm to pixels: 1mm = (imageWidth / 210mm) pixels
    const scale = processedImage.cols / 210; // 210mm = A4 width
    const mm = (v: number) => v * scale;

    const margin = mm(20);
    const questionWidth = mm((210 - 40) / 5);
    const rowHeight = mm(20);
    const padding = mm(2);

    const totalBubbleSpacing = mm(8);
    const bubbleRadius = mm(2.5);
    const jitter = mm(1.2);
    const jitterStep = mm(0.6);
    const shiftCandidatesX = [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10].map(mm);
    const shiftCandidatesY = [-2, -1, 0, 1, 2].map(mm);
    this.log('template:optionOffsets', {
      two: this.getOptionTemplateOffsets(2, totalBubbleSpacing),
      three: this.getOptionTemplateOffsets(3, totalBubbleSpacing),
      four: this.getOptionTemplateOffsets(4, totalBubbleSpacing)
    });

    const templateGrid = this.buildTemplateQuestionGrid(
      questionTypes,
      {
        margin,
        questionWidth,
        rowHeight,
        padding,
        totalBubbleSpacing,
        bubbleRadius,
        scale
      },
      layoutConfig
    );

    const totalRows = Math.ceil(questionTypes.length / 5);
    this.log('template:grid', { rows: totalRows, questions: templateGrid.length });

    for (let row = 0; row < totalRows; row++) {
      const rowQuestions = templateGrid.filter((item) => item.row === row);

      // Find best row shift by maximizing bubble outline darkness (X and Y)
      let bestShiftX = 0;
      let bestShiftY = 0;
      let bestScore = -1;
      for (const shiftX of shiftCandidatesX) {
        for (const shiftY of shiftCandidatesY) {
          let score = 0;
          for (const question of rowQuestions) {
            let maxRing = 0;
            for (const bubble of question.bubbleCenters) {
              const ring = this.calculateRingDarknessFromCircle(
                bubble.x + shiftX,
                bubble.y + shiftY,
                bubbleRadius
              );
              if (ring > maxRing) {
                maxRing = ring;
              }
            }
            score += maxRing;
          }
          if (score > bestScore) {
            bestScore = score;
            bestShiftX = shiftX;
            bestShiftY = shiftY;
          }
        }
      }

      const shiftXmm = bestShiftX / scale;
      const shiftYmm = bestShiftY / scale;
      // Increased tolerance: allow up to 15mm X shift and 5mm Y shift for better alignment
      const shiftXOk = Math.abs(shiftXmm) <= 15;
      const shiftYOk = Math.abs(shiftYmm) <= 5;
      this.log('template:rowShift', {
        row,
        shiftX: Number(bestShiftX.toFixed(2)),
        shiftY: Number(bestShiftY.toFixed(2)),
        shiftXmm: Number(shiftXmm.toFixed(2)),
        shiftYmm: Number(shiftYmm.toFixed(2)),
        score: Number(bestScore.toFixed(4)),
        shiftXOk,
        shiftYOk
      });

      for (const question of rowQuestions) {
        const baseShiftX = shiftXOk ? bestShiftX : 0;
        const baseShiftY = shiftYOk ? bestShiftY : 0;
        // Expanded search range for per-question alignment
        const localShiftCandidatesX = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(mm);
        const localShiftCandidatesY = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(mm);
        let bestLocalShiftX = 0;
        let bestLocalShiftY = 0;
        let bestLocalScore = -1;
        for (const localShiftX of localShiftCandidatesX) {
          for (const localShiftY of localShiftCandidatesY) {
            let score = 0;
            for (const bubble of question.bubbleCenters) {
              const ring = this.calculateRingDarknessFromCircle(
                bubble.x + baseShiftX + localShiftX,
                bubble.y + baseShiftY + localShiftY,
                bubbleRadius
              );
              score += ring;
            }
            if (score > bestLocalScore) {
              bestLocalScore = score;
              bestLocalShiftX = localShiftX;
              bestLocalShiftY = localShiftY;
            }
          }
        }

        const finalShiftX = baseShiftX + bestLocalShiftX;
        const finalShiftY = baseShiftY + bestLocalShiftY;

        // Shift template centers by the best local alignment
        const shiftedTemplateCenters = question.bubbleCenters.map(bubble => ({
          x: bubble.x + finalShiftX,
          y: bubble.y + finalShiftY
        }));

        // Try to detect actual bubble positions within the question box
        const detected = this.detectBubbleCentersInBox(
          question.box,
          shiftedTemplateCenters,
          bubbleRadius
        );
        const hasDetected = Boolean(detected && detected.centers.length === question.bubbleCenters.length);
        const meanDistance = detected?.meanDistance ?? null;
        const distanceLimit = bubbleRadius * 1.5; // More lenient distance limit
        const useDetected = hasDetected && meanDistance !== null && meanDistance <= distanceLimit;
        
        // If detected centers are too far off, try finding bubbles using Hough circles
        let bubbleCenters = useDetected ? detected!.centers : shiftedTemplateCenters;
        let detectionMethod = useDetected ? 'hough' : 'shiftedTemplate';
        
        if (!useDetected) {
          const houghBasedCenters = this.findBubblesByFillInBox(
            question.box,
            question.bubbleCenters.length,
            bubbleRadius,
            totalBubbleSpacing
          );
          if (houghBasedCenters && houghBasedCenters.length === question.bubbleCenters.length) {
            bubbleCenters = houghBasedCenters;
            detectionMethod = 'houghFallback';
            this.log('template:houghBasedCenters', {
              question: question.questionNumber,
              found: houghBasedCenters.length,
              expected: question.bubbleCenters.length,
              centers: houghBasedCenters.map(c => ({
                xmm: Number((c.x / scale).toFixed(2)),
                ymm: Number((c.y / scale).toFixed(2))
              }))
            });
          }
        }

        this.log('template:bubbleCenters', {
          question: question.questionNumber,
          method: detectionMethod,
          detectedCount: hasDetected ? detected!.centers.length : null,
          meanDistance: meanDistance !== null ? Number(meanDistance.toFixed(2)) : null,
          localShiftXmm: Number((bestLocalShiftX / scale).toFixed(2)),
          localShiftYmm: Number((bestLocalShiftY / scale).toFixed(2)),
          centers: bubbleCenters.map(c => ({
            xmm: Number((c.x / scale).toFixed(2)),
            ymm: Number((c.y / scale).toFixed(2))
          }))
        });

        // Scan the question box horizontally to find actual bubble positions
        const bubbleY = question.box.y + mm(8); // Expected Y position for bubbles
        const scanStartX = question.box.x + padding;
        const scanEndX = question.box.x + question.box.width - padding;
        const scanStep = mm(0.5); // Fine-grained scan
        
        // Find fill peaks across the question box
        const fillScan: Array<{ x: number; fill: number }> = [];
        for (let scanX = scanStartX; scanX <= scanEndX; scanX += scanStep) {
          const fill = this.calculateFillPercentageFromCircle(scanX, bubbleY, bubbleRadius);
          fillScan.push({ x: scanX, fill });
        }
        
        // Find peaks (local maxima) that could be bubbles
        const peaks: Array<{ x: number; fill: number }> = [];
        for (let i = 1; i < fillScan.length - 1; i++) {
          if (fillScan[i].fill > fillScan[i - 1].fill && fillScan[i].fill > fillScan[i + 1].fill) {
            if (fillScan[i].fill > 0.03) { // Lower threshold to catch more bubbles
              peaks.push(fillScan[i]);
            }
          }
        }
        
        // Sort peaks by fill (highest first) and take top N
        peaks.sort((a, b) => b.fill - a.fill);
        const topPeaks = peaks.slice(0, question.bubbleCenters.length);
        topPeaks.sort((a, b) => a.x - b.x); // Sort by X position
        
        this.log('template:scanPeaks:raw', {
          question: question.questionNumber,
          totalPeaks: peaks.length,
          topPeaksCount: topPeaks.length,
          expectedCount: question.bubbleCenters.length,
          topPeaks: topPeaks.map(p => ({
            xmm: Number((p.x / scale).toFixed(2)),
            fill: Number(p.fill.toFixed(4))
          }))
        });
        
        // Match detected peaks with template centers
        // Use peaks even if we only find 1 - they're more reliable than template positions
        let finalBubbleCenters = bubbleCenters;
        if (topPeaks.length >= 1) {
          // Match peaks with template positions, use peaks when available
          const matchedCenters: Array<{ x: number; y: number }> = [];
          const usedPeaks = new Set<number>();
          
          // More lenient matching distance
          const maxMatchDistance = bubbleRadius * 5; // Increased from 3x
          
          for (const templateCenter of bubbleCenters) {
            // Find closest peak to this template center
            let closestPeak: { x: number; fill: number } | null = null;
            let closestDistance = Infinity;
            let closestPeakIndex = -1;
            
            for (let i = 0; i < topPeaks.length; i++) {
              if (usedPeaks.has(i)) continue;
              const distance = Math.abs(topPeaks[i].x - templateCenter.x);
              if (distance < closestDistance && distance < maxMatchDistance) {
                closestDistance = distance;
                closestPeak = topPeaks[i];
                closestPeakIndex = i;
              }
            }
            
            if (closestPeak) {
              matchedCenters.push({ x: closestPeak.x, y: bubbleY });
              usedPeaks.add(closestPeakIndex);
            } else {
              // Use template center if no peak found nearby
              matchedCenters.push(templateCenter);
            }
          }
          
          finalBubbleCenters = matchedCenters;
          
          this.log('template:scanPeaks', {
            question: question.questionNumber,
            peaksFound: topPeaks.length,
            matched: matchedCenters.length,
            usedPeaksCount: usedPeaks.size,
            peakPositions: topPeaks.map(p => ({
              xmm: Number((p.x / scale).toFixed(2)),
              fill: Number(p.fill.toFixed(4))
            })),
            matchedCenters: matchedCenters.map(c => ({
              xmm: Number((c.x / scale).toFixed(2)),
              ymm: Number((c.y / scale).toFixed(2))
            }))
          });
        }

        const fillByOption: number[] = [];
        let maxFill = 0;
        let secondFill = 0;
        let selectedIndex: number | null = null;

        for (let i = 0; i < finalBubbleCenters.length; i++) {
          const bubble = finalBubbleCenters[i];
          let fill = 0;
          // Only apply jitter, not shift
          for (let dx = -jitter; dx <= jitter; dx += jitterStep) {
            for (let dy = -jitter; dy <= jitter; dy += jitterStep) {
              const candidate = this.calculateFillPercentageFromCircle(
                bubble.x + dx,
                bubble.y + dy,
                bubbleRadius
              );
              if (candidate > fill) {
                fill = candidate;
              }
            }
          }
          fillByOption.push(fill);
          if (fill > maxFill) {
            secondFill = maxFill;
            maxFill = fill;
            selectedIndex = i;
          } else if (fill > secondFill) {
            secondFill = fill;
          }
        }

        const threshold = 0.08;
        const isDistinct = (maxFill - secondFill) >= 0.02;
        const nearThreshold = maxFill >= (threshold * 0.95);
        const answer = selectedIndex !== null && (maxFill >= threshold || (nearThreshold && isDistinct))
          ? (question.type === 'mc'
              ? String.fromCharCode(65 + selectedIndex)
              : (selectedIndex === 0 ? 'T' : 'F'))
          : null;

        this.log('template:fill', {
          question: question.questionNumber,
          maxFill: Number(maxFill.toFixed(4)),
          selectedIndex,
          threshold,
          secondFill: Number(secondFill.toFixed(4)),
          distinct: isDistinct,
          nearThreshold,
          localShiftXmm: Number((bestLocalShiftX / scale).toFixed(2)),
          localShiftYmm: Number((bestLocalShiftY / scale).toFixed(2)),
          fillByOption: fillByOption.map((value) => Number(value.toFixed(4)))
        });

        results.push({
          questionNumber: question.questionNumber,
          answer,
          confidence: Math.max(0, Math.min(1, maxFill / 0.2)),
          boundingBox: {
            x: question.box.x,
            y: question.box.y,
            width: question.box.width,
            height: question.box.height
          }
        });
      }
    }

    return results;
  }

  /**
   * Detection-based method: Find actual bubbles using HoughCircles, then match to questions
   */
  private async detectBubblesByHoughCircles(
    processedImage: any,
    questionTypes: { questionNumber: number; type: 'mc' | 'tf'; options?: number }[],
    layoutConfig?: {
      studentInfoEnabled?: boolean;
      studentIdEnabled?: boolean;
      studentIdDigits?: number;
    }
  ): Promise<BubbleDetectionResult[]> {
    const results: BubbleDetectionResult[] = [];

    if (!this.lastGray || this.lastGray.rows !== processedImage.rows || this.lastGray.cols !== processedImage.cols) {
      return results;
    }

    const cv = this.cv;
    const scale = processedImage.cols / 210; // 210mm = A4 width
    const mm = (v: number) => v * scale;

    // Build question grid to know where to search
    const margin = mm(20);
    const questionWidth = mm((210 - 40) / 5);
    const rowHeight = mm(20);
    const bubbleRadius = mm(2.5);

    const templateGrid = this.buildTemplateQuestionGrid(
      questionTypes,
      {
        margin,
        questionWidth,
        rowHeight,
        padding: mm(2),
        totalBubbleSpacing: mm(8),
        bubbleRadius,
        scale
      },
      layoutConfig
    );

    // Detect all circles in the image using HoughCircles
    const gray = this.lastGray;
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    const circles = new cv.Mat();
    const minDist = Math.max(5, Math.round(bubbleRadius * 1.5));
    const minRadius = Math.max(3, Math.round(bubbleRadius * 0.5));
    const maxRadius = Math.max(minRadius + 2, Math.round(bubbleRadius * 1.8));
    
    cv.HoughCircles(
      blurred,
      circles,
      cv.HOUGH_GRADIENT,
      1,
      minDist,
      100,
      20,
      minRadius,
      maxRadius
    );

    const detectedCircles: Array<{ x: number; y: number; radius: number }> = [];
    if (circles.cols > 0) {
      for (let i = 0; i < circles.cols; i++) {
        const cx = circles.data32F[i * 3];
        const cy = circles.data32F[i * 3 + 1];
        const r = circles.data32F[i * 3 + 2];
        if (Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r)) {
          detectedCircles.push({ x: cx, y: cy, radius: r });
        }
      }
    }

    this.log('detection:houghCircles', {
      totalDetected: detectedCircles.length,
      expectedTotal: questionTypes.reduce((sum, q) => {
        const opts = q.type === 'mc' ? Math.min(4, Math.max(2, Number(q.options) || 4)) : 2;
        return sum + opts;
      }, 0)
    });

    blurred.delete();
    circles.delete();

    // Match detected circles to questions
    for (const question of templateGrid) {
      const options = question.type === 'mc'
        ? Math.min(4, Math.max(2, Number(question.options) || 4))
        : 2;

      // Find circles within this question's box
      const questionCircles = detectedCircles.filter(circle => {
        return circle.x >= question.box.x &&
               circle.x <= question.box.x + question.box.width &&
               circle.y >= question.box.y &&
               circle.y <= question.box.y + question.box.height;
      });

      // Sort by X position (left to right)
      questionCircles.sort((a, b) => a.x - b.x);

      // If we found circles, match them to expected positions
      const fillByOption: number[] = [];
      let maxFill = 0;
      let secondFill = 0;
      let selectedIndex: number | null = null;

      if (questionCircles.length >= options) {
        // Use detected circles
        for (let i = 0; i < options; i++) {
          const circle = questionCircles[i];
          const fill = this.calculateFillPercentageFromCircle(circle.x, circle.y, circle.radius);
          fillByOption.push(fill);
          if (fill > maxFill) {
            secondFill = maxFill;
            maxFill = fill;
            selectedIndex = i;
          } else if (fill > secondFill) {
            secondFill = fill;
          }
        }
      } else {
        // Fallback: use template positions if not enough circles found
        for (let i = 0; i < question.bubbleCenters.length; i++) {
          const bubble = question.bubbleCenters[i];
          const fill = this.calculateFillPercentageFromCircle(bubble.x, bubble.y, bubbleRadius);
          fillByOption.push(fill);
          if (fill > maxFill) {
            secondFill = maxFill;
            maxFill = fill;
            selectedIndex = i;
          } else if (fill > secondFill) {
            secondFill = fill;
          }
        }
      }

      const threshold = 0.08;
      const isDistinct = (maxFill - secondFill) >= 0.02;
      const nearThreshold = maxFill >= (threshold * 0.95);
      const answer = selectedIndex !== null && (maxFill >= threshold || (nearThreshold && isDistinct))
        ? (question.type === 'mc'
            ? String.fromCharCode(65 + selectedIndex)
            : (selectedIndex === 0 ? 'T' : 'F'))
        : null;

      this.log('detection:fill', {
        question: question.questionNumber,
        circlesFound: questionCircles.length,
        expectedOptions: options,
        maxFill: Number(maxFill.toFixed(4)),
        selectedIndex,
        threshold,
        secondFill: Number(secondFill.toFixed(4)),
        distinct: isDistinct,
        fillByOption: fillByOption.map((value) => Number(value.toFixed(4)))
      });

      results.push({
        questionNumber: question.questionNumber,
        answer,
        confidence: Math.max(0, Math.min(1, maxFill / 0.2)),
        boundingBox: {
          x: question.box.x,
          y: question.box.y,
          width: question.box.width,
          height: question.box.height
        }
      });
    }

    return results;
  }

  private buildTemplateQuestionGrid(
    questionTypes: { questionNumber: number; type: 'mc' | 'tf'; options?: number }[],
    templateMetrics: {
      margin: number;
      questionWidth: number;
      rowHeight: number;
      padding: number;
      totalBubbleSpacing: number;
      bubbleRadius: number;
      scale: number;
    },
    layoutConfig?: {
      studentInfoEnabled?: boolean;
      studentIdEnabled?: boolean;
      studentIdDigits?: number;
    }
  ): Array<{
    questionNumber: number;
    type: 'mc' | 'tf';
    options: number;
    row: number;
    col: number;
    box: { x: number; y: number; width: number; height: number };
    bubbleCenters: Array<{ x: number; y: number }>;
  }> {
    const {
      margin,
      questionWidth,
      rowHeight,
      padding,
      totalBubbleSpacing,
      bubbleRadius,
      scale
    } = templateMetrics;
    // Scale is already pixels/mm (imageWidth / 210mm)
    const mm = (v: number) => v * scale;

    let yPosition = mm(34);

    // Student Information - all fields on one line (+10mm)
    if (layoutConfig?.studentInfoEnabled !== false) {
      yPosition += mm(10);
    }

    // Student ID Section - match PDF generation exactly
    if (layoutConfig?.studentIdEnabled !== false) {
      yPosition += mm(8); // "Student ID:" label line

      const digits = layoutConfig?.studentIdDigits || 6;
      const squareHeight = mm(7);
      const squareSpacing = mm(1);
      const squaresPerRow = 10;
      const rowsNeeded = Math.ceil(digits / squaresPerRow);

      // Student ID squares: rowsNeeded * (squareHeight + squareSpacing + 6) + 4
      yPosition += rowsNeeded * (squareHeight + squareSpacing + mm(6)) + mm(4);

      // Example digits section - match PDF generation (digitHeight + 6)
      const digitHeight = mm(6);
      yPosition += digitHeight + mm(6); // Examples + spacing
    }

    // Instructions line (+6mm)
    yPosition += mm(6);

    // START marker (+8mm after marker)
    yPosition += mm(8);

    // Reconstruct sections from questionTypes by grouping consecutive questions with same type/options
    const sections: Array<{ type: 'mc' | 'tf'; count: number; options?: number; startIndex: number }> = [];
    let currentSection: { type: 'mc' | 'tf'; count: number; options?: number; startIndex: number } | null = null;

    questionTypes.forEach((question, index) => {
      const options = question.type === 'mc'
        ? Math.min(4, Math.max(2, Number(question.options) || 4))
        : undefined;

      if (!currentSection || 
          currentSection.type !== question.type || 
          currentSection.options !== options) {
        // Start new section
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          type: question.type,
          count: 1,
          options,
          startIndex: index
        };
      } else {
        currentSection.count++;
      }
    });
    if (currentSection) {
      sections.push(currentSection);
    }

    const grid: Array<{
      questionNumber: number;
      type: 'mc' | 'tf';
      options: number;
      row: number;
      col: number;
      box: { x: number; y: number; width: number; height: number };
      bubbleCenters: Array<{ x: number; y: number }>;
    }> = [];

    const questionsPerRow = 5;
    let globalQuestionIndex = 0;
    const initialYPosition = yPosition;

    // Process each section (matching PDF generation)
    sections.forEach((section, sectionIndex) => {
      // Section header (+8mm) - match PDF generation
      yPosition += mm(8);

      const sectionCount = section.count;
      const totalRows = Math.ceil(sectionCount / questionsPerRow);

      // Process questions in this section
      for (let row = 0; row < totalRows; row++) {
        const rowY = yPosition + (row * rowHeight);

        for (let col = 0; col < questionsPerRow; col++) {
          const index = row * questionsPerRow + col;
          if (index >= sectionCount) break;

          const question = questionTypes[section.startIndex + index];
          if (!question) break;

          const options = question.type === 'mc'
            ? Math.min(4, Math.max(2, Number(question.options) || 4))
            : 2;

          const questionStartX = margin + (col * questionWidth);
          const questionCenterX = questionStartX + (questionWidth / 2);
          const bubbleY = rowY + mm(8);
          const offsets = this.getOptionTemplateOffsets(options, totalBubbleSpacing);
          const bubbleCenters = offsets.map((offset) => ({
            x: questionCenterX + offset,
            y: bubbleY
          }));

          // Calculate global row (across all sections)
          const globalRow = Math.floor(globalQuestionIndex / questionsPerRow);

          // Log first question details for debugging
          if (globalQuestionIndex === 0) {
            this.log('template:questionGrid:first', {
              questionNumber: question.questionNumber,
              sectionIndex,
              sectionType: section.type,
              globalRow,
              col,
              rowYmm: Number((rowY / scale).toFixed(2)),
              questionStartXmm: Number((questionStartX / scale).toFixed(2)),
              questionCenterXmm: Number((questionCenterX / scale).toFixed(2)),
              bubbleYmm: Number((bubbleY / scale).toFixed(2)),
              options,
              offsets: offsets.map(o => Number((o / scale).toFixed(2))),
              bubbleCenters: bubbleCenters.map(b => ({
                xmm: Number((b.x / scale).toFixed(2)),
                ymm: Number((b.y / scale).toFixed(2))
              }))
            });
          }

          grid.push({
            questionNumber: question.questionNumber,
            type: question.type,
            options,
            row: globalRow,
            col,
            box: {
              x: questionStartX + padding,
              y: rowY,
              width: questionWidth - (padding * 2),
              height: rowHeight - mm(2)
            },
            bubbleCenters
          });

          globalQuestionIndex++;
        }
      }

      // Move yPosition for next section (+5mm spacing between sections) - match PDF generation
      yPosition += (totalRows * rowHeight) + mm(5);
    });

    // Log after processing all sections
    this.log('template:questionGrid:calc', {
      scale: Number(scale.toFixed(4)),
      initialYmm: 34,
      afterStudentInfo: layoutConfig?.studentInfoEnabled !== false ? 10 : 0,
      afterStudentId: layoutConfig?.studentIdEnabled !== false ? (8 + Math.ceil((layoutConfig?.studentIdDigits || 6) / 10) * (7 + 1 + 6) + 4 + 6 + 6) : 0,
      afterInstructions: 6,
      afterStartMarker: 8,
      sectionsCount: sections.length,
      sections: sections.map(s => ({ type: s.type, count: s.count, options: s.options })),
      initialYAfterStartMarker: Number((initialYPosition / scale).toFixed(2)),
      finalYmm: Number((yPosition / scale).toFixed(2)),
      marginmm: Number((margin / scale).toFixed(2)),
      questionWidthmm: Number((questionWidth / scale).toFixed(2)),
      rowHeightmm: Number((rowHeight / scale).toFixed(2)),
      bubbleSpacingmm: Number((totalBubbleSpacing / scale).toFixed(2)),
      bubbleRadiusmm: Number((bubbleRadius / scale).toFixed(2))
    });

    return grid;
  }

  private detectBubbleCentersInBox(
    box: { x: number; y: number; width: number; height: number },
    expectedCenters: Array<{ x: number; y: number }>,
    bubbleRadius: number
  ): { centers: Array<{ x: number; y: number }>; meanDistance: number } | null {
    if (!this.lastGray) return null;
    const cv = this.cv;

    const x = Math.max(0, Math.min(this.lastGray.cols - 1, Math.round(box.x)));
    const y = Math.max(0, Math.min(this.lastGray.rows - 1, Math.round(box.y)));
    const w = Math.max(1, Math.min(this.lastGray.cols - x, Math.round(box.width)));
    const h = Math.max(1, Math.min(this.lastGray.rows - y, Math.round(box.height)));
    if (w <= 2 || h <= 2) return null;

    const roi = this.lastGray.roi(new cv.Rect(x, y, w, h));
    const blurred = new cv.Mat();
    cv.GaussianBlur(roi, blurred, new cv.Size(3, 3), 0);

    const circles = new cv.Mat();
    const minDist = Math.max(2, Math.round(bubbleRadius * 1.6));
    const minRadius = Math.max(2, Math.round(bubbleRadius * 0.6));
    const maxRadius = Math.max(minRadius + 1, Math.round(bubbleRadius * 1.4));
    cv.HoughCircles(
      blurred,
      circles,
      cv.HOUGH_GRADIENT,
      1,
      minDist,
      100,
      15,
      minRadius,
      maxRadius
    );

    const centers: Array<{ x: number; y: number }> = [];
    if (circles.cols > 0) {
      for (let i = 0; i < circles.cols; i++) {
        const cx = circles.data32F[i * 3];
        const cy = circles.data32F[i * 3 + 1];
        if (Number.isFinite(cx) && Number.isFinite(cy)) {
          centers.push({ x: x + cx, y: y + cy });
        }
      }
    }

    roi.delete();
    blurred.delete();
    circles.delete();

    if (centers.length < expectedCenters.length) {
      return null;
    }

    const expectedCount = expectedCenters.length;
    const expectedSpacing = expectedCount > 1
      ? (expectedCenters[expectedCount - 1].x - expectedCenters[0].x) / (expectedCount - 1)
      : 0;

    const sorted = centers.slice().sort((a, b) => a.x - b.x);
    let bestWindow: Array<{ x: number; y: number }> | null = null;
    let bestScore = Infinity;
    let bestMeanDistance = Infinity;

    for (let start = 0; start <= sorted.length - expectedCount; start++) {
      const window = sorted.slice(start, start + expectedCount);
      let spacingScore = 0;
      for (let i = 1; i < window.length; i++) {
        const spacing = window[i].x - window[i - 1].x;
        spacingScore += Math.abs(spacing - expectedSpacing);
      }

      let distanceScore = 0;
      for (let i = 0; i < expectedCount; i++) {
        const dx = window[i].x - expectedCenters[i].x;
        const dy = window[i].y - expectedCenters[i].y;
        distanceScore += Math.hypot(dx, dy);
      }

      const meanDistance = expectedCount > 0 ? distanceScore / expectedCount : distanceScore;
      const score = spacingScore + distanceScore * 0.5;
      if (score < bestScore) {
        bestScore = score;
        bestWindow = window;
        bestMeanDistance = meanDistance;
      }
    }

    if (!bestWindow) {
      return null;
    }

    return { centers: bestWindow, meanDistance: bestMeanDistance };
  }

  private getOptionTemplateOffsets(options: number, spacing: number): number[] {
    const count = Math.min(4, Math.max(2, Math.round(options)));
    switch (count) {
      case 2:
        return [-0.5, 0.5].map((factor) => factor * spacing);
      case 3:
        return [-1, 0, 1].map((factor) => factor * spacing);
      case 4:
      default:
        return [-1.5, -0.5, 0.5, 1.5].map((factor) => factor * spacing);
    }
  }

  private calculateFillPercentageFromCircle(cx: number, cy: number, radius: number): number {
    const cv = this.cv;
    if (!this.lastGray) return 0;

    const r = Math.max(2, Math.round(radius));
    const pad = r * 2;
    const x = Math.max(0, Math.floor(cx - pad));
    const y = Math.max(0, Math.floor(cy - pad));
    const w = Math.min(this.lastGray.cols - x, pad * 2);
    const h = Math.min(this.lastGray.rows - y, pad * 2);
    if (w <= 2 || h <= 2) return 0;

    const roi = this.lastGray.roi(new cv.Rect(x, y, w, h));
    const blurred = new cv.Mat();
    const thresh = new cv.Mat();
    const adaptive = new cv.Mat();
    cv.GaussianBlur(roi, blurred, new cv.Size(3, 3), 0);
    cv.threshold(blurred, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    cv.adaptiveThreshold(
      blurred,
      adaptive,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      11,
      2
    );

    const mask = new cv.Mat.zeros(h, w, cv.CV_8UC1);
    const innerMask = new cv.Mat.zeros(h, w, cv.CV_8UC1);
    const localCx = Math.round(cx - x);
    const localCy = Math.round(cy - y);
    const outerRadius = Math.round(r * 1.35);
    const innerRadius = Math.round(r * 0.85);
    cv.circle(mask, new cv.Point(localCx, localCy), outerRadius, new cv.Scalar(255), -1);
    cv.circle(innerMask, new cv.Point(localCx, localCy), innerRadius, new cv.Scalar(255), -1);

    const ringMask = new cv.Mat();
    cv.subtract(mask, innerMask, ringMask);

    const totalInner = cv.countNonZero(innerMask);
    const maskedInner = new cv.Mat();
    cv.bitwise_and(thresh, thresh, maskedInner, innerMask);
    const filledInner = cv.countNonZero(maskedInner);
    let fillRatio = totalInner > 0 ? filledInner / totalInner : 0;

    const maskedAdaptive = new cv.Mat();
    cv.bitwise_and(adaptive, adaptive, maskedAdaptive, innerMask);
    const filledAdaptive = cv.countNonZero(maskedAdaptive);
    const adaptiveRatio = totalInner > 0 ? filledAdaptive / totalInner : 0;
    fillRatio = Math.max(fillRatio, adaptiveRatio);

    const meanInner = cv.mean(roi, innerMask)[0] ?? 255;
    const meanRing = cv.mean(roi, ringMask)[0] ?? 255;
    if (meanRing > 0) {
      const relative = Math.max(0, Math.min(1, (meanRing - meanInner) / meanRing));
      // Reduce ring influence to avoid outline-only false positives
      fillRatio = Math.max(fillRatio, relative * 0.5);
    }

    maskedInner.delete();
    maskedAdaptive.delete();
    roi.delete();
    blurred.delete();
    thresh.delete();
    adaptive.delete();
    mask.delete();
    innerMask.delete();
    ringMask.delete();

    return fillRatio;
  }

  private calculateRingDarknessFromCircle(cx: number, cy: number, radius: number): number {
    const cv = this.cv;
    if (!this.lastGray) return 0;

    const r = Math.max(2, Math.round(radius));
    const pad = r * 2;
    const x = Math.max(0, Math.floor(cx - pad));
    const y = Math.max(0, Math.floor(cy - pad));
    const w = Math.min(this.lastGray.cols - x, pad * 2);
    const h = Math.min(this.lastGray.rows - y, pad * 2);
    if (w <= 2 || h <= 2) return 0;

    const roi = this.lastGray.roi(new cv.Rect(x, y, w, h));
    const mask = new cv.Mat.zeros(h, w, cv.CV_8UC1);
    const innerMask = new cv.Mat.zeros(h, w, cv.CV_8UC1);
    const localCx = Math.round(cx - x);
    const localCy = Math.round(cy - y);
    cv.circle(mask, new cv.Point(localCx, localCy), Math.round(r * 1.6), new cv.Scalar(255), -1);
    cv.circle(innerMask, new cv.Point(localCx, localCy), Math.round(r * 1.1), new cv.Scalar(255), -1);

    const ringMask = new cv.Mat();
    cv.subtract(mask, innerMask, ringMask);

    const meanRing = cv.mean(roi, ringMask)[0] ?? 255;
    const darkness = Math.max(0, Math.min(1, 1 - (meanRing / 255)));

    roi.delete();
    mask.delete();
    innerMask.delete();
    ringMask.delete();

    return darkness;
  }

  /**
   * Find bubble centers by detecting circle outlines using Hough circles
   * This is a fallback when template positions don't align well
   */
  private findBubblesByFillInBox(
    box: { x: number; y: number; width: number; height: number },
    expectedCount: number,
    bubbleRadius: number,
    bubbleSpacing: number
  ): Array<{ x: number; y: number }> | null {
    if (!this.lastGray) return null;

    const cv = this.cv;
    const pad = Math.round(bubbleRadius * 2);
    const roiX = Math.max(0, Math.floor(box.x - pad));
    const roiY = Math.max(0, Math.floor(box.y - pad));
    const roiW = Math.min(this.lastGray.cols - roiX, Math.floor(box.width + pad * 2));
    const roiH = Math.min(this.lastGray.rows - roiY, Math.floor(box.height + pad * 2));
    
    if (roiW < bubbleRadius * 2 || roiH < bubbleRadius * 2) return null;

    const roi = this.lastGray.roi(new cv.Rect(roiX, roiY, roiW, roiH));
    
    // Use Hough circles to detect actual bubble outlines
    const circles = new cv.Mat();
    const minRadius = Math.max(3, Math.round(bubbleRadius * 0.6));
    const maxRadius = Math.round(bubbleRadius * 1.4);
    
    cv.HoughCircles(
      roi,
      circles,
      cv.HOUGH_GRADIENT,
      1, // dp
      minRadius * 2, // minDist between centers
      50, // param1 (canny threshold)
      30, // param2 (accumulator threshold)
      minRadius,
      maxRadius
    );

    const detected: Array<{ x: number; y: number; radius: number }> = [];
    for (let i = 0; i < circles.cols; i++) {
      const x = circles.data32F[i * 3] + roiX;
      const y = circles.data32F[i * 3 + 1] + roiY;
      const r = circles.data32F[i * 3 + 2];
      
      // Only consider circles within the box bounds
      if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
        detected.push({ x, y, radius: r });
      }
    }

    roi.delete();
    circles.delete();

    if (detected.length < expectedCount) return null;

    // Sort by X position (left to right)
    detected.sort((a, b) => a.x - b.x);

    // Filter to expectedCount by taking the ones with best spacing
    const selected: Array<{ x: number; y: number }> = [];
    const minSpacing = bubbleSpacing * 0.6;
    
    for (const circle of detected) {
      if (selected.length === 0) {
        selected.push({ x: circle.x, y: circle.y });
      } else {
        // Check if this circle is far enough from all selected ones
        let tooClose = false;
        for (const selectedCircle of selected) {
          const distance = Math.abs(circle.x - selectedCircle.x);
          if (distance < minSpacing) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose && selected.length < expectedCount) {
          selected.push({ x: circle.x, y: circle.y });
        }
      }
    }

    if (selected.length !== expectedCount) return null;

    return selected;
  }

  private detectCornerMarkers(processedImage: any): {
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    br: { x: number; y: number };
    bl: { x: number; y: number };
  } | null {
    const cv = this.cv;
    const imgWidth = processedImage.cols;
    const imgHeight = processedImage.rows;
    const zone = Math.round(Math.min(imgWidth, imgHeight) * 0.18);

    const fiducials = this.detectFiducialMarkers(processedImage);
    if (fiducials) {
      return fiducials;
    }

    const zones = {
      tl: new cv.Rect(0, 0, zone, zone),
      tr: new cv.Rect(imgWidth - zone, 0, zone, zone),
      bl: new cv.Rect(0, imgHeight - zone, zone, zone),
      br: new cv.Rect(imgWidth - zone, imgHeight - zone, zone, zone)
    };

    const findCorner = (rect: any, corner: 'tl' | 'tr' | 'bl' | 'br') => {
      const roi = processedImage.roi(rect);
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(roi, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let bestRect: any | null = null;
      let bestArea = 0;
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area > bestArea) {
          bestArea = area;
          bestRect = cv.boundingRect(cnt);
        }
      }

      contours.delete();
      hierarchy.delete();
      roi.delete();

      if (!bestRect) {
        return null;
      }

      const offsetX = rect.x;
      const offsetY = rect.y;
      if (corner === 'tl') {
        return { x: offsetX + bestRect.x, y: offsetY + bestRect.y };
      }
      if (corner === 'tr') {
        return { x: offsetX + bestRect.x + bestRect.width, y: offsetY + bestRect.y };
      }
      if (corner === 'bl') {
        return { x: offsetX + bestRect.x, y: offsetY + bestRect.y + bestRect.height };
      }
      return { x: offsetX + bestRect.x + bestRect.width, y: offsetY + bestRect.y + bestRect.height };
    };

    const tl = findCorner(zones.tl, 'tl');
    const tr = findCorner(zones.tr, 'tr');
    const bl = findCorner(zones.bl, 'bl');
    const br = findCorner(zones.br, 'br');

    if (!tl || !tr || !bl || !br) {
      return null;
    }

    return { tl, tr, br, bl };
  }

  private detectFiducialMarkers(processedImage: any): {
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    br: { x: number; y: number };
    bl: { x: number; y: number };
  } | null {
    const cv = this.cv;
    const imgWidth = processedImage.cols;
    const imgHeight = processedImage.rows;
    const zone = Math.round(Math.min(imgWidth, imgHeight) * 0.22);

    const zones = {
      tl: new cv.Rect(0, 0, zone, zone),
      tr: new cv.Rect(imgWidth - zone, 0, zone, zone),
      bl: new cv.Rect(0, imgHeight - zone, zone, zone),
      br: new cv.Rect(imgWidth - zone, imgHeight - zone, zone, zone)
    };

    const findMarker = (rect: any, corner: 'tl' | 'tr' | 'bl' | 'br') => {
      const roi = processedImage.roi(rect);
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(roi, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

      let bestRect: any | null = null;
      let bestScore = 0;
      for (let i = 0; i < contours.size(); i++) {
        const h = hierarchy.intPtr(0, i);
        const childIdx = h[2];
        if (childIdx < 0) continue;

        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < 80) continue;

        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.05 * peri, true);
        if (approx.rows !== 4) {
          approx.delete();
          continue;
        }

        const rectOuter = cv.boundingRect(approx);
        const aspect = rectOuter.width / rectOuter.height;
        if (aspect < 0.75 || aspect > 1.3) {
          approx.delete();
          continue;
        }

        const childCnt = contours.get(childIdx);
        const childPeri = cv.arcLength(childCnt, true);
        const childApprox = new cv.Mat();
        cv.approxPolyDP(childCnt, childApprox, 0.05 * childPeri, true);
        if (childApprox.rows !== 4) {
          approx.delete();
          childApprox.delete();
          continue;
        }

        const rectInner = cv.boundingRect(childApprox);
        const innerAspect = rectInner.width / rectInner.height;
        const areaRatio = (rectInner.width * rectInner.height) / (rectOuter.width * rectOuter.height);

        childApprox.delete();
        approx.delete();

        if (innerAspect < 0.7 || innerAspect > 1.4) continue;
        if (areaRatio < 0.1 || areaRatio > 0.7) continue;

        if (area > bestScore) {
          bestScore = area;
          bestRect = rectOuter;
        }
      }

      contours.delete();
      hierarchy.delete();
      roi.delete();

      if (!bestRect) return null;

      const offsetX = rect.x;
      const offsetY = rect.y;
      if (corner === 'tl') {
        return { x: offsetX + bestRect.x, y: offsetY + bestRect.y };
      }
      if (corner === 'tr') {
        return { x: offsetX + bestRect.x + bestRect.width, y: offsetY + bestRect.y };
      }
      if (corner === 'bl') {
        return { x: offsetX + bestRect.x, y: offsetY + bestRect.y + bestRect.height };
      }
      return { x: offsetX + bestRect.x + bestRect.width, y: offsetY + bestRect.y + bestRect.height };
    };

    const tl = findMarker(zones.tl, 'tl');
    const tr = findMarker(zones.tr, 'tr');
    const bl = findMarker(zones.bl, 'bl');
    const br = findMarker(zones.br, 'br');

    if (!tl || !tr || !bl || !br) {
      return null;
    }

    this.log('fiducial:markers', { tl, tr, bl, br });
    return { tl, tr, br, bl };
  }

  private warpToTemplate(sourceMat: any, corners: { tl: { x: number; y: number }; tr: { x: number; y: number }; br: { x: number; y: number }; bl: { x: number; y: number } }) {
    const cv = this.cv;
    
    // Calculate actual aspect ratio from detected corners
    // A4 aspect ratio: 210/297 = 0.707 (portrait) or 297/210 = 1.414 (landscape)
    const topWidth = Math.sqrt(
      Math.pow(corners.tr.x - corners.tl.x, 2) + 
      Math.pow(corners.tr.y - corners.tl.y, 2)
    );
    const bottomWidth = Math.sqrt(
      Math.pow(corners.br.x - corners.bl.x, 2) + 
      Math.pow(corners.br.y - corners.bl.y, 2)
    );
    const leftHeight = Math.sqrt(
      Math.pow(corners.bl.x - corners.tl.x, 2) + 
      Math.pow(corners.bl.y - corners.tl.y, 2)
    );
    const rightHeight = Math.sqrt(
      Math.pow(corners.br.x - corners.tr.x, 2) + 
      Math.pow(corners.br.y - corners.tr.y, 2)
    );
    
    const avgWidth = (topWidth + bottomWidth) / 2;
    const avgHeight = (leftHeight + rightHeight) / 2;
    const detectedAspectRatio = avgWidth / avgHeight;
    
    // Use detected aspect ratio to calculate target dimensions (preserve original ratio)
    // Scale to reasonable resolution (2100px width) but maintain detected aspect ratio
    const baseWidth = 2100;
    const targetWidth = baseWidth;
    const targetHeight = Math.round(baseWidth / detectedAspectRatio);
    
    this.log('homography:aspectRatio', {
      detectedAspectRatio: Number(detectedAspectRatio.toFixed(3)),
      avgWidth: Number(avgWidth.toFixed(1)),
      avgHeight: Number(avgHeight.toFixed(1)),
      targetWidth,
      targetHeight,
      targetAspectRatio: Number((targetWidth / targetHeight).toFixed(3))
    });

    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners.tl.x, corners.tl.y,
      corners.tr.x, corners.tr.y,
      corners.br.x, corners.br.y,
      corners.bl.x, corners.bl.y
    ]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      targetWidth, 0,
      targetWidth, targetHeight,
      0, targetHeight
    ]);

    // Use findHomography with RANSAC for robust outlier rejection
    // Falls back to getPerspectiveTransform if findHomography fails
    let M: any;
    try {
      // RANSAC with 5.0 pixel reprojection threshold
      M = cv.findHomography(srcPts, dstPts, cv.RANSAC, 5.0);
      if (!M || M.rows === 0 || M.cols === 0) {
        throw new Error('findHomography returned empty matrix');
      }
      this.log('homography:method', { method: 'findHomography_RANSAC' });
    } catch (error) {
      // Fallback to exact 4-point transform
      M = cv.getPerspectiveTransform(srcPts, dstPts);
      this.log('homography:method', { method: 'getPerspectiveTransform_fallback', error: String(error) });
    }

    const dsize = new cv.Size(targetWidth, targetHeight);
    const warped = new cv.Mat();
    cv.warpPerspective(sourceMat, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar());

    srcPts.delete();
    dstPts.delete();
    M.delete();

    return warped;
  }

  /**
   * Detect bubbles for a specific question
   */
  private async detectQuestionBubbles(
    processedImage: any,
    layout: any,
    questionType: { questionNumber: number; type: 'mc' | 'tf'; options?: number }
  ): Promise<BubbleDetectionResult | null> {
    const cv = this.cv;

    // Find the row for this question number
    const questionRow = layout.questionRows.find((_row: any, index: number) =>
      index + 1 === questionType.questionNumber
    );

    if (!questionRow) {
      return null;
    }

    // Expected number of bubbles based on question type
    const expectedBubbles = questionType.type === 'mc'
      ? Math.min(4, Math.max(2, Number(questionType.options) || 4))
      : 2; // A,B,C,D... or T,F
    const bubbles = [];

    // Scan the row for bubbles
    const rowY = questionRow.y;
    const rowHeight = questionRow.height;

    for (let i = 0; i < expectedBubbles; i++) {
      const bubbleX = questionRow.questions[i] || (50 + i * layout.bubbleSpacing.horizontal);
      const bubbleY = rowY + rowHeight / 2;

      // Extract region around expected bubble location
      const regionSize = Math.max(
        12,
        Math.min(30, Math.round((layout.bubbleSize || 20) * 1.6))
      );
      const regionX = Math.max(0, bubbleX - regionSize / 2);
      const regionY = Math.max(0, bubbleY - regionSize / 2);
      const regionWidth = Math.min(regionSize, processedImage.cols - regionX);
      const regionHeight = Math.min(regionSize, processedImage.rows - regionY);

      if (regionWidth <= 2 || regionHeight <= 2) {
        bubbles.push({
          position: i,
          filled: false,
          confidence: 0,
          boundingBox: { x: regionX, y: regionY, width: regionWidth, height: regionHeight }
        });
        continue;
      }

      const region = processedImage.roi(
        new cv.Rect(regionX, regionY, regionWidth, regionHeight)
      );

      // Analyze the region for bubble presence
      const bubbleAnalysis = this.analyzeBubbleRegion(region, questionType.type, i);

      bubbles.push({
        position: i,
        filled: bubbleAnalysis.filled,
        confidence: bubbleAnalysis.confidence,
        boundingBox: {
          x: regionX,
          y: regionY,
          width: regionSize,
          height: regionSize
        }
      });

      region.delete();
    }

    // Determine the selected answer
    const filledBubbles = bubbles.filter(b => b.filled);
    let selectedAnswer = null;
    let maxConfidence = 0;

    if (filledBubbles.length === 1) {
      // Single bubble filled - use it
      const bubble = filledBubbles[0];
      selectedAnswer = questionType.type === 'mc'
        ? String.fromCharCode(65 + bubble.position) // A, B, C, D
        : (bubble.position === 0 ? 'T' : 'F'); // T, F
      maxConfidence = bubble.confidence;
    } else if (filledBubbles.length > 1) {
      // Multiple bubbles filled - use the one with highest confidence
      const bestBubble = filledBubbles.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
      selectedAnswer = questionType.type === 'mc'
        ? String.fromCharCode(65 + bestBubble.position)
        : (bestBubble.position === 0 ? 'T' : 'F');
      maxConfidence = bestBubble.confidence * 0.8; // Penalty for multiple selections
    }

    return {
      questionNumber: questionType.questionNumber,
      answer: selectedAnswer,
      confidence: maxConfidence,
      boundingBox: {
        x: questionRow.questions[0] || 50,
        y: rowY,
        width: expectedBubbles * layout.bubbleSpacing.horizontal,
        height: rowHeight
      }
    };
  }

  /**
   * Analyze a region to determine if it contains a filled bubble
   */
  private analyzeBubbleRegion(
    region: any,
    _questionType: 'mc' | 'tf',
    _position: number
  ): { filled: boolean; confidence: number } {
    const cv = this.cv;

    // Convert to grayscale if not already
    const gray = region.channels() === 1 ? region : (() => {
      const temp = new cv.Mat();
      cv.cvtColor(region, temp, cv.COLOR_BGR2GRAY);
      return temp;
    })();

    // Calculate the percentage of filled pixels
    const totalPixels = gray.rows * gray.cols;
    let filledPixels = 0;

    // Sample pixels in a grid pattern for performance
    const sampleStep = Math.max(1, Math.floor(Math.sqrt(totalPixels) / 10));

    for (let y = 0; y < gray.rows; y += sampleStep) {
      for (let x = 0; x < gray.cols; x += sampleStep) {
        if (gray.ucharPtr(y, x)[0] > 127) { // Threshold for "filled"
          filledPixels++;
        }
      }
    }

    const denom = Math.pow(Math.ceil(gray.rows / sampleStep), 2);
    const fillRatio = denom > 0 ? filledPixels / denom : 0;

    // Calculate confidence based on fill ratio and expected bubble characteristics
    let confidence = 0;
    let filled = false;

    if (fillRatio > 0.6) {
      // High fill ratio - likely filled
      filled = true;
      confidence = Math.min(1.0, fillRatio * 1.2); // Boost confidence for clearly filled bubbles
    } else if (fillRatio > 0.3) {
      // Medium fill ratio - ambiguous, but lean towards filled
      filled = true;
      confidence = fillRatio * 0.8; // Lower confidence for ambiguous cases
    } else if (fillRatio < 0.1) {
      // Low fill ratio - likely empty
      filled = false;
      confidence = (1 - fillRatio) * 0.9; // High confidence for clearly empty bubbles
    } else {
      // Medium-low fill ratio - likely empty but uncertain
      filled = false;
      confidence = (1 - fillRatio) * 0.7; // Moderate confidence
    }

    if (gray !== region) {
      gray.delete();
    }

    return { filled, confidence };
  }

  /**
   * Assess overall image quality for OCR
   */
  private async assessImageQuality(imageMat: any): Promise<number> {
    const cv = this.cv;

    // Ensure we're working with grayscale
    let gray = imageMat;
    if (imageMat.channels() > 1) {
      gray = new cv.Mat();
      cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);
    }

    // Calculate image sharpness (variance of Laplacian)
    const laplacian = new cv.Mat();
    cv.Laplacian(gray, laplacian, cv.CV_64F);

    const mean = new cv.Mat();
    const stddev = new cv.Mat();
    cv.meanStdDev(laplacian, mean, stddev);

    const sharpness = stddev.doublePtr(0)[0];

    // Calculate contrast (standard deviation of pixel intensities)
    const grayMean = new cv.Mat();
    const grayStddev = new cv.Mat();
    cv.meanStdDev(gray, grayMean, grayStddev);
    const contrast = grayStddev.doublePtr(0)[0];

    // Normalize sharpness: typical values range from 0-1000+ for good images
    // For a 1200x1600 image, good sharpness is usually 50-200+
    const normalizedSharpness = Math.min(1.0, Math.max(0.0, sharpness / 100));
    
    // Normalize contrast: typical values range from 0-128 for grayscale
    // Good contrast is usually 30-80+
    const normalizedContrast = Math.min(1.0, Math.max(0.0, contrast / 60));

    // Combine sharpness (60%) and contrast (40%) for overall quality
    const quality = (normalizedSharpness * 0.6) + (normalizedContrast * 0.4);

    // Cleanup
    laplacian.delete();
    mean.delete();
    stddev.delete();
    grayMean.delete();
    grayStddev.delete();
    if (gray !== imageMat) {
      gray.delete();
    }

    return quality;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(bubbles: BubbleDetectionResult[]): number {
    if (bubbles.length === 0) return 0;

    const confidences = bubbles.map(b => b.confidence);
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    if (avgConfidence === 0) {
      return 0;
    }

    // Penalize if many bubbles have low confidence
    const lowConfidenceCount = confidences.filter(c => c < 0.3).length;
    const penalty = lowConfidenceCount / bubbles.length * 0.1;

    return Math.max(0, Math.min(1, avgConfidence - penalty));
  }

  /**
   * Enhanced bubble detection with machine learning-inspired techniques
   */
  async detectBubblesML(
    imageData: ImageData,
    questionTypes: { questionNumber: number; type: 'mc' | 'tf'; options?: number }[]
  ): Promise<OCRResult> {
    // This would use more advanced ML techniques like:
    // - CNN for bubble detection
    // - Template matching with multiple templates
    // - Adaptive thresholding based on lighting conditions
    // - Handwriting recognition for written answers

    // For now, fall back to the enhanced algorithm
    return this.processAnswerSheet(imageData, questionTypes);
  }
}

// Export singleton instance
export const ocrService = new OCRService();
export default ocrService;
