import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Stage, Layer, Rect, Text, Group, Line } from 'react-konva';
import Konva from 'konva';

import Button from '../../ui/Button';
import Card from '../../ui/Card';

interface GrammarSentence {
  id: string;
  words: string[];
  correct: string;
}

interface GrammarDragData {
  lessonId: string;
  activityOrder: number;
  sentences: GrammarSentence[];
}

interface GrammarDragSentenceProps {
  lessonData: GrammarDragData;
  onComplete: (result?: any) => void;
}

interface WordItem {
  id: string;
  text: string;
  x: number;
  y: number;
  isPlaced: boolean;
  placedX?: number; // X position on the line when placed
  placedY?: number; // Y position (line 1 or line 2) - LINE_Y or LINE_Y_2
  lineNumber?: number; // 1 for first line, 2 for second line
  originalX?: number; // Original X position in word bank
  originalY?: number; // Original Y position in word bank
}

const GrammarDragSentence = memo<GrammarDragSentenceProps>(({ lessonData, onComplete }) => {

  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [words, setWords] = useState<WordItem[]>([]);
  const [placedWords, setPlacedWords] = useState<WordItem[]>([]); // Words placed on the line
  const [isCorrect, setIsCorrect] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasCalledOnComplete, setHasCalledOnComplete] = useState(false);
  const hasCalledOnCompleteRef = useRef(false);
  const [startTime] = useState(Date.now());
  
  const LINE_Y = 150; // Y position of the first drop line

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 });
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Responsive block dimensions
  const blockWidth = isMobile ? 55 : 75;
  const blockHeight = isMobile ? 24 : 32;
  const LINE_Y_2 = LINE_Y + blockHeight + 8; // Y position of the second drop line (below first, with spacing)
  const WORD_SPACING = isMobile ? 8 : 12; // Horizontal spacing between words
  const blockCenterX = blockWidth / 2;
  const blockCenterY = blockHeight / 2;
  const fontSize = isMobile ? 10 : 13;
  const strokeWidth = isMobile ? 1.5 : 2;
  const cornerRadius = isMobile ? 3 : 4;

  const currentSentence = lessonData.sentences[currentSentenceIndex];

  // Calculate correct word order from database
  const correctWordOrder = currentSentence?.words || [];

  // Reset component state when switching to a new grammar activity (same step)
  useEffect(() => {
    console.warn('🔄 GrammarDragSentence: Resetting state for new activity', {
      activityOrder: lessonData.activityOrder
    });
    setHasCalledOnComplete(false);
    hasCalledOnCompleteRef.current = false;
    setIsComplete(false);
    setIsCorrect(false);
    setPlacedWords([]);
    setCurrentSentenceIndex(0);
  }, [lessonData.activityOrder]);

  // Initialize words for current sentence
  useEffect(() => {
    if (!currentSentence) return;

    // Update canvas size - calculate height based on number of words
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const width = Math.min(800, containerRef.current.clientWidth - 40);
        const wordWidth = isMobile ? 55 : 75;
        const wordSpacingX = isMobile ? 8 : 12;
        const wordsPerRow = Math.floor((width - 40) / (wordWidth + wordSpacingX));
        const rowsNeeded = Math.ceil(currentSentence.words.length / wordsPerRow);
        const wordHeight = isMobile ? 24 : 32;
        const wordSpacingY = isMobile ? 6 : 8;
        const wordContainerTop = 250;
        const minHeight = wordContainerTop + rowsNeeded * (wordHeight + wordSpacingY) + 30; // 30px bottom margin
        const height = Math.max(400, minHeight); // Minimum 400px, but expand if needed
        setCanvasSize({ width, height });
      }
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [currentSentence]);

  // Initialize words when sentence changes
  useEffect(() => {
    if (!currentSentence) return;

    // Shuffle words for display
    const shuffled = [...currentSentence.words].sort(() => Math.random() - 0.5);
    
    // Calculate word container bounds (bottom area of canvas)
    const wordContainerTop = 250; // Start word container below the drop line
    const wordContainerHeight = canvasSize.height - wordContainerTop - 20; // Leave 20px margin at bottom
    const wordWidth = isMobile ? 55 : 75; // Responsive width
    const wordHeight = isMobile ? 24 : 32; // Responsive height
    const wordSpacingX = isMobile ? 8 : 12; // Reduced horizontal spacing on mobile
    const wordSpacingY = isMobile ? 6 : 8; // Reduced vertical spacing on mobile
    const wordsPerRow = Math.floor((canvasSize.width - 40) / (wordWidth + wordSpacingX)); // Calculate how many fit per row
    
    const wordItems: WordItem[] = shuffled.map((word, index) => {
      const row = Math.floor(index / wordsPerRow);
      const col = index % wordsPerRow;
      const x = 20 + col * (wordWidth + wordSpacingX);
      const y = wordContainerTop + row * (wordHeight + wordSpacingY);
      
      // Ensure words don't go outside container
      const maxY = wordContainerTop + wordContainerHeight - wordHeight;
      const constrainedY = Math.min(y, maxY);
      
      return {
        id: `word_${index}_${word}`,
        text: word,
        x,
        y: constrainedY,
        isPlaced: false,
        originalX: x,
        originalY: constrainedY
      };
    });

    setWords(wordItems);
    setPlacedWords([]);
    setIsCorrect(false);
  }, [currentSentence, currentSentenceIndex, canvasSize.width, canvasSize.height]);

  // Check if a word would overlap with existing words on a line
  const wouldOverlap = useCallback((x: number, lineWords: WordItem[], excludeWordId?: string): boolean => {
    return lineWords.some(w => {
      if (w.id === excludeWordId || !w.placedX) return false;
      // Check if word boundaries overlap
      const wordLeft = w.placedX;
      const wordRight = w.placedX + blockWidth;
      const newWordLeft = x;
      const newWordRight = x + blockWidth;
      return !(newWordRight <= wordLeft || newWordLeft >= wordRight);
    });
  }, [blockWidth]);

  // Reset all words - used when sentence is incorrect
  const resetAllWords = useCallback(() => {
    setWords(prev => prev.map(word => ({
      ...word,
      isPlaced: false,
      placedX: undefined,
      placedY: undefined,
      lineNumber: undefined,
      x: word.originalX || word.x,
      y: word.originalY || word.y
    })));
    setPlacedWords([]);
    setIsCorrect(false);
  }, []);

  // Reorganize words to move overlapping words to second line
  const reorganizeWordsOnLines = useCallback((allPlacedWords: WordItem[]): WordItem[] => {
    const wordsOnLine1 = allPlacedWords.filter(w => !w.lineNumber || w.lineNumber === 1);
    const wordsOnLine2 = allPlacedWords.filter(w => w.lineNumber === 2);
    const startX = isMobile ? 0 : 20;
    
    // Sort words on line 1 by X position
    const sortedLine1 = [...wordsOnLine1].sort((a, b) => (a.placedX || 0) - (b.placedX || 0));
    const reorganized: WordItem[] = [];
    const movedToLine2: WordItem[] = [];
    
    // Check each word on line 1 for overlaps
    sortedLine1.forEach((word, index) => {
      if (index === 0) {
        // First word stays on line 1
        reorganized.push(word);
      } else {
        const prevWord = sortedLine1[index - 1];
        const prevWordRight = (prevWord.placedX || 0) + blockWidth;
        const currentWordLeft = word.placedX || 0;
        
        // Check if overlaps with previous word (with spacing)
        if (currentWordLeft < prevWordRight + WORD_SPACING) {
          // Overlaps - move to line 2
          const newX = movedToLine2.length === 0 
            ? startX 
            : (movedToLine2[movedToLine2.length - 1].placedX || startX) + blockWidth + WORD_SPACING;
          
          movedToLine2.push({
            ...word,
            placedX: newX,
            placedY: LINE_Y_2,
            lineNumber: 2
          });
        } else {
          // No overlap - stays on line 1
          reorganized.push(word);
        }
      }
    });
    
    // Add words that were already on line 2
    reorganized.push(...wordsOnLine2);
    // Add words moved to line 2
    reorganized.push(...movedToLine2);
    
    return reorganized;
  }, [blockWidth, WORD_SPACING, isMobile, LINE_Y_2]);

  // Check if sentence is correct
  const checkCorrectness = useCallback(() => {
    if (!currentSentence) return;

    const allPlaced = placedWords.length === currentSentence.words.length;
    if (!allPlaced) return;

    // Get words in order: first line 1 (left to right), then line 2 (left to right)
    const sortedPlacedWords = [...placedWords]
      .sort((a, b) => {
        // Sort by line number first, then by X position
        const lineA = a.lineNumber || 1;
        const lineB = b.lineNumber || 1;
        if (lineA !== lineB) return lineA - lineB;
        return (a.placedX || 0) - (b.placedX || 0);
      });

    const orderedWords = sortedPlacedWords.map(word => word.text);
    const userSentence = orderedWords.join(' ');
    const isSentenceCorrect = userSentence === currentSentence.correct;

    setIsCorrect(isSentenceCorrect);

    if (!isSentenceCorrect) {
      // Reset all words back to word bank
      setTimeout(() => {
        resetAllWords();
      }, 500); // Small delay before reset
    }
  }, [currentSentence, placedWords, resetAllWords]);

  // Handle drag end - words are automatically positioned left to right, move to second line if overlap
  const handleDragEnd = useCallback((e: any, wordId: string) => {
    const word = words.find(w => w.id === wordId);
    if (!word || word.isPlaced) return;

    const pointerPos = e.target.getStage()?.getPointerPosition();
    if (!pointerPos) return;

    // Check if dropped above the second line (anywhere above LINE_Y_2 sticks)
    const isAboveLines = pointerPos.y < LINE_Y_2;
    const padding = isMobile ? 0 : 20;
    const isWithinCanvas = pointerPos.x >= padding && pointerPos.x <= canvasSize.width - padding;

    if (isAboveLines && isWithinCanvas) {
      const startX = isMobile ? 0 : 20; // Start position with padding
      
      // Get words on first line and second line
      const wordsOnLine1 = placedWords.filter(w => !w.lineNumber || w.lineNumber === 1);
      const wordsOnLine2 = placedWords.filter(w => w.lineNumber === 2);
      
      let placedX: number;
      let placedY: number;
      let lineNumber: number;
      
      if (placedWords.length === 0) {
        // First word goes to the leftmost position on first line
        placedX = startX;
        placedY = LINE_Y;
        lineNumber = 1;
      } else {
        // Try to place on first line
        const sortedLine1Words = [...wordsOnLine1].sort((a, b) => (a.placedX || 0) - (b.placedX || 0));
        const rightmostWord = sortedLine1Words[sortedLine1Words.length - 1];
        const rightmostX = rightmostWord.placedX || startX;
        const candidateX = rightmostX + blockWidth + WORD_SPACING;
        
        // Check if this would overlap on first line
        if (wouldOverlap(candidateX, wordsOnLine1)) {
          // Would overlap - move to second line
          if (wordsOnLine2.length === 0) {
            // First word on second line
            placedX = startX;
          } else {
            // Find rightmost word on second line
            const sortedLine2Words = [...wordsOnLine2].sort((a, b) => (a.placedX || 0) - (b.placedX || 0));
            const rightmostWord2 = sortedLine2Words[sortedLine2Words.length - 1];
            const rightmostX2 = rightmostWord2.placedX || startX;
            placedX = rightmostX2 + blockWidth + WORD_SPACING;
          }
          placedY = LINE_Y_2;
          lineNumber = 2;
        } else {
          // No overlap - place on first line
          placedX = candidateX;
          placedY = LINE_Y;
          lineNumber = 1;
        }
        
        // Ensure word doesn't go outside canvas
        const rightPadding = isMobile ? 5 : 20;
        const maxX = canvasSize.width - blockWidth - rightPadding;
        if (placedX > maxX) {
          // If would overflow on current line, try second line
          if (lineNumber === 1 && wordsOnLine2.length === 0) {
            placedX = startX;
            placedY = LINE_Y_2;
            lineNumber = 2;
          } else if (lineNumber === 1) {
            // Move to second line
            const sortedLine2Words = [...wordsOnLine2].sort((a, b) => (a.placedX || 0) - (b.placedX || 0));
            const rightmostWord2 = sortedLine2Words[sortedLine2Words.length - 1];
            const rightmostX2 = rightmostWord2.placedX || startX;
            placedX = rightmostX2 + blockWidth + WORD_SPACING;
            placedY = LINE_Y_2;
            lineNumber = 2;
          } else {
            placedX = maxX;
          }
        }
      }
      
      const updatedWord: WordItem = {
        ...word,
        isPlaced: true,
        placedX: placedX,
        placedY: placedY,
        lineNumber: lineNumber
      };

      setWords(prev => prev.map(w => w.id === wordId ? updatedWord : w));
      setPlacedWords(prev => {
        const newPlacedWords = [...prev, updatedWord];
        // Reorganize words: check if any words on line 1 should move to line 2 due to overlap
        return reorganizeWordsOnLines(newPlacedWords);
      });

      // Snap to calculated position
      e.target.position({ x: placedX, y: placedY - blockCenterY }); // Center vertically on line
      e.target.draggable(false);

      // Check if all words are placed
      const allPlaced = words.length > 0 && words.every(w => w.id === wordId ? true : w.isPlaced);
      if (allPlaced) {
        checkCorrectness();
      }

      return;
    }

    // Not dropped on the line, return to original position
    e.target.position({ x: word.originalX || word.x, y: word.originalY || word.y });
  }, [words, canvasSize.width, placedWords, blockWidth, blockCenterY, isMobile, WORD_SPACING, wouldOverlap, reorganizeWordsOnLines, checkCorrectness]);

  // Handle clicking a word on the line to return it to word bank
  const handlePlacedWordClick = useCallback((wordId: string) => {
    const word = words.find(w => w.id === wordId);
    if (!word || !word.isPlaced) return;

    // Return word to word bank
    const returnedWord: WordItem = {
      ...word,
      isPlaced: false,
      placedX: undefined,
      x: word.originalX || word.x,
      y: word.originalY || word.y
    };

    setWords(prev => prev.map(w => w.id === wordId ? returnedWord : w));
    setPlacedWords(prev => prev.filter(w => w.id !== wordId));
    setIsCorrect(false);
  }, [words]);

  // Auto-check when all words are placed
  useEffect(() => {
    if (placedWords.length === currentSentence?.words.length) {
      checkCorrectness();
    }
  }, [placedWords, currentSentence, checkCorrectness]);


  // Check sentence completion for correctness feedback
  useEffect(() => {
    if (!currentSentence) return;

    const allPlaced = words.length > 0 && words.every(w => w.isPlaced);
    if (!allPlaced) return;

    // Check if current sentence is correct
    const sortedPlacedWords = [...placedWords]
      .sort((a, b) => {
        const lineA = a.lineNumber || 1;
        const lineB = b.lineNumber || 1;
        if (lineA !== lineB) return lineA - lineB;
        return (a.placedX || 0) - (b.placedX || 0);
      });

    const orderedWords = sortedPlacedWords.map(word => word.text);
    const userSentence = orderedWords.join(' ');
    const isSentenceCorrect = userSentence === currentSentence.correct;

    setIsCorrect(isSentenceCorrect);
  }, [currentSentence, words, placedWords]);

  // Handle completion - send in background (non-blocking)
  const handleComplete = useCallback(() => {
    console.warn('🔵 GrammarDragSentence: handleComplete called', {
      hasCalledOnComplete,
      hasCalledOnCompleteRef: hasCalledOnCompleteRef.current,
      activityOrder: lessonData.activityOrder,
      sentencesCount: lessonData.sentences.length
    });

    // Guard duplicate completion calls (match vocab pattern)
    if (hasCalledOnComplete || hasCalledOnCompleteRef.current) {
      console.warn('⚠️ GrammarDragSentence: Already called onComplete, ignoring');
      return;
    }
    setHasCalledOnComplete(true);
    hasCalledOnCompleteRef.current = true;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    // Pass result object to onComplete - parent will handle background save
    const result = {
      activityId: `grammar-${lessonData.activityOrder}`,
      activityType: 'grammar_sentences', // Match database activity type
      activityOrder: lessonData.activityOrder,
      score: lessonData.sentences.length,
      maxScore: lessonData.sentences.length,
      attempts: 1,
      timeSpent,
      completedAt: new Date().toISOString(),
      answers: {
        sentencesCompleted: lessonData.sentences.length
      }
    };

    console.warn('✅ GrammarDragSentence: Calling onComplete with result', result);
    console.warn('📤 GrammarDragSentence: Calling onComplete callback', result);

    // IMMEDIATE PROGRESSION - trigger next activity loading immediately
    onComplete(result);

    console.warn('✅ GrammarDragSentence: onComplete callback returned - progression started');
    console.warn('🔄 GrammarDragSentence: Completion continues in background (non-blocking)');

    // Safety timeout similar to vocab: if progression fails, reset loading state
    setTimeout(() => {
      if (hasCalledOnCompleteRef.current) {
        console.warn('⏱️ GrammarDragSentence: Progression timeout (2s) - resetting loading state');
        setHasCalledOnComplete(false);
        hasCalledOnCompleteRef.current = false;
      } else {
        console.warn('✅ GrammarDragSentence: Progression succeeded (component likely remounted)');
      }
    }, 2000);
  }, [lessonData, startTime, onComplete]);

  if (!currentSentence) {
    return (
      <Card>
        <Card.Body>
          <p>No sentence data available.</p>
        </Card.Body>
      </Card>
    );
  }

  const placedCount = placedWords.length;
  const totalWords = currentSentence.words.length;
  const allPlaced = placedCount === totalWords;

  return (
    <Card>
      <Card.Header>
        <h3 className="text-lg md:text-xl font-semibold">Grammar Construction</h3>
        <p className="text-sm text-neutral-600">
          Drag words to construct a sentence
        </p>
        <div className="mt-2 text-sm">
          Sentence {currentSentenceIndex + 1} of {lessonData.sentences.length}
        </div>
      </Card.Header>
      <Card.Body>
        <div className="mb-4">
          <div className="flex justify-between text-sm text-neutral-600 mb-2">
            <span>Progress</span>
            <span>{placedCount}/{totalWords} words placed</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(placedCount / totalWords) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Success message */}
        {isCorrect && allPlaced && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <p className="text-sm md:text-lg font-semibold text-green-800 text-center">
              Correct! Well done!
            </p>
          </div>
        )}

        {/* Canvas for drag and drop */}
        <div ref={containerRef} className="relative w-full border-2 border-gray-200 rounded-lg overflow-hidden mb-4">
          <Stage width={canvasSize.width} height={canvasSize.height} ref={stageRef}>
            <Layer>
              {/* Drop zone lines - first line */}
              <Line
                points={[isMobile ? 0 : 50, LINE_Y, canvasSize.width - (isMobile ? 0 : 50), LINE_Y]}
                stroke="#9ca3af"
                strokeWidth={2}
                dash={[10, 5]}
              />
              
              {/* Second line - only show when there are words on it */}
              {placedWords.some(w => w.lineNumber === 2) && (
                <Line
                  points={[isMobile ? 0 : 50, LINE_Y_2, canvasSize.width - (isMobile ? 0 : 50), LINE_Y_2]}
                  stroke="#9ca3af"
                  strokeWidth={2}
                  dash={[10, 5]}
                />
              )}

              {/* Placed words on the lines (clickable to return to word bank) - sorted by line then X position */}
              {[...placedWords]
                .sort((a, b) => {
                  // Sort by line number first, then by X position
                  const lineA = a.lineNumber || 1;
                  const lineB = b.lineNumber || 1;
                  if (lineA !== lineB) return lineA - lineB;
                  return (a.placedX || 0) - (b.placedX || 0);
                })
                .map((word) => {
                  const wordY = word.placedY || LINE_Y;
                  return (
                    <Group
                      key={word.id}
                      x={word.placedX || 0}
                      y={wordY - blockCenterY}
                  onClick={() => handlePlacedWordClick(word.id)}
                  onTap={() => handlePlacedWordClick(word.id)}
                  onMouseEnter={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) {
                      container.style.cursor = 'pointer';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) {
                      container.style.cursor = 'default';
                    }
                  }}
                >
                  {/* Word box on line */}
                  <Rect
                    width={blockWidth}
                    height={blockHeight}
                    fill="#f3f4f6"
                    stroke="#9ca3af"
                    strokeWidth={strokeWidth}
                    cornerRadius={cornerRadius}
                  />
                  <Text
                    text={word.text}
                    x={blockCenterX}
                    y={blockCenterY}
                    fontSize={fontSize}
                    fontFamily="Arial"
                    fill="#1f2937"
                    align="center"
                    verticalAlign="middle"
                    width={blockWidth}
                    height={blockHeight}
                    offsetX={blockCenterX}
                    offsetY={blockCenterY}
                    wrap="word"
                    ellipsis={true}
                    listening={false}
                  />
                    </Group>
                  );
                })}

              {/* Word container background (visual boundary) */}
              <Rect
                x={10}
                y={250}
                width={canvasSize.width - 20}
                height={canvasSize.height - 270}
                fill="#f9fafb"
                stroke="#e5e7eb"
                strokeWidth={1}
                cornerRadius={8}
                opacity={0.5}
              />

              {/* Draggable words (only show unplaced words) */}
              {words.filter(w => !w.isPlaced).map((word) => (
                <Group
                  key={word.id}
                  x={word.x}
                  y={word.y}
                  draggable={true}
                  onDragStart={(e) => {
                    e.target.moveToTop();
                  }}
                  onDragEnd={(e) => handleDragEnd(e, word.id)}
                >
                  {/* Word box with white border and purple shadow - minimal padding */}
                  <Rect
                    width={blockWidth}
                    height={blockHeight}
                    fill="white"
                    stroke="#ffffff"
                    strokeWidth={strokeWidth}
                    cornerRadius={cornerRadius}
                    shadowColor="#9333ea"
                    shadowBlur={isMobile ? 4 : 6}
                    shadowOffset={{ x: 0, y: isMobile ? 1 : 2 }}
                    shadowOpacity={0.3}
                  />
                  <Text
                    text={word.text}
                    x={blockCenterX}
                    y={blockCenterY}
                    fontSize={fontSize}
                    fontFamily="Arial"
                    fill="#1f2937"
                    align="center"
                    verticalAlign="middle"
                    width={blockWidth}
                    height={blockHeight}
                    offsetX={blockCenterX}
                    offsetY={blockCenterY}
                    wrap="word"
                    ellipsis={true}
                    listening={false}
                  />
                </Group>
              ))}
            </Layer>
          </Stage>
        </div>

        {/* Instructions */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            💡 <strong>Tip:</strong> Drag words from below to the line above to construct the sentence.
            Words will disappear from the container once placed. You can remove words by tapping on them.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-neutral-600">
            {isComplete
              ? 'All sentences completed! Ready to continue.'
              : allPlaced
                ? currentSentenceIndex < lessonData.sentences.length - 1
                  ? 'Sentence completed. Click "Next Sentence" to continue.'
                  : 'All sentences completed! Click "Complete Activity" to finish.'
                : 'Place all words to form the sentence'
            }
          </div>

          <Button
            onClick={() => {
              // Prevent multiple clicks using ref
              if (hasCalledOnCompleteRef.current) {
                console.warn('⚠️ GrammarDragSentence: Button click ignored - already processing');
                return;
              }

              console.warn('🔴 GrammarDragSentence: BUTTON CLICKED!', {
                isComplete,
                allPlaced,
                isCorrect,
                hasCalledOnComplete,
                hasCalledOnCompleteRef: hasCalledOnCompleteRef.current,
                currentSentenceIndex,
                totalSentences: lessonData.sentences.length
              });

              if (isComplete) {
                console.warn('🔴 GrammarDragSentence: Calling handleComplete from button');
                handleComplete();
              } else if (allPlaced) {
                // Move to next sentence regardless of correctness
                if (currentSentenceIndex < lessonData.sentences.length - 1) {
                  console.warn('➡️ GrammarDragSentence: Moving to next sentence', {
                    from: currentSentenceIndex,
                    to: currentSentenceIndex + 1
                  });
                  setCurrentSentenceIndex(prev => prev + 1);
                  setPlacedWords([]);
                  setIsCorrect(false);
                  // Reset completion flags so next activity is a fresh instance
                  setHasCalledOnComplete(false);
                  hasCalledOnCompleteRef.current = false;
                } else {
                  // Last sentence - complete immediately (no second click)
                  console.warn('✅ GrammarDragSentence: Last sentence completed - calling handleComplete immediately');
                  handleComplete();
                }
              }
            }}
            disabled={!allPlaced || hasCalledOnComplete}
            loading={hasCalledOnComplete}
            size="sm"
            className={isComplete || allPlaced ? 'bg-blue-500 hover:bg-blue-600' : ''}
          >
            {hasCalledOnComplete && isComplete
              ? 'Loading...'
              : isComplete
                ? 'Next'
                : 'Next'}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
});

GrammarDragSentence.displayName = 'GrammarDragSentence';

export default GrammarDragSentence;
