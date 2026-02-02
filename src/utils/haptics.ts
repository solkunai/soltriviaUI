// Haptic feedback utilities for web
// Uses Vibration API when available

export const HapticFeedback = {
  // Light vibration for correct answer
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }
  },

  // Strong vibration for wrong answer
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
  },

  // Light tap feedback
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  },

  // Medium feedback
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  },
};
