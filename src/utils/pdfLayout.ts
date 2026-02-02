export const BUBBLE_SPACING_MM = 8;

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
