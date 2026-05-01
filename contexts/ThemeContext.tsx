import AsyncStorage from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { useUnlocks } from '@/contexts/UnlocksContext';
import {
  applyTheme,
  DEFAULT_THEME_KEY,
  normalizeThemeKey,
  ThemeDefinitions,
  ThemeKey,
} from '@/constants/theme';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'chen_theme_preference';

type ThemeContextValue = {
  themeKey: ThemeKey;
  setThemeKey: (themeKey: ThemeKey) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  themeKey: DEFAULT_THEME_KEY,
  setThemeKey: async () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { isThemeUnlocked } = useUnlocks();
  const [themeKey, setThemeKeyState] = useState<ThemeKey>(DEFAULT_THEME_KEY);

  useEffect(() => {
    let cancelled = false;

    const loadTheme = async () => {
      try {
        const storedTheme = normalizeThemeKey(await AsyncStorage.getItem(STORAGE_KEY));
        const profileTheme = normalizeThemeKey(profile?.theme_preference);
        const preferredTheme = storedTheme !== DEFAULT_THEME_KEY ? storedTheme : profileTheme;
        const resolvedTheme = isThemeUnlocked(preferredTheme) ? preferredTheme : DEFAULT_THEME_KEY;

        if (!cancelled) {
          setThemeKeyState(resolvedTheme);
        }
      } catch (error) {
        console.error('ThemeContext: Failed to load theme', error);
        if (!cancelled) {
          setThemeKeyState(DEFAULT_THEME_KEY);
        }
      }
    };

    loadTheme();

    return () => {
      cancelled = true;
    };
  }, [isThemeUnlocked, profile?.theme_preference]);

  applyTheme(themeKey);

  const setThemeKey = useCallback(async (nextThemeKey: ThemeKey) => {
    const normalizedTheme = normalizeThemeKey(nextThemeKey);
    const resolvedTheme = isThemeUnlocked(normalizedTheme) ? normalizedTheme : DEFAULT_THEME_KEY;
    setThemeKeyState(resolvedTheme);
    await AsyncStorage.setItem(STORAGE_KEY, resolvedTheme);
  }, [isThemeUnlocked]);

  const value = useMemo(
    () => ({
      themeKey,
      setThemeKey,
    }),
    [themeKey, setThemeKey]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

export function getThemeDefinition(themeKey: ThemeKey) {
  return ThemeDefinitions[normalizeThemeKey(themeKey)];
}
