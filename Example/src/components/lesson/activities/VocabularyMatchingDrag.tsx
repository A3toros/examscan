import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import Konva from 'konva';

import Button from '../../ui/Button';
import Card from '../../ui/Card';

interface VocabularyMatchingData {
  lessonId: string;
  activityOrder: number;
  leftWords: string[];
  rightWords: string[];
  correctPairs: number[];
}

interface VocabularyMatchingDragProps {
  lessonData: VocabularyMatchingData;
  onComplete: (results?: {
    activityId?: string;
    activityType?: string;
    activityOrder?: number;
    score: number;
    maxScore: number;
    attempts?: number;
    timeSpent: number;
    answers: any;
    completedAt?: string;
  }) => void;
}

const VocabularyMatchingDrag = memo<VocabularyMatchingDragProps>(({ lessonData, onComplete }) => {
  const [hasCalledOnComplete, setHasCalledOnComplete] = useState(false);

  // State management
  const [displayData, setDisplayData] = useState<{leftWords: string[], rightWords: string[], correctPairs: number[]} | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<{[key: number]: number}>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Container ref for actual width
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  
  // Responsive sizing hook
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600
  });
  
  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Shuffle array helper
  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Initialize display data with shuffling
  useEffect(() => {
    if (lessonData) {
      console.log('🎯 VocabularyMatchingDrag: Initializing display data:', lessonData);
      console.log('🎯 Left words:', lessonData.leftWords);
      console.log('🎯 Right words:', lessonData.rightWords);
      console.log('🎯 Correct pairs:', lessonData.correctPairs);
      
      // Validate data structure
      if (!Array.isArray(lessonData.leftWords) || !Array.isArray(lessonData.rightWords)) {
        console.warn('🎯 Invalid data structure - leftWords or rightWords not arrays:', {
          leftWords: lessonData.leftWords,
          rightWords: lessonData.rightWords
        });
        return;
      }
      
      // Store original correct pairs mapping (leftIndex -> rightIndex)
      const originalCorrectPairs = lessonData.correctPairs || lessonData.leftWords.map((_, index) => index);
      
      // Create index arrays for shuffling
      const leftIndices = lessonData.leftWords.map((_, i) => i);
      const rightIndices = lessonData.rightWords.map((_, i) => i);
      
      // Shuffle both index arrays
      const shuffledLeftIndices = shuffleArray(leftIndices);
      const shuffledRightIndices = shuffleArray(rightIndices);
      
      // Create shuffled word arrays
      const shuffledLeftWords = shuffledLeftIndices.map(i => lessonData.leftWords[i]);
      const shuffledRightWords = shuffledRightIndices.map(i => lessonData.rightWords[i]);
      
      // Update correctPairs mapping to reflect shuffled positions
      // For each shuffled left word at position i, find which shuffled right word it should match
      const newCorrectPairs: number[] = [];
      for (let i = 0; i < shuffledLeftIndices.length; i++) {
        const originalLeftIndex = shuffledLeftIndices[i];
        const originalRightIndex = originalCorrectPairs[originalLeftIndex];
        // Find where this right word ended up in the shuffled array
        const newRightIndex = shuffledRightIndices.indexOf(originalRightIndex);
        newCorrectPairs[i] = newRightIndex;
      }
      
      console.log('🎯 Shuffled data:', {
        originalLeftWords: lessonData.leftWords,
        shuffledLeftWords,
        originalRightWords: lessonData.rightWords,
        shuffledRightWords,
        originalCorrectPairs,
        newCorrectPairs
      });
      
      setDisplayData({
        leftWords: shuffledLeftWords,
        rightWords: shuffledRightWords,
        correctPairs: newCorrectPairs
      });
    }
  }, [lessonData.leftWords, lessonData.rightWords, lessonData.correctPairs, shuffleArray]);
  
  // Responsive breakpoints
  const BREAKPOINTS = {
    VERY_SMALL: 400,
    MOBILE: 600,
    TABLET: 900
  };
  
  // Abstract sizing scale
  const SCALE = {
    VERY_SMALL: 0.6,
    MOBILE: 0.8,
    TABLET: 0.9,
    DESKTOP: 1.0
  };
  
  // Base dimensions (desktop reference)
  const BASE = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 400,
    BLOCK_WIDTH: 140,
    BLOCK_HEIGHT: 50,
    BLOCK_SPACING: 80, // Reduced spacing for tighter layout
    MARGIN: 50,
    PADDING: 20
  };
  
  // Determine screen size category
  const isVerySmall = screenSize.width < BREAKPOINTS.VERY_SMALL;
  const isMobile = screenSize.width >= BREAKPOINTS.VERY_SMALL && screenSize.width < BREAKPOINTS.MOBILE;
  const isTablet = screenSize.width >= BREAKPOINTS.MOBILE && screenSize.width < BREAKPOINTS.TABLET;
  const isDesktop = screenSize.width >= BREAKPOINTS.TABLET;
  
  // Get current scale factor
  const scale = isVerySmall ? SCALE.VERY_SMALL : 
                isMobile ? SCALE.MOBILE : 
                isTablet ? SCALE.TABLET : SCALE.DESKTOP;
  
  // Update canvas width when container is available
  useEffect(() => {
    const updateCanvasWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        console.log('🎯 Container width detected:', width);
        if (width > 0) {
          setCanvasWidth(width);
        }
      }
    };

    // Initial check
    updateCanvasWidth();

    // Use multiple attempts for mobile devices
    const timeoutIds = [
      setTimeout(updateCanvasWidth, 50),
      setTimeout(updateCanvasWidth, 100),
      setTimeout(updateCanvasWidth, 200),
      setTimeout(updateCanvasWidth, 500)
    ];

    // Also listen for resize events
    window.addEventListener('resize', updateCanvasWidth);

    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
      window.removeEventListener('resize', updateCanvasWidth);
    };
  }, [displayData]); // Re-run when displayData changes
  
  // Responsive block dimensions
  const blockWidth = BASE.BLOCK_WIDTH * scale;
  const blockHeight = BASE.BLOCK_HEIGHT * scale;
  const blockSpacing = BASE.BLOCK_SPACING * scale;
  
  // Responsive positioning
  const margin = BASE.MARGIN * scale;
  const minGap = 60 * scale; // Minimum gap between left and right blocks
  const leftBlockX = margin;
  
  // Debug logging for mobile issues
  console.log('🎯 Mobile Debug:', {
    screenWidth: screenSize.width,
    containerWidth: containerRef.current?.clientWidth,
    canvasWidth,
    scale,
    blockWidth,
    margin,
    leftBlockX,
    displayDataLoaded: !!displayData
  });
  
  // Check if blocks can fit side by side
  const minRequiredWidth = leftBlockX + blockWidth + 20 + blockWidth + margin;
  const canFitSideBySide = minRequiredWidth <= canvasWidth;
  
  // Keep right blocks inside canvas - constrained by parent container
  // Ensure right blocks never go outside the canvas
  let rightBlockX: number;
  let actualBlockWidth = blockWidth;
  let actualBlockHeight = blockHeight;
  
  if (canFitSideBySide) {
    // Normal side-by-side layout
    rightBlockX = Math.min(
      Math.max(
        leftBlockX + blockWidth + 20, // Minimum gap from left block
        canvasWidth - blockWidth - margin // Right edge with margin
      ),
      canvasWidth - blockWidth - margin // Never exceed right edge
    );
  } else {
    // Very small screen - make blocks smaller and ensure they fit
    const availableWidth = canvasWidth - margin * 2;
    const maxBlockWidth = Math.floor((availableWidth - 20) / 2); // Split available width between two blocks
    actualBlockWidth = Math.max(60, maxBlockWidth); // Minimum 60px width
    actualBlockHeight = Math.max(30, actualBlockHeight * (actualBlockWidth / blockWidth)); // Scale height proportionally
    
    rightBlockX = leftBlockX + actualBlockWidth + 20;
    
    console.log('🎯 Very small screen - adjusted block size:', {
      availableWidth,
      maxBlockWidth,
      actualBlockWidth,
      actualBlockHeight
    });
  }
  
  console.log('🎯 Right Block Position:', {
    rightBlockX,
    rightBlockRightEdge: rightBlockX + actualBlockWidth,
    canvasWidth,
    fits: (rightBlockX + actualBlockWidth) <= canvasWidth,
    canFitSideBySide,
    minRequiredWidth
  });
  
  const blockStartY = margin;
  
  // Abstract font sizes
  const FONT_SIZES = {
    DRAGGED_WORD: Math.max(8, 14 * scale),
    ORIGINAL_WORD: Math.max(10, 16 * scale),
    LEFT_WORD: Math.max(10, 14 * scale)
  };
  
  // Abstract stroke width
  const STROKE_WIDTH = Math.max(1, 3 * scale);
  
  // Calculate dynamic block height based on content
  const calculateBlockHeight = useCallback((text: string, fontSize: number, blockWidth: number) => {
    if (!text) return actualBlockHeight;
    
    // More precise text height calculation
    const avgCharWidth = fontSize * 0.55; // More accurate character width estimation
    const maxCharsPerLine = Math.floor(blockWidth / avgCharWidth);
    const lines = Math.ceil(text.length / maxCharsPerLine);
    const lineHeight = fontSize * 1.1; // Tighter line height
    const verticalPadding = 12 * scale; // Reduced padding - just enough for comfort
    
    // Calculate exact height needed for content
    const contentHeight = (lines * lineHeight) + verticalPadding;
    
    // Use minimum height only if content is very short
    const minHeight = Math.max(actualBlockHeight * 0.8, 30 * scale); // Smaller minimum
    
    return Math.max(minHeight, contentHeight);
  }, [actualBlockHeight, scale]);
  
  // Calculate dynamic canvas height based on actual content
  const calculateCanvasHeight = useCallback(() => {
    if (!displayData?.leftWords || !displayData?.rightWords) {
      return BASE.CANVAS_HEIGHT * scale;
    }
    
    // Calculate total height needed for all blocks
    let totalHeight = margin * 2; // Top and bottom margins
    
    // Calculate height for each row of blocks
    for (let i = 0; i < displayData.leftWords.length; i++) {
      const leftWord = displayData.leftWords[i];
      const rightWord = displayData.rightWords[i];
      
      const leftHeight = calculateBlockHeight(leftWord, FONT_SIZES.LEFT_WORD, actualBlockWidth);
      const rightHeight = calculateBlockHeight(rightWord, FONT_SIZES.ORIGINAL_WORD, actualBlockWidth);
      const rowHeight = Math.max(leftHeight, rightHeight);
      
      totalHeight += rowHeight;
      
      // Add spacing between rows (except for the last row)
      if (i < displayData.leftWords.length - 1) {
        totalHeight += 20 * scale; // Padding between blocks
      }
    }
    
    // Ensure minimum height
    const minHeight = BASE.CANVAS_HEIGHT * scale;
    return Math.max(minHeight, totalHeight);
  }, [displayData, calculateBlockHeight, FONT_SIZES, actualBlockWidth, margin, scale]);
  
  const canvasHeight = useMemo(() => calculateCanvasHeight(), [calculateCanvasHeight]);
  
  // Calculate cumulative Y positions for each block row
  const calculateBlockPositions = useCallback(() => {
    if (!displayData?.leftWords || !displayData?.rightWords) {
      return [];
    }
    
    const positions = [];
    let currentY = margin;
    
    for (let i = 0; i < displayData.leftWords.length; i++) {
      const leftWord = displayData.leftWords[i];
      const rightWord = displayData.rightWords[i];
      
      const leftHeight = calculateBlockHeight(leftWord, FONT_SIZES.LEFT_WORD, actualBlockWidth);
      const rightHeight = calculateBlockHeight(rightWord, FONT_SIZES.ORIGINAL_WORD, actualBlockWidth);
      const rowHeight = Math.max(leftHeight, rightHeight);
      
      positions.push({
        y: currentY,
        leftHeight,
        rightHeight,
        rowHeight
      });
      
      // Move to next row position
      currentY += rowHeight + (20 * scale); // Add padding between rows
    }
    
    return positions;
  }, [displayData, calculateBlockHeight, FONT_SIZES, actualBlockWidth, margin, scale]);
  
  const blockPositions = useMemo(() => calculateBlockPositions(), [calculateBlockPositions]);
  
  const [startTime] = useState(Date.now());
  const [isComplete, setIsComplete] = useState(false);

  // Handle drag end for drag mode
  const handleDragEnd = useCallback((e: any, leftIndex: number) => {
    if (!displayData) return;
    
    const rightWords = displayData.rightWords;
    const rightWordWidth = actualBlockWidth + 60; // Responsive drop zone width
    const rightStartX = rightBlockX - 30; // Responsive drop zone position (already calculated from right edge)
    
    console.log('🎯 Drop detection - Word dropped at:', e.target.x(), e.target.y());
    
    // Check if dropped on any right word
    for (let rightIndex = 0; rightIndex < rightWords.length; rightIndex++) {
      const rightWord = rightWords[rightIndex];
      const rightPosition = blockPositions[rightIndex];
      // Use the exact same Y position calculation as the block rendering
      const rightY = rightPosition ? rightPosition.y : blockStartY + rightIndex * blockSpacing;
      // Calculate dynamic height exactly like the block rendering does
      const rightWordDynamicHeight = calculateBlockHeight(rightWord, FONT_SIZES.ORIGINAL_WORD, actualBlockWidth);
      const dropZoneLeft = rightStartX;
      const dropZoneRight = rightStartX + rightWordWidth;
      const dropZoneTop = rightY;
      const dropZoneBottom = rightY + rightWordDynamicHeight;
      
      console.log(`🎯 Checking drop zone ${rightIndex}:`, {
        left: dropZoneLeft,
        right: dropZoneRight,
        top: dropZoneTop,
        bottom: dropZoneBottom,
        word: rightWords[rightIndex]
      });
      
      if (
        e.target.x() >= dropZoneLeft &&
        e.target.x() <= dropZoneRight &&
        e.target.y() >= dropZoneTop &&
        e.target.y() <= dropZoneBottom
      ) {
        // Check if this dropzone is already occupied by another word
        const isOccupied = Object.entries(studentAnswers).some(
          ([occupiedLeftIndexStr, occupiedRightIndex]) => 
            occupiedRightIndex === rightIndex && 
            parseInt(occupiedLeftIndexStr) !== leftIndex
        );
        
        if (isOccupied) {
          // Dropzone is already occupied, don't place it
          console.log(`⚠️ Dropzone ${rightIndex} is already occupied, resetting position`);
          const position = blockPositions[leftIndex];
          const y = position ? position.y : blockStartY + leftIndex * blockSpacing;
          e.target.position({ x: leftBlockX, y });
          return; // Exit early, don't place the word
        }
        
        // Match found and dropzone is free - accept any match (validation happens on Next button)
        console.log(`✅ Match found! Word "${displayData.leftWords[leftIndex]}" matched with "${rightWords[rightIndex]}"`);
        setStudentAnswers(prev => {
          const newAnswers = {
            ...prev,
            [leftIndex]: rightIndex
          };
          return newAnswers;
        });
        // Clear any previous error message when user makes a new match
        setErrorMessage(null);
        break;
      }
    }
    
    // Reset position if not dropped on target
    console.log('❌ No match found, resetting position');
    const position = blockPositions[leftIndex];
    const y = position ? position.y : blockStartY + leftIndex * blockSpacing;
    e.target.position({ x: leftBlockX, y });
  }, [displayData, blockPositions, studentAnswers, actualBlockWidth, rightBlockX, leftBlockX, blockStartY, blockSpacing, calculateBlockHeight, FONT_SIZES]);

  // Handle clicking on right drop zone to reset connection
  const handleDropZoneClick = useCallback((rightIndex: number) => {
    const matchedLeftIndex = Object.keys(studentAnswers).find(
      leftIndexStr => studentAnswers[parseInt(leftIndexStr)] === rightIndex
    );
    
    if (matchedLeftIndex !== undefined) {
      setStudentAnswers(prev => {
        const newAnswers = { ...prev };
        delete newAnswers[parseInt(matchedLeftIndex)];
        return newAnswers;
      });
    }
  }, [studentAnswers]);

  // Check completion
  useEffect(() => {
    if (!displayData) return;
    const totalPairs = displayData.leftWords.length;
    const matchedPairs = Object.keys(studentAnswers).length;
    setIsComplete(matchedPairs === totalPairs && totalPairs > 0);
  }, [studentAnswers, displayData]);

  // Handle completion
  // Handle completion - call onComplete immediately, parent handles background save
  const handleComplete = useCallback(() => {
    if (!isComplete || !displayData || hasCalledOnComplete) return;

    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const totalPairs = displayData.leftWords.length;
    let correctMatches = 0;
    const incorrectMatches: string[] = [];

    // Check all matches for correctness
    Object.entries(studentAnswers).forEach(([leftIndexStr, rightIndex]) => {
      const leftIndex = parseInt(leftIndexStr);
      const expectedRightIndex = displayData.correctPairs[leftIndex];
      if (rightIndex === expectedRightIndex) {
        correctMatches++;
      } else {
        // Track incorrect matches for error message
        incorrectMatches.push(
          `"${displayData.leftWords[leftIndex]}" should match with "${displayData.rightWords[expectedRightIndex]}"`
        );
      }
    });

    // If there are incorrect matches, show error and reset all
    if (incorrectMatches.length > 0) {
      setErrorMessage('Some matches are incorrect. Please try again.');
      // Reset all matches
      setStudentAnswers({});
      return; // Don't complete, let user try again
    }

    // All matches are correct - proceed with completion
    setHasCalledOnComplete(true);
    setErrorMessage(null);

    // If we have lessonId, this is a lesson activity - pass result to parent
    if (lessonData.lessonId) {
      onComplete({
        activityId: `vocabulary-matching-drag-${lessonData.activityOrder}`,
        activityType: 'vocabulary_matching_drag',
        activityOrder: lessonData.activityOrder,
        score: correctMatches,
        maxScore: totalPairs,
        attempts: 1,
        timeSpent,
        completedAt: new Date().toISOString(),
        answers: {
          matchedPairs: Object.entries(studentAnswers).map(([leftIndexStr, rightIndex]) => ({
            leftWord: displayData.leftWords[parseInt(leftIndexStr)],
            rightWord: displayData.rightWords[rightIndex]
          }))
        }
      });
    } else {
      // This is used in evaluation context - return results
      const results = {
        score: correctMatches,
        maxScore: totalPairs,
        timeSpent,
        answers: {
          matchedPairs: Object.entries(studentAnswers).map(([leftIndexStr, rightIndex]) => ({
            leftWord: displayData.leftWords[parseInt(leftIndexStr)],
            rightWord: displayData.rightWords[rightIndex]
          }))
        }
      };
      onComplete(results);
    }
  }, [isComplete, displayData, lessonData, startTime, studentAnswers, onComplete, hasCalledOnComplete]);

  // Auto-complete in evaluation context when all pairs are matched
  useEffect(() => {
    if (isComplete && !lessonData.lessonId) {
      handleComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, lessonData.lessonId]);

  const totalWords = displayData?.leftWords?.length || 0;
  const completion = {
    completed: Object.keys(studentAnswers).length,
    total: totalWords,
    percentage: totalWords > 0 
      ? (Object.keys(studentAnswers).length / totalWords) * 100 
      : 0
  };

  if (!displayData) {
    return (
      <Card>
        <Card.Body>
          <div className="flex justify-center items-center min-h-[400px]">
            <p className="text-neutral-600">Loading vocabulary matching activity...</p>
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <h3 className="text-lg md:text-xl font-semibold">Match the word with its meaning</h3>
        <p className="text-sm text-neutral-600">
          Drag words from the left to match them with their meanings on the right
        </p>
      </Card.Header>
      <Card.Body>
        <div className="mb-4">
          <div className="flex justify-between text-sm text-neutral-600 mb-2">
            <span>Progress</span>
            <span>{completion.completed}/{completion.total} matched</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${completion.percentage}%` }}
            ></div>
          </div>
        </div>

        <div 
          ref={containerRef}
          className="relative w-full"
        >
          <Stage 
            width={canvasWidth} 
            height={canvasHeight}
            className="border-2 rounded-lg border-gray-200"
          >
            <Layer>
              {/* Left Words - Draggable */}
              {displayData.leftWords.map((word, index) => {
                const isDragged = studentAnswers[index] !== undefined;
                const dynamicHeight = calculateBlockHeight(word, FONT_SIZES.LEFT_WORD, actualBlockWidth);
                const position = blockPositions[index];
                const y = position ? position.y : blockStartY + index * blockSpacing;
                
                return (
                <Group
                    key={`left-${index}`}
                    x={leftBlockX}
                    y={y}
                    draggable={!isDragged}
                  onDragStart={(e) => {
                      // Bring to front when dragging starts
                    e.target.moveToTop();
                  }}
                    onDragEnd={(e) => handleDragEnd(e, index)}
                >
                  <Rect
                      width={actualBlockWidth}
                      height={dynamicHeight}
                      fill={isDragged ? '#e5e7eb' : '#3b82f6'}
                      stroke={isDragged ? '#9ca3af' : '#1d4ed8'}
                      strokeWidth={2}
                    cornerRadius={8}
                      opacity={isDragged ? 0.5 : 1}
                  />
                  <Text
                      text={word}
                      x={actualBlockWidth / 2} // Center horizontally
                      y={dynamicHeight / 2} // Center vertically
                      fontSize={FONT_SIZES.LEFT_WORD}
                    fontFamily="Arial"
                      fill={isDragged ? '#dc2626' : 'white'} // Red color when dragged
                    align="center"
                    verticalAlign="middle"
                      width={actualBlockWidth}
                      offsetX={actualBlockWidth / 2} // Center horizontally
                      offsetY={dynamicHeight / 2} // Center vertically
                    wrap="word"
                    ellipsis={true}
                    listening={false}
                  />
                </Group>
                );
              })}

              {/* Right Words - Drop Targets */}
              {displayData.rightWords.map((word, index) => {
                const dynamicHeight = calculateBlockHeight(word, FONT_SIZES.ORIGINAL_WORD, actualBlockWidth);
                const position = blockPositions[index];
                const y = position ? position.y : blockStartY + index * blockSpacing;
                const matchedLeftIndex = Object.keys(studentAnswers).find(
                  leftIndex => studentAnswers[parseInt(leftIndex)] === index
                );

                return (
                  <Group
                    key={`right-${index}`} 
                    x={rightBlockX} 
                    y={y} 
                    onClick={() => handleDropZoneClick(index)}
                    onTap={() => handleDropZoneClick(index)}
                  >
                    <Rect
                      width={actualBlockWidth}
                      height={dynamicHeight}
                      fill={matchedLeftIndex ? '#10b981' : '#f3f4f6'}
                      stroke={matchedLeftIndex ? '#059669' : '#d1d5db'}
                      strokeWidth={2}
                      cornerRadius={8}
                      listening={true}
                    />
                    <Text
                      text={word}
                      x={actualBlockWidth / 2} // Center horizontally
                      y={dynamicHeight / 2} // Center vertically
                      fontSize={FONT_SIZES.ORIGINAL_WORD} // Responsive font size
                      fontFamily="Arial"
                      fill="#000000" // Always black for right block words
                      align="center"
                      verticalAlign="middle"
                      width={actualBlockWidth}
                      offsetX={actualBlockWidth / 2} // Center horizontally
                      offsetY={dynamicHeight / 2} // Center vertically
                      wrap="word"
                      ellipsis={true}
                      listening={false}
                    />
                    {/* Show matched word if any */}
                    {matchedLeftIndex && (
                      <Text
                        text={displayData.leftWords[parseInt(matchedLeftIndex)]}
                        x={actualBlockWidth / 2} // Center horizontally
                        y={dynamicHeight - 5} // Positioned at bottom with 2px padding from edge
                        fontSize={FONT_SIZES.DRAGGED_WORD} // Responsive font size
                        fontFamily="Arial"
                        fill="#dc2626" // Red for dragged word
                        align="center"
                        verticalAlign="middle"
                        width={actualBlockWidth}
                        offsetX={actualBlockWidth / 2} // Center horizontally
                        offsetY={FONT_SIZES.DRAGGED_WORD / 2} // Center the text vertically at this position
                        wrap="word"
                        ellipsis={true}
                      />
                    )}
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        </div>

        {lessonData.lessonId ? (
          // Show completion button for lesson activities
        <div className="mt-6">
          {errorMessage && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 whitespace-pre-line">{errorMessage}</p>
            </div>
          )}
          <div className="flex justify-between items-center">
            <div className="text-sm text-neutral-600">
              {isComplete ? 'All words matched! Ready to continue.' : 'Match all words to continue'}
            </div>

            <Button
              onClick={handleComplete}
              disabled={!isComplete || hasCalledOnComplete}
              size="sm"
              className={isComplete ? 'bg-green-500 hover:bg-green-600' : ''}
            >
              Next
            </Button>
          </div>
        </div>
        ) : (
          // Auto-complete for evaluation context
          isComplete && (
            <div className="mt-6 text-center">
              <div className="text-sm text-green-600 font-medium">
                ✓ All words matched correctly!
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                Click "Next" to continue with the evaluation
              </div>
            </div>
          )
        )}
      </Card.Body>
    </Card>
  );
});

VocabularyMatchingDrag.displayName = 'VocabularyMatchingDrag';

export default VocabularyMatchingDrag;
