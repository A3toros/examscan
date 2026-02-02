# OpenCV Features Usage in ExamScan OCR

## Currently Used ✅

### Homography & Warping
- ✅ `cv.getPerspectiveTransform()` - Used in `warpToTemplate()` for 4-point perspective transform
- ✅ `cv.warpPerspective()` - Applies the transformation matrix to normalize image to A4 template
- ❌ `cv.findHomography()` - **NOT USED** (more robust with RANSAC for outlier rejection)

### Corner/Marker Detection
- ✅ `cv.findContours()` - Used extensively for:
  - Fiducial marker detection (nested squares)
  - Bubble detection fallback
  - Student ID digit recognition
- ✅ Custom fiducial marker detection (nested squares) - `detectFiducialMarkers()`
- ✅ `cv.HoughCircles()` - Used in:
  - `detectBubbleCentersInBox()` - Detects bubble outlines
  - `findBubblesByFillInBox()` - Fallback bubble detection
- ❌ `cv.aruco` module - **NOT USED** (would be more robust than custom markers)

### Threshold & Binary Operations
- ✅ `cv.threshold()` - Used with:
  - `cv.THRESH_BINARY_INV` - For digit recognition
  - `cv.THRESH_OTSU` - Automatic threshold selection
- ✅ `cv.adaptiveThreshold()` - Used with:
  - `cv.ADAPTIVE_THRESH_GAUSSIAN_C` - For bubble fill detection
  - Handles varying lighting conditions
- ✅ Morphological operations:
  - `cv.morphologyEx()` with `cv.MORPH_CLOSE` - Clean up noise
  - `cv.erode()` - Remove bubble outlines, measure interior fill
- ⚠️ Limited morphological operations - Could use more (dilate, open, gradient)

## Recommended Improvements 🚀

### 1. Switch to `findHomography()` with RANSAC
**Current:** `getPerspectiveTransform()` - exact 4-point transform
**Better:** `findHomography()` - handles outliers, more robust

```typescript
// Instead of:
const M = cv.getPerspectiveTransform(srcPts, dstPts);

// Use:
const M = cv.findHomography(srcPts, dstPts, cv.RANSAC, 5.0);
```

### 2. Add ArUco Marker Support
**Current:** Custom nested square detection
**Better:** ArUco markers - industry standard, more robust

```typescript
// Would need to:
// 1. Generate ArUco markers in PDF
// 2. Detect with cv.aruco.detectMarkers()
// 3. Use marker corners for homography
```

### 3. Enhanced Morphological Operations
**Current:** Only `MORPH_CLOSE` and `erode`
**Better:** Add more operations for noise cleanup

```typescript
// Add:
cv.dilate() - Fill small gaps
cv.morphologyEx(MORPH_OPEN) - Remove small noise
cv.morphologyEx(MORPH_GRADIENT) - Edge detection
```

### 4. Better Thresholding Strategy
**Current:** Mix of adaptive and Otsu
**Better:** Multi-level thresholding for different regions

```typescript
// Could use:
cv.threshold() with different methods per region
cv.adaptiveThreshold() with different block sizes
```

## Implementation Priority

1. **HIGH:** Switch to `findHomography()` - Easy change, big robustness improvement
2. **MEDIUM:** Add more morphological operations - Better noise handling
3. **LOW:** ArUco markers - Requires PDF generation changes
