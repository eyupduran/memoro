import { MaterialIcons } from '@expo/vector-icons';

export type ThemeType = 'light' | 'dark' | 'pastel';

interface Theme {
  background: string;
  surface: string;
  surfaceVariant: string;
  primary: string;
  secondary: string;
  accent: string;
  text: {
    primary: string;
    secondary: string;
    light: string;
    onPrimary: string;
  };
  border: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  card: {
    background: string;
    border: string;
    shadow: string;
  };
  icon: {
    primary: string;
    secondary: string;
    active: string;
    inactive: string;
  };
}

export const themes: Record<ThemeType, Theme> = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceVariant: '#EEEEEE',
    primary: '#4A90E2',
    secondary: '#82B1FF',
    accent: '#FF4081',
    text: {
      primary: '#212121',
      secondary: '#757575',
      light: '#9E9E9E',
      onPrimary: '#FFFFFF',
    },
    border: '#E0E0E0',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FFC107',
    info: '#2196F3',
    card: {
      background: '#FFFFFF',
      border: '#E0E0E0',
      shadow: 'rgba(0, 0, 0, 0.1)',
    },
    icon: {
      primary: '#4A90E2',
      secondary: '#757575',
      active: '#4A90E2',
      inactive: '#BDBDBD',
    },
  },
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    surfaceVariant: '#2C2C2C',
    primary: '#82B1FF',
    secondary: '#4A90E2',
    accent: '#FF80AB',
    text: {
      primary: '#FFFFFF',
      secondary: '#B3B3B3',
      light: '#808080',
      onPrimary: '#000000',
    },
    border: '#333333',
    success: '#66BB6A',
    error: '#EF5350',
    warning: '#FFD54F',
    info: '#64B5F6',
    card: {
      background: '#1E1E1E',
      border: '#333333',
      shadow: 'rgba(0, 0, 0, 0.3)',
    },
    icon: {
      primary: '#82B1FF',
      secondary: '#B3B3B3',
      active: '#82B1FF',
      inactive: '#4D4D4D',
    },
  },
  pastel: {
    background: '#F8F9FA',
    surface: '#E9ECEF',
    surfaceVariant: '#DEE2E6',
    primary: '#4B79BD',
    secondary: '#B8E0D2',
    accent: '#F7CAC9',
    text: {
      primary: '#2B2B2B',
      secondary: '#5C5C5C',
      light: '#8C8C8C',
      onPrimary: '#FFFFFF',
    },
    border: '#CED4DA',
    success: '#8DB596',
    error: '#E6A5A5',
    warning: '#F2D4A7',
    info: '#A7C5E3',
    card: {
      background: '#FFFFFF',
      border: '#CED4DA',
      shadow: 'rgba(0, 0, 0, 0.05)',
    },
    icon: {
      primary: '#4B79BD',
      secondary: '#5C5C5C',
      active: '#4B79BD',
      inactive: '#CED4DA',
    },
  },
};

export const themeIcons: Record<ThemeType, keyof typeof MaterialIcons.glyphMap> = {
  light: 'wb-sunny',
  dark: 'nights-stay',
  pastel: 'palette',
}; 