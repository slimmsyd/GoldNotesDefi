import { Platform } from 'react-native';

export interface ThemeTokens {
  colors: {
    bgBase: string;
    bgElevated: string;
    bgMuted: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    accentGold: string;
    accentGoldMuted: string;
    accentDark: string;
    hairline: string;
    success: string;
    danger: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  typography: {
    hero: number;
    title: number;
    subtitle: number;
    body: number;
    caption: number;
  };
  motion: {
    quick: number;
    normal: number;
    slow: number;
  };
}

export const tokens: ThemeTokens = {
  colors: {
    bgBase: '#f2f2f7',
    bgElevated: '#ffffff',
    bgMuted: '#e9ecf3',
    textPrimary: '#111827',
    textSecondary: '#374151',
    textTertiary: '#6b7280',
    accentGold: '#b88918',
    accentGoldMuted: '#fff7dc',
    accentDark: '#0f172a',
    hairline: '#e5e7eb',
    success: '#166534',
    danger: '#991b1b',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    pill: 999,
  },
  typography: {
    hero: 40,
    title: 28,
    subtitle: 18,
    body: 15,
    caption: 12,
  },
  motion: {
    quick: 180,
    normal: 280,
    slow: 420,
  },
};

export const shadows = {
  soft: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
  floating: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 9 },
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
} as const;
