import React, { createContext, useContext, useEffect, useState } from 'react';
import { Colors, darkThemePalette } from '@/constants/design-system';
import { getItem, setItem } from '@/lib/storage';

export type Language = 'fr' | 'en';
export type AppTheme = 'light' | 'dark';
export type StockDisplay = 'carton' | 'alveole' | 'egg';
type Preferences = { language: Language; theme: AppTheme; stockDisplay: StockDisplay; setLanguage: (value: Language) => void; setTheme: (value: AppTheme) => void; setStockDisplay: (value: StockDisplay) => void };

const PreferenceContext = createContext<Preferences>({ language: 'fr', theme: 'light', stockDisplay: 'egg', setLanguage: () => {}, setTheme: () => {}, setStockDisplay: () => {} });

function applyTheme(theme: AppTheme) {
  const nextPalette = theme === 'dark' ? darkThemePalette : {
    ...Colors,
    background: '#f9f9f9',
    surface: '#f9f9f9',
    surfaceBright: '#f9f9f9',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#f3f3f3',
    surfaceContainer: '#eeeeee',
    surfaceContainerHigh: '#e8e8e8',
    surfaceContainerHighest: '#e2e2e2',
    onSurface: '#1a1c1c',
    onSurfaceVariant: '#40493d',
    outline: '#707a6c',
    outlineVariant: '#bfcaba',
    surfaceVariant: '#e2e2e2',
    onBackground: '#1a1c1c',
  };

  Object.assign(Colors, nextPalette);
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');
  const [theme, setThemeState] = useState<AppTheme>('light');
  const [stockDisplay, setStockDisplayState] = useState<StockDisplay>('egg');

  useEffect(() => {
    let active = true;

    Promise.all([getItem('pref_lang'), getItem('pref_theme'), getItem('pref_stock_display')]).then(([lang, storedTheme, storedStockDisplay]) => {
      if (!active) return;

      const nextTheme = storedTheme === 'dark' ? 'dark' : 'light';
      setLanguageState(lang === 'en' ? 'en' : 'fr');
      setThemeState(nextTheme);
      setStockDisplayState(storedStockDisplay === 'carton' || storedStockDisplay === 'alveole' ? storedStockDisplay : 'egg');
      applyTheme(nextTheme);
    });

    return () => {
      active = false;
    };
  }, []);

  const setLanguage = (value: Language) => {
    setLanguageState(value);
    void setItem('pref_lang', value);
  };

  const setTheme = (value: AppTheme) => {
    setThemeState(value);
    applyTheme(value);
    void setItem('pref_theme', value);
  };

  const setStockDisplay = (value: StockDisplay) => {
    setStockDisplayState(value);
    void setItem('pref_stock_display', value);
  };

  return <PreferenceContext.Provider value={{ language, theme, stockDisplay, setLanguage, setTheme, setStockDisplay }}>{children}</PreferenceContext.Provider>;
}

export const usePreferences = () => useContext(PreferenceContext);
