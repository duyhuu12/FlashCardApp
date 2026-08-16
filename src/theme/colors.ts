import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme, type ViewStyle } from 'react-native';

export const lightColors = {
  primary: '#087A9B',
  primaryDark: '#07526F',
  primarySoft: '#E2F8FA',
  header: '#087A9B',
  background: '#F4FAFC',
  surface: '#FFFFFF',
  text: '#102C3D',
  muted: '#627985',
  border: '#D6E8EC',
  success: '#1E912F',
  successSoft: '#E4F6EF',
  warning: '#E28A2B',
  warningSoft: '#FFF1DD',
  danger: '#D94A5A',
  dangerSoft: '#FFE8EB',
};

export const darkColors: AppColors = {
  primary: '#43CED8',
  primaryDark: '#8AE7EC',
  primarySoft: '#123B46',
  header: '#087A9B',
  background: '#071B25',
  surface: '#102A35',
  text: '#F1FBFD',
  muted: '#9BB4BE',
  border: '#284650',
  success: '#58D786',
  successSoft: '#123D2C',
  warning: '#F5B75D',
  warningSoft: '#44331C',
  danger: '#FF7D8B',
  dangerSoft: '#48242B',
};

export type AppColors = typeof lightColors;
export type AppShadows = { card: ViewStyle };
export type ThemePreference = 'system' | 'light' | 'dark';

interface AppThemeValue {
  themePreference: ThemePreference;
  setThemePreference(preference: ThemePreference): void;
  colorScheme: 'light' | 'dark';
  isDark: boolean;
  colors: AppColors;
  shadows: AppShadows;
}

const THEME_PREFERENCE_KEY = 'dolphinlingo:theme-preference';
const AppThemeContext = createContext<AppThemeValue | null>(null);

const lightShadows: AppShadows = {
  card: {
    shadowColor: '#063449',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
};

const darkShadows: AppShadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
};

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then((storedPreference) => {
        if (
          storedPreference === 'system' ||
          storedPreference === 'light' ||
          storedPreference === 'dark'
        ) {
          setThemePreferenceState(storedPreference);
        }
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<AppThemeValue>(() => {
    const colorScheme =
      themePreference === 'system'
        ? systemColorScheme === 'dark'
          ? 'dark'
          : 'light'
        : themePreference;
    const isDark = colorScheme === 'dark';
    return {
      themePreference,
      setThemePreference(preference) {
        setThemePreferenceState(preference);
        AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference).catch(() => undefined);
      },
      colorScheme,
      isDark,
      colors: isDark ? darkColors : lightColors,
      shadows: isDark ? darkShadows : lightShadows,
    };
  }, [systemColorScheme, themePreference]);

  return createElement(AppThemeContext.Provider, { value }, children);
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);
  if (!value) throw new Error('useAppTheme phải được dùng bên trong AppThemeProvider.');
  return value;
}

export function useThemedStyles<T>(
  factory: (colors: AppColors, shadows: AppShadows) => T,
) {
  const { colors, shadows } = useAppTheme();
  return useMemo(
    () => factory(colors, shadows),
    [colors, factory, shadows],
  );
}

export function resolveDeckColor(color?: string | null, fallback = lightColors.primary) {
  if (!color || color.toUpperCase() === '#6558D3') return fallback;
  return color;
}
