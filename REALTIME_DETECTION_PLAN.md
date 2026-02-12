# Real-Time Camera Detection Plan

## Goal

Run the **same detection pipeline** for the live camera as for uploaded photos: detect corner markers (fiducials) → homography (warp to template) → read bubbles and student ID. Nothing different in logic; only the input is a video frame instead of a file.

---

## Current Pipeline (Upload Path)

Used in `handleFileUpload` and `ocrService.processAnswerSheet`:

1. **Input** → ImageData (or image URL / HTMLImageElement).
2. **Convert** → OpenCV Mat (`imageDataToMat`).
3. **Resize** (optional) → Only if image is larger than 3500px on a side; otherwise keep full resolution.
4. **Preprocess** → `preprocessImage(mat)` (e.g. grayscale, thresholding) for corner/bubble detection.
5. **Corner markers** → `detectCornerMarkers(processedImage)`:
   - Tries `detectFiducialMarkers` (nested square markers in corner zones).
   - Fallback: find largest contour in each corner zone (18% of min dimension).
   - Returns `{ tl, tr, br, bl }` in image coordinates.
6. **Homography** → `warpToTemplate(sourceMat, corners)`:
   - Maps detected corners to fixed A4 template positions (accounting for 5mm marker margin).
   - Produces aligned image at 10 px/mm (2100×2970 for A4).
7. **Layout** → `detectLayout(processedImage)` (optional / fallback).
8. **Bubbles** → `detectBubbles(processedImage, layout, questionTypes)`:
   - Uses template grid + Hough circles / shift search.
9. **Student ID** (if enabled) → Same as upload: segment + template matching on warped image.

All of this is already in `ocrService.ts`; the upload path and `processAnswerSheetWithStudentID` use it.

---

## Current Real-Time (Camera) Path

- **Preview loop** (`useEffect` with `setInterval(checkFrame, 1500|2000)`):
  - Grabs a frame from `<video>`.
  - **Downscales to 640px width** (`previewWidth = 640`), draws to canvas, gets `ImageData`.
  - Calls **same** `ocrService.processAnswerSheet(imageData, questionTypes, layoutConfig)`.

So we **already** use the same pipeline (corner markers → homography → bubbles). The problem is likely **input resolution**:

- At 640px width, an A4 sheet fills the frame at ~3 px/mm.
- Corner markers on the PDF are 12mm squares → ~36px in the frame.
- Corner zones are 18–22% of min dimension → ~115–140px zones; markers inside are small and may be lost after preprocessing, so **corner detection can fail** and no homography is applied → no/weak detection.

---

## Plan: Make Real-Time Use the Same Pipeline with Suitable Resolution

### 1. Use the same pipeline (no new logic)

- Keep calling `processAnswerSheet` (and, when student ID is needed, `processAnswerSheetWithStudentID`) for camera frames.
- No separate “camera-only” path; same corner detection, same homography, same bubble/student-ID logic as upload.

### 2. Fix real-time input resolution

- **Stop using 640px for detection.** Use a resolution high enough for corner markers to be detectable (e.g. marker ~12mm at ≥ ~5–6 px/mm → frame width for A4 ~1050–1260px minimum).
- **Options:**
  - **A. Use full video resolution for the frame sent to OCR**  
    - Capture at `video.videoWidth` × `video.videoHeight` (or cap at 3500 to match upload) and pass that `ImageData` to `processAnswerSheet`.  
    - Pros: Same as upload; best detection.  
    - Cons: Heavier per frame; may need to throttle (e.g. run every 1.5–2s) or run in a worker.
  - **B. Use a fixed “detection width” (e.g. 1280)**  
    - Scale frame to width 1280 (or 1280 on longest side), then `getImageData` and pass to `processAnswerSheet`.  
    - Balances speed and reliability; 1280px gives ~6 px/mm for A4-filling frame, so markers ~72px.
  - **C. Two-tier: fast “sheet present” at low res, full pipeline at higher res**  
    - Optional: very low-res or simple check to see “something sheet-like” before running full pipeline at 1280 or full resolution.

**Recommendation:** Start with **B** (e.g. 1280px) for the frame passed to `processAnswerSheet`; if needed, increase to full resolution and throttle more.

### 3. Concrete code changes (AnswerSheetScanner)

- In the `checkFrame` (preview loop):
  - Replace the 640px downscale with a **detection width** of **1280** (or configurable), e.g.:
    - `const detectionWidth = 1280;`
    - `const scale = detectionWidth / video.videoWidth;`
    - `const detectionHeight = Math.round(video.videoHeight * scale);`
  - Draw the frame at `detectionWidth × detectionHeight` to the canvas, then `getImageData(0, 0, canvas.width, canvas.height)` and pass that to `processAnswerSheet` / `processAnswerSheetWithStudentID`.
- Optionally cap `detectionWidth` by `video.videoWidth` so we never upscale.
- Keep the same interval (1.5–2s) or adjust if 1280 is too heavy on low-end devices.

### 4. Optional: “Detection mode” in OCR service

- If we want to avoid running student ID on every preview frame (to save time), we could:
  - Add an option to `processAnswerSheet` (e.g. `detectionOnly?: boolean`) that skips student ID and only runs corner + homography + bubbles for the “ready” state; **or**
  - Keep current behavior (full pipeline every time) and rely on throttling.

Not required for “same pipeline”; only for performance tuning.

### 5. Checklist

- [ ] In `AnswerSheetScanner.tsx` `checkFrame`, increase preview resolution from 640 to **1280** (or full video resolution, capped at 3500) for the frame passed to OCR.
- [ ] Ensure the same `questionTypes` and `layoutConfig` are passed as for upload (already the case).
- [ ] Confirm no separate code path: one pipeline (`processAnswerSheet` + optional `processAnswerSheetWithStudentID`) for both file upload and camera frame.
- [ ] Test on device: corner markers visible in frame, homography succeeds, bubble count and “ready” state appear; then test full capture/grade with same pipeline.
- [ ] (Optional) Add a short comment in `ocrService.ts` above `processAnswerSheet`: “Used for both uploaded images and live camera frames; input resolution must be sufficient for corner marker detection (recommend ≥1280px width for A4-filling frame).”

---

## Summary

- **Detection must run the same way as for uploaded photos:** corner markers → homography → template-aligned bubble (and student ID) detection.
- **Real-time already uses that pipeline;** the fix is to **feed it a higher-resolution frame** (e.g. 1280px width instead of 640) so corner detection and homography succeed. No new detection logic is required.
