export const BUBBLE_SPACING_MM = 8;

/** A4 page dimensions in mm */
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;

/** Corner marker layout (must match AnswerSheetGenerator drawCornerMarkers) */
export const MARKER_MARGIN_MM = 5;   // Distance from page edge to marker outer edge
export const MARKER_SIZE_MM = 12;    // Width/height of each square marker

/** Student ID seven-segment digit cell dimensions (mm) */
export const ID_CELL_WIDTH_MM = 7;
export const ID_CELL_HEIGHT_MM = 10;
export const ID_CELL_SPACING_MM = 1.5;
export const ID_CELL_ROW_EXTRA_GAP_MM = 5;  // Extra vertical gap between rows of digit cells
export const ID_CELLS_PER_ROW = 10;

export const getOptionOffsets = (optionCount: number, spacing = BUBBLE_SPACING_MM): number[] => {
  const count = Math.min(4, Math.max(2, Math.round(optionCount)));
  switch (count) {
    case 2:
      return [-0.5, 0.5].map((factor) => factor * spacing);
    case 3:
      return [-1, 0, 1].map((factor) => factor * spacing);
    case 4:
    default:
      return [-1.5, -0.5, 0.5, 1.5].map((factor) => factor * spacing);
  }
};
