// App-wide constants
export const APP_CONSTANTS = {
  // Streak threshold for showing tick icon on words
  STREAK_THRESHOLD: 2, // Words with streak >= 3 will show a tick icon
  
  // Word selection limits
  MIN_WORDS: 2,
  MAX_WORDS: 5,
  
  // Exercise settings
  ITEMS_PER_PAGE: 10,
  
  // Animation settings
  SCROLL_THRESHOLD: 20,
} as const; 