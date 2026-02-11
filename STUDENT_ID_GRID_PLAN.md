# Student ID number grid – PDF design and recognition plan

## 1. Goal

- **Input:** Student writes their ID (e.g. 6 digits) on the answer sheet.
- **Output:** Reliable OCR of that ID with minimal misreads.
- **Approach:** Redesign the PDF so the number grid is easy to scan, and define recognition to match the new layout.

---

## 2. Current problems (why we’re changing)

- Thin 7‑segment **lines** (0.3 pt): small alignment errors make segments disappear from ROIs.
- One segment (e.g. F) often has high contrast (borders/shadows), so it dominates and pushes results toward “0”.
- Fixed ROIs assume perfect alignment; scaling/rotation/skew break the match.

---

## 3. New PDF design: thick-segment (filled bar) grid

### 3.1 Concept

- Keep **7 segments per digit** (A–G, same layout as before).
- Draw each segment as a **thick filled bar** (rectangle), not a thin line.
- Student **darkens** the bars that should be “on” for each digit (or leaves them light).
- Default bars: **light gray** so they’re visible; when filled with pen they become dark and easy to detect.

### 3.2 Layout (one digit cell)

- **Cell size:** Unchanged (e.g. 5.5 mm × 7 mm per digit) so existing template positions still work.
- **Bar thickness:** 1.2 mm (same in both dimensions: height for horizontals, width for verticals).
- **Positions (centerlines as today, then expand to bars):**
  - **A (top):** Horizontal bar, center at `topY`, from `innerLeftX` to `innerRightX`, height 1.2 mm.
  - **D (middle):** Horizontal bar at `centerY`, same width, height 1.2 mm.
  - **G (bottom):** Horizontal bar at `bottomY`, same width, height 1.2 mm.
  - **F (upper-left):** Vertical bar, center at `leftX`, from `topY` to `upperMidY`, width 1.2 mm.
  - **B (upper-right):** Vertical bar, center at `rightX`, same vertical span, width 1.2 mm.
  - **E (lower-left):** Vertical bar at `leftX`, from `lowerMidY` to `bottomY`, width 1.2 mm.
  - **C (lower-right):** Vertical bar at `rightX`, same vertical span, width 1.2 mm.

- **Gap between bars:** Keep a small gap (e.g. 0.2 mm) so segments don’t touch and recognition ROIs don’t overlap.

### 3.3 Drawing in PDF (mm)

- **Student ID grid (empty cells):** For each digit cell, draw **all 7** segments as **light gray filled rectangles** (e.g. RGB 230, 230, 230). No stroke or thin stroke. So the student sees 7 bars and darkens the ones that form each digit.
- **Example row (0–9):** Draw the same thick bars; for each example digit, fill the “on” segments in **black** (or dark gray) so the pattern is clear. Leave “off” segments light gray or unfilled.

### 3.4 On-page instructions

Add a short line near the Student ID grid, for example:

- *“Student ID: darken the bars for each digit (like the example numbers below). Leave bars light if that segment is off.”*

(Exact wording can be tuned later.)

---

## 4. Recognition strategy (how we will recognise it)

### 4.1 Pipeline (unchanged at high level)

1. Get the image (scan/photo).
2. Align to template / find answer region (existing logic).
3. For each digit cell, get the crop (existing template squares or contour-based).
4. **Per digit cell:** Run the new segment detection (below), then map 7 bits → digit with existing lookup table.

### 4.2 Segment ROIs (match thick bars)

- **Same 7 segments A–G**, same order (A B C D E F G).
- **ROI geometry:** Define each segment as a **rectangle in relative coordinates** (fractions of the digit box), aligned with the **thick bar** in the PDF:
  - Horizontal bars (A, D, G): height ≈ 1.2/7 of cell height (~0.17), width ≈ 1/3 of cell width, centered; y positions at top / middle / bottom.
  - Vertical bars (B, C, E, F): width ≈ 1.2/5.5 of cell width (~0.22), height ≈ 1/3 of cell height; x at left/right, y at upper/lower third.
- **Exact fractions** will be set so that the ROI lies **inside** the 1.2 mm bar with a small margin. This gives a larger “hit” area than thin lines and is less sensitive to small shifts.

### 4.3 Segment decision (per segment)

- **Option A – Contrast (recommended):** Sample the segment ROI (mean intensity) and background from strips **outside** the bar (above/below for horizontals, left/right for verticals). Segment **ON** if `(backgroundMean - segmentMean) >= threshold` (e.g. 12–15). No fixed global threshold; works across lighting.
- **Option B – Fill ratio:** In the segment ROI, binarize (e.g. Otsu) and treat segment ON if filled ratio exceeds a value (e.g. > 0.3). Simpler but more sensitive to threshold.
- Prefer **Option A** so we don’t depend on a single brightness value.

### 4.4 Digit from 7 bits

- **Lookup table:** Same as now: 7-bit string (A B C D E F G) → digit 0–9, matching the generator’s segment map (0 = ABCEFG, 1 = BC, etc.).
- **Optional:** Soft scoring (average contrast ON minus average contrast OFF) and pick best digit; only accept if best score ≥ minimum. Reduces bias toward digits with many segments (e.g. 0).

### 4.5 Why this should be more reliable

- **Thick bars:** Segment ROIs sit on a real “blob” of ink, not a one-pixel line, so small alignment errors still see dark pixels.
- **Same layout:** We keep 7 segments and the same A–G positions, so existing digit logic and lookup stay valid; only PDF drawing and ROI sizes change.
- **Contrast-based decision:** Relative to local background, so robust to paper and lighting.
- **Clear instructions:** Students know to “darken the bars,” which matches how we detect (dark = on).

---

## 5. Implementation checklist (for when we code)

### PDF (AnswerSheetGenerator + Dashboard)

- [ ] Define constants: bar thickness (1.2 mm), light gray (230,230,230), small gap (0.2 mm).
- [ ] Student ID grid: for each digit cell, draw 7 thick bars (filled rectangles) in light gray.
- [ ] Example row: for each digit 0–9, draw 7 thick bars; fill “on” segments in black/dark.
- [ ] Add one line of instructions above or below the Student ID grid.
- [ ] Remove old thin-line drawing for the Student ID and example digits.

### OCR (ocrService)

- [ ] Update `SEGMENT_ROI` (or equivalent) so each segment is a rectangle matching the **thick bar** (wider/taller than current thin-line ROIs), still in relative coords.
- [ ] Keep contrast-based segment decision (background strips outside bar); keep or tune threshold (e.g. 12).
- [ ] Keep digit lookup table and optional soft scoring; tune minimum score if needed.
- [ ] No change to template alignment or digit-cell cropping unless we later change cell size.

### Docs / UX

- [ ] Update any user-facing text that describes “digital style” digits to say “darken the bars for each digit.”
- [ ] (Optional) Add a small “?” or tooltip next to the grid with the same instruction.

---

## 6. Out of scope for this plan

- Changing the **number of digits** (e.g. 6) or **position** of the Student ID block on the page (both stay as today).
- Barcode/QR, handwritten digit CNN, or other input methods (could be a later doc).
- Changing bubble layout or question layout.

---

## 7. Summary

| Item | Current | New |
|------|--------|-----|
| PDF segments | Thin lines (0.3 pt) | Thick filled bars (1.2 mm) |
| Student action | Trace / fill thin lines | Darken bars (leave others light) |
| Segment ROI | Small, line-like | Rectangle covering thick bar |
| Segment ON | Contrast or threshold | Contrast vs. background (recommended) |
| Digit mapping | 7-bit lookup | Same 7-bit lookup |

Next step: implement PDF changes (thick bars + instructions), then adjust segment ROIs and re-test recognition on the new sheets.
