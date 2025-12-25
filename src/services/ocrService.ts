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
}

class OCRService {
  private cv: any = null;
  private isInitialized = false;

  /**
   * Initialize OpenCV
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
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
    questionTypes: { questionNumber: number; type: 'mc' | 'tf' }[]
  ): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Convert input to OpenCV Mat
      const mat = await this.imageDataToMat(imageData);

      // Enhanced preprocessing pipeline
      const processedImage = await this.preprocessImage(mat);

      // Detect answer sheet layout
      const layout = await this.detectLayout(processedImage);

      // Detect and analyze bubbles
      const bubbles = await this.detectBubbles(processedImage, layout, questionTypes);

      // Calculate overall confidence and quality
      const confidence = this.calculateOverallConfidence(bubbles);
      const imageQuality = await this.assessImageQuality(processedImage);

      // Cleanup
      mat.delete();
      processedImage.delete();

      return {
        detectedBubbles: bubbles,
        recognizedNumbers: [], // TODO: Implement student ID recognition
        processingTime: Date.now() - startTime,
        imageQuality,
        confidence
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
    const startTime = Date.now();
    const cv = this.cv;

    try {
      // Convert ImageData to OpenCV Mat
      const src = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      const processed = new cv.Mat();

      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Apply preprocessing for better square detection
      cv.GaussianBlur(gray, processed, new cv.Size(3, 3), 0);
      cv.adaptiveThreshold(processed, processed, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

      // Find contours
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(processed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

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

      // Resize to standard size for recognition (28x28 for MNIST-like models)
      const resized = new cv.Mat();
      cv.resize(roi, resized, new cv.Size(28, 28), 0, 0, cv.INTER_LINEAR);

      // Apply threshold to get binary image
      const binary = new cv.Mat();
      cv.threshold(resized, binary, 127, 255, cv.THRESH_BINARY_INV);

      // Simple digit recognition using pixel density analysis
      // This is a basic implementation - in production, use a trained ML model
      const digit = this.recognizeDigitByFeatures(binary);

      // Calculate confidence based on how well the pattern matches expected digit shapes
      const confidence = this.calculateDigitConfidence(binary, digit);

      // Cleanup
      roi.delete();
      resized.delete();
      binary.delete();

      return { digit, confidence };

    } catch (error) {
      console.error('Digit recognition error:', error);
      return { digit: null, confidence: 0 };
    }
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
    questionTypes: { questionNumber: number; type: 'mc' | 'tf' }[],
    studentIdDigits: number
  ): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Get regular OCR results
      const ocrResult = await this.processAnswerSheet(imageData, questionTypes);

      // Recognize student ID numbers
      const recognizedNumbers = await this.recognizeNumbersInSquares(
        imageData as ImageData,
        studentIdDigits
      );

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

    // Morphological operations to clean up the image
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
    const morphed = new cv.Mat();
    cv.morphologyEx(thresholded, morphed, cv.MORPH_CLOSE, kernel);

    // Cleanup intermediate mats
    gray.delete();
    blurred.delete();
    thresholded.delete();
    kernel.delete();

    return morphed;
  }

  /**
   * Detect the answer sheet layout and structure
   */
  private async detectLayout(processedImage: any): Promise<{
    questionRows: Array<{ y: number; height: number; questions: number[] }>;
    bubbleSpacing: { horizontal: number; vertical: number };
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
    for (let i = 0; i < contours.size(); i++) {
      const rect = cv.boundingRect(contours.get(i));
      boundingRects.push(rect);
    }

    // Group contours by Y position to identify rows
    const rows = this.groupContoursByRows(boundingRects);

    // Calculate spacing based on detected layout
    const spacing = this.calculateBubbleSpacing(boundingRects);

    // Cleanup
    contours.delete();
    hierarchy.delete();

    return {
      questionRows: rows,
      bubbleSpacing: spacing
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
    questionTypes: { questionNumber: number; type: 'mc' | 'tf' }[]
  ): Promise<BubbleDetectionResult[]> {
    const cv = this.cv;
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

  /**
   * Detect bubbles for a specific question
   */
  private async detectQuestionBubbles(
    processedImage: any,
    layout: any,
    questionType: { questionNumber: number; type: 'mc' | 'tf' }
  ): Promise<BubbleDetectionResult | null> {
    const cv = this.cv;

    // Find the row for this question number
    const questionRow = layout.questionRows.find((row: any, index: number) =>
      index + 1 === questionType.questionNumber
    );

    if (!questionRow) {
      return null;
    }

    // Expected number of bubbles based on question type
    const expectedBubbles = questionType.type === 'mc' ? 4 : 2; // A,B,C,D or T,F
    const bubbles = [];

    // Scan the row for bubbles
    const rowY = questionRow.y;
    const rowHeight = questionRow.height;

    for (let i = 0; i < expectedBubbles; i++) {
      const bubbleX = questionRow.questions[i] || (50 + i * layout.bubbleSpacing.horizontal);
      const bubbleY = rowY + rowHeight / 2;

      // Extract region around expected bubble location
      const regionSize = 20;
      const regionX = Math.max(0, bubbleX - regionSize / 2);
      const regionY = Math.max(0, bubbleY - regionSize / 2);

      const region = processedImage.roi(
        new cv.Rect(regionX, regionY, regionSize, regionSize)
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
    questionType: 'mc' | 'tf',
    position: number
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

    const fillRatio = filledPixels / Math.pow(Math.ceil(gray.rows / sampleStep), 2);

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
  private async assessImageQuality(processedImage: any): Promise<number> {
    const cv = this.cv;

    // Calculate image sharpness (variance of Laplacian)
    const laplacian = new cv.Mat();
    cv.Laplacian(processedImage, laplacian, cv.CV_64F);

    const mean = new cv.Mat();
    const stddev = new cv.Mat();
    cv.meanStdDev(laplacian, mean, stddev);

    const sharpness = stddev.doublePtr(0)[0];

    // Normalize to 0-1 scale (rough heuristic)
    const quality = Math.min(1.0, Math.max(0.0, sharpness / 500));

    // Cleanup
    laplacian.delete();
    mean.delete();
    stddev.delete();

    return quality;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(bubbles: BubbleDetectionResult[]): number {
    if (bubbles.length === 0) return 0;

    const confidences = bubbles.map(b => b.confidence);
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;

    // Penalize if many bubbles have low confidence
    const lowConfidenceCount = confidences.filter(c => c < 0.7).length;
    const penalty = lowConfidenceCount / bubbles.length * 0.2;

    return Math.max(0, Math.min(1, avgConfidence - penalty));
  }

  /**
   * Enhanced bubble detection with machine learning-inspired techniques
   */
  async detectBubblesML(
    imageData: ImageData,
    questionTypes: { questionNumber: number; type: 'mc' | 'tf' }[]
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
