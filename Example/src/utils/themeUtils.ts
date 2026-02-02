// Theme utility functions and constants

export const CYBERPUNK_COLORS = {
  black: '#000000',
  dark: '#111111',
  cyan: '#00ffff',
  green: '#00ff00',
  red: '#ff0000',
  yellow: '#ffff00',
  purple: '#800080',
  orange: '#ff6600'
};

export const KPOP_COLORS = {
  backgroundSecondary: '#0a0a0a',
  primary: '#ec4899', // pink-500
  secondary: '#f97316', // orange-500
  text: '#ffffff',
  textSecondary: '#9ca3af',
  border: '#374151',
  error: '#ef4444',
  success: '#10b981'
};

export const getThemeStyles = (theme: string) => {
  const baseStyles = {
    glow: {},
    textShadow: {},
    textShadowRed: {},
    background: {}
  };

  if (theme === 'cyberpunk') {
    return {
      ...baseStyles,
      glow: {
        boxShadow: `0 0 20px ${CYBERPUNK_COLORS.cyan}40`,
        borderColor: CYBERPUNK_COLORS.cyan
      },
      textShadow: {
        textShadow: `0 0 8px ${CYBERPUNK_COLORS.cyan}`
      },
      textShadowRed: {
        textShadow: `0 0 8px ${CYBERPUNK_COLORS.red}`
      },
      background: {
        backgroundColor: CYBERPUNK_COLORS.black
      }
    };
  }

  if (theme === 'kpop') {
    return {
      ...baseStyles,
      glow: {
        boxShadow: `0 0 20px ${KPOP_COLORS.primary}40`
      },
      textShadow: {
        textShadow: `0 0 8px ${KPOP_COLORS.primary}`
      },
      textShadowRed: {
        textShadow: `0 0 8px ${KPOP_COLORS.error}`
      },
      background: {
        backgroundColor: KPOP_COLORS.backgroundSecondary
      },
      textWhite: {
        color: KPOP_COLORS.text
      }
    };
  }

  return baseStyles;
};

export const getCyberpunkCardBg = (intensity: number = 0) => {
  const backgrounds = [
    { className: 'bg-black border border-cyan-400', style: { backgroundColor: '#000000', borderColor: '#00ffff' } },
    { className: 'bg-gray-900 border border-cyan-400', style: { backgroundColor: '#111827', borderColor: '#00ffff' } },
    { className: 'bg-gray-800 border border-cyan-400', style: { backgroundColor: '#1f2937', borderColor: '#00ffff' } }
  ];

  return backgrounds[intensity] || backgrounds[0];
};

export const getKpopCardBg = (intensity: number = 0) => {
  const backgrounds = [
    { className: 'bg-black border border-pink-500', style: { backgroundColor: '#000000', borderColor: '#ec4899' } },
    { className: 'bg-gray-900 border border-pink-500', style: { backgroundColor: '#111827', borderColor: '#ec4899' } },
    { className: 'bg-gray-800 border border-pink-500', style: { backgroundColor: '#1f2937', borderColor: '#ec4899' } }
  ];

  return backgrounds[intensity] || backgrounds[0];
};

export const colorToRgba = (color: string, alpha: number = 1) => {
  // Simple color to rgba conversion - in a real app you'd want a more robust solution
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
